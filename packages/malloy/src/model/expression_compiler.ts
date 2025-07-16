/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  expressionIsAnalytic,
  isLiteral,
  exprHasKids,
  exprHasE,
  expressionIsAggregate,
} from './malloy_types';
import type {
  Expr,
  FilterMatchExpr,
  FunctionCallNode,
  FunctionOverloadDef,
  FunctionParameterDef,
  FunctionOrderBy,
  QuerySegment,
} from './malloy_types';
import type {
  FilterParserResponse,
  FilterExpression,
} from '@malloydata/malloy-filter';
import {
  StringFilterExpression,
  NumberFilterExpression,
  BooleanFilterExpression,
  TemporalFilterExpression,
} from '@malloydata/malloy-filter';
import type {FieldInstanceResult} from './field_instance';
import {FilterCompilers} from './filter_compilers';
import type {SQLExprElement} from './utils';
import {exprMap, composeSQLExpr, range} from './utils';
import type {QueryStruct} from './query_struct';
import type {QueryField} from './query_field';

class GenerateState {
  whereSQL?: string;
  applyValue?: string;
  totalGroupSet = -1;

  withWhere(s?: string): GenerateState {
    const newState = new GenerateState();
    newState.whereSQL = s;
    newState.applyValue = this.applyValue;
    newState.totalGroupSet = this.totalGroupSet;
    return newState;
  }

  withApply(s: string): GenerateState {
    const newState = new GenerateState();
    newState.whereSQL = this.whereSQL;
    newState.applyValue = s;
    newState.totalGroupSet = this.totalGroupSet;
    return newState;
  }

  withTotal(groupSet: number): GenerateState {
    const newState = new GenerateState();
    newState.whereSQL = this.whereSQL;
    newState.applyValue = this.applyValue;
    newState.totalGroupSet = groupSet;
    return newState;
  }
}

/**
 * Converts an expression to SQL.
 * This function was extracted from QueryField.exprToSQL to break circular dependencies.
 */
export function exprToSQL(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  exprToTranslate: Expr,
  state: GenerateState = new GenerateState()
): string {
  // Wrap non leaf sub expressions in parenthesis
  const subExpr = function (qf: QueryField, e: Expr) {
    const sql = exprToSQL(qf, resultSet, context, e, state);
    if (exprHasKids(e)) {
      return `(${sql})`;
    }
    return sql;
  };

  /*
   * Translate the children first, and stash the translation
   * in the nodes themselves, so that if we call into the dialect
   * it will have access to the translated children.
   */
  let expr = exprToTranslate;
  if (exprHasE(exprToTranslate)) {
    expr = {...exprToTranslate};
    const eSql = subExpr(field, expr.e);
    expr.e = {...expr.e, sql: eSql};
  } else if (exprHasKids(exprToTranslate)) {
    expr = {...exprToTranslate};
    const oldKids = exprToTranslate.kids;
    for (const [name, kidExpr] of Object.entries(oldKids)) {
      if (kidExpr === null) continue;
      if (Array.isArray(kidExpr)) {
        expr.kids[name] = kidExpr.map(e => {
          return {...e, sql: subExpr(field, e)};
        });
      } else {
        expr.kids[name] = {...oldKids[name], sql: subExpr(field, kidExpr)};
      }
    }
  }

  /*
   * Give the dialect a chance to translate this node
   */
  const qi = resultSet.getQueryInfo();
  const dialectSQL = field.parent.dialect.exprToSQL(qi, expr);
  if (dialectSQL) {
    return dialectSQL;
  }

  switch (expr.node) {
    case 'field':
      return field.generateFieldFragment(resultSet, context, expr, state);
    case 'parameter':
      return field.generateParameterFragment(resultSet, context, expr, state);
    case 'filteredExpr':
      return field.generateFilterFragment(resultSet, context, expr, state);
    case 'all':
    case 'exclude':
      return field.generateUngroupedFragment(resultSet, context, expr, state);
    case 'genericSQLExpr':
      return Array.from(
        field.stringsFromSQLExpression(resultSet, context, expr, state)
      ).join('');
    case 'aggregate': {
      let agg = '';
      if (expr.function === 'sum') {
        agg = field.generateSumFragment(resultSet, context, expr, state);
      } else if (expr.function === 'avg') {
        agg = field.generateAvgFragment(resultSet, context, expr, state);
      } else if (expr.function === 'count') {
        agg = field.generateCountFragment(resultSet, context, expr, state);
      } else if (
        expr.function === 'min' ||
        expr.function === 'max' ||
        expr.function === 'distinct'
      ) {
        agg = field.generateSymmetricFragment(resultSet, context, expr, state);
      } else {
        throw new Error(
          `Internal Error: Unknown aggregate function ${expr.function}`
        );
      }
      if (resultSet.root().isComplexQuery) {
        let groupSet = resultSet.groupSet;
        if (state.totalGroupSet !== -1) {
          groupSet = state.totalGroupSet;
        }
        return field.caseGroup([groupSet], agg);
      }
      return agg;
    }
    case 'function_parameter':
      throw new Error(
        'Internal Error: Function parameter fragment remaining during SQL generation'
      );
    case 'outputField':
      return field.generateOutputFieldFragment(resultSet, context, expr, state);
    case 'function_call':
      return generateFunctionCallExpression(
        field,
        resultSet,
        context,
        expr,
        state
      );
    case 'spread':
      return field.generateSpread(resultSet, context, expr, state);
    case 'source-reference':
      return field.generateSourceReference(resultSet, context, expr);
    case '+':
    case '-':
    case '*':
    case '%':
    case '/':
    case '>':
    case '<':
    case '>=':
    case '<=':
    case '=':
      return `${expr.kids.left.sql}${expr.node}${expr.kids.right.sql}`;
    // Malloy inequality comparisons always return a boolean
    case '!=': {
      const notEqual = `${expr.kids.left.sql}!=${expr.kids.right.sql}`;
      return `COALESCE(${notEqual},true)`;
    }
    case 'and':
    case 'or':
      return `${expr.kids.left.sql} ${expr.node} ${expr.kids.right.sql}`;
    case 'coalesce':
      return `COALESCE(${expr.kids.left.sql},${expr.kids.right.sql})`;
    case 'in': {
      const oneOf = expr.kids.oneOf.map(o => o.sql).join(',');
      return `${expr.kids.e.sql} ${expr.not ? 'NOT IN' : 'IN'} (${oneOf})`;
    }
    case 'like':
    case '!like': {
      const likeIt = expr.node === 'like' ? 'LIKE' : 'NOT LIKE';
      const compare =
        expr.kids.right.node === 'stringLiteral'
          ? field.parent.dialect.sqlLike(
              likeIt,
              expr.kids.left.sql ?? '',
              expr.kids.right.literal
            )
          : `${expr.kids.left.sql} ${likeIt} ${expr.kids.right.sql}`;
      return expr.node === 'like' ? compare : `COALESCE(${compare},true)`;
    }
    case '()':
      return `(${expr.e.sql})`;
    case 'not':
      // Malloy not operator always returns a boolean
      return `COALESCE(NOT ${expr.e.sql},TRUE)`;
    case 'unary-':
      return `-${expr.e.sql}`;
    case 'is-null':
      return `${expr.e.sql} IS NULL`;
    case 'is-not-null':
      return `${expr.e.sql} IS NOT NULL`;
    case 'true':
    case 'false':
      return expr.node;
    case 'null':
      return 'NULL';
    case 'case':
      return field.generateCaseSQL(expr);
    case '':
      return '';
    case 'filterCondition':
      // our child will be translated at the top of this function
      if (expr.e.sql) {
        expr.sql = expr.e.sql;
        return expr.sql;
      }
      return '';
    case 'functionDefaultOrderBy':
    case 'functionOrderBy':
      return '';
    // TODO: throw an error here; not simple because we call into this
    // code currently before the composite source is resolved in some cases
    case 'compositeField':
      return '{COMPOSITE_FIELD}';
    case 'filterMatch':
      return generateAppliedFilter(field, context, expr);
    case 'filterLiteral':
      return 'INTERNAL ERROR FILTER EXPRESSION VALUE SHOULD NOT BE USED';
    default:
      throw new Error(
        `Internal Error: Unknown expression node '${
          expr.node
        }' ${JSON.stringify(expr, undefined, 2)}`
      );
  }
}

function generateAppliedFilter(
  field: QueryField,
  context: QueryStruct,
  filterMatchExpr: FilterMatchExpr
): string {
  let filterExpr = filterMatchExpr.kids.filterExpr;
  while (filterExpr.node === '()') {
    filterExpr = filterExpr.e;
  }
  if (filterExpr.node === 'parameter') {
    const name = filterExpr.path[0];
    context.eventStream?.emit('source-argument-compiled', {name});
    const argument = context.arguments()[name];
    if (argument.value) {
      filterExpr = argument.value;
    } else {
      throw new Error(
        `Parameter ${name} was expected to be a filter expression`
      );
    }
  }
  if (filterExpr.node !== 'filterLiteral') {
    throw new Error(
      'Can only use filter expression literals or parameters as filter expressions'
    );
  }
  const filterSrc = filterExpr.filterSrc;
  let fParse: FilterParserResponse<FilterExpression>;
  switch (filterMatchExpr.dataType) {
    case 'string':
      fParse = StringFilterExpression.parse(filterSrc);
      break;
    case 'number':
      fParse = NumberFilterExpression.parse(filterSrc);
      break;
    case 'boolean':
      fParse = BooleanFilterExpression.parse(filterSrc);
      break;
    case 'date':
    case 'timestamp':
      fParse = TemporalFilterExpression.parse(filterSrc);
      break;
    default:
      throw new Error(`unsupported filter type ${filterMatchExpr.dataType}`);
  }
  if (fParse.log.length > 0) {
    throw new Error(`Filter expression parse error: ${fParse.log[0]}`);
  }

  return FilterCompilers.compile(
    filterMatchExpr.dataType,
    fParse.parsed,
    filterMatchExpr.kids.expr.sql || '',
    context.dialect
  );
}

// Helper functions for generateFunctionCallExpression
function getParameterMap(
  overload: FunctionOverloadDef,
  numArgs: number
): Map<string, {argIndexes: number[]; param: FunctionParameterDef}> {
  return new Map(
    overload.params.map((param, paramIndex) => {
      const argIndexes = param.isVariadic
        ? range(paramIndex, numArgs)
        : [paramIndex];
      return [param.name, {param, argIndexes}];
    })
  );
}

function expandFunctionCall(
  dialect: string,
  overload: FunctionOverloadDef,
  args: Expr[],
  orderBy: string | undefined,
  limit: string | undefined
) {
  function withCommas(es: Expr[]): SQLExprElement[] {
    const ret: SQLExprElement[] = [];
    for (let i = 0; i < es.length; ) {
      ret.push(es[i]);
      i += 1;
      if (i < es.length) {
        ret.push(',');
      }
    }
    return ret;
  }
  const paramMap = getParameterMap(overload, args.length);
  if (overload.dialect[dialect] === undefined) {
    throw new Error(`Function is not defined for '${dialect}' dialect`);
  }
  const expanded = exprMap(overload.dialect[dialect].e, fragment => {
    if (fragment.node === 'spread') {
      const param = fragment.e;
      if (param.node !== 'function_parameter') {
        throw new Error(
          'Invalid function definition. Argument to spread must be a function parameter.'
        );
      }
      const entry = paramMap.get(param.name);
      if (entry === undefined) {
        return fragment;
      }
      const spread = entry.argIndexes.map(argIndex => args[argIndex]);
      return composeSQLExpr(withCommas(spread));
    } else if (fragment.node === 'function_parameter') {
      const entry = paramMap.get(fragment.name);
      if (entry === undefined) {
        return fragment;
      } else if (entry.param.isVariadic) {
        const spread = entry.argIndexes.map(argIndex => args[argIndex]);
        return composeSQLExpr(withCommas(spread));
      } else {
        return args[entry.argIndexes[0]];
      }
    } else if (fragment.node === 'aggregate_order_by') {
      return orderBy
        ? composeSQLExpr([
            ` ${fragment.prefix ?? ''}${orderBy}${fragment.suffix ?? ''}`,
          ])
        : {node: ''};
    } else if (fragment.node === 'aggregate_limit') {
      return limit ? composeSQLExpr([` ${limit}`]) : {node: ''};
    }
    return fragment;
  });
  return expanded;
}

function getParamForArgIndex(params: FunctionParameterDef[], argIndex: number) {
  const prevVariadic = params.slice(0, argIndex).find(p => p.isVariadic);
  return prevVariadic ?? params[argIndex];
}

function generateAsymmetricStringAggExpression(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  value: Expr,
  separator: Expr | undefined,
  distinctKey: string,
  orderBy: FunctionOrderBy[] | undefined,
  dialectName: string,
  state: GenerateState
): string {
  if (orderBy) {
    throw new Error(
      `Function \`string_agg\` does not support fanning out with an order by in ${dialectName}`
    );
  }
  const valueSQL = field.generateDimFragment(resultSet, context, value, state);
  const separatorSQL = separator
    ? field.generateDimFragment(resultSet, context, separator, state)
    : '';

  return field.parent.dialect.sqlStringAggDistinct(
    distinctKey,
    valueSQL,
    separatorSQL
  );
}

function generateAnalyticFragment(
  field: QueryField,
  dialect: string,
  resultStruct: FieldInstanceResult,
  context: QueryStruct,
  expr: Expr,
  overload: FunctionOverloadDef,
  state: GenerateState,
  args: Expr[],
  partitionByFields?: string[],
  funcOrdering?: string
): string {
  const isComplex = resultStruct.root().isComplexQuery;
  const partitionFields = field.getAnalyticPartitions(
    resultStruct,
    partitionByFields
  );
  const allPartitions = [
    ...(isComplex ? ['group_set'] : []),
    ...partitionFields,
  ];
  const partitionBy =
    allPartitions.length > 0 ? `PARTITION BY ${allPartitions.join(', ')}` : '';

  let orderBy = funcOrdering ?? '';
  const dialectOverload = overload.dialect[dialect];
  if (!funcOrdering && dialectOverload.needsWindowOrderBy) {
    // calculate the ordering.
    const obSQL: string[] = [];
    let orderingField;
    const orderByDef =
      (resultStruct.firstSegment as QuerySegment).orderBy ||
      resultStruct.calculateDefaultOrderBy();
    for (const ordering of orderByDef) {
      if (typeof ordering.field === 'string') {
        orderingField = {
          name: ordering.field,
          fif: resultStruct.getField(ordering.field),
        };
      } else {
        orderingField = resultStruct.getFieldByNumber(ordering.field);
      }
      const exprType = orderingField.fif.f.fieldDef.expressionType;
      // TODO today we do not support ordering by analytic functions at all, so this works
      // but eventually we will, and this check will just want to ensure that the order field
      // isn't the same as the field we're currently compiling (otherwise we will loop infintely)
      if (expressionIsAnalytic(exprType)) {
        continue;
      }
      if (resultStruct.firstSegment.type === 'reduce') {
        const orderSQL = orderingField.fif.getAnalyticalSQL(false);
        // const orderSQL = this.generateDimFragment(resultSet, context, arg, state)
        obSQL.push(` ${orderSQL} ${ordering.dir || 'ASC'}`);
      } else if (resultStruct.firstSegment.type === 'project') {
        obSQL.push(
          ` ${orderingField.fif.f.generateExpression(resultStruct)} ${
            ordering.dir || 'ASC'
          }`
        );
      }
    }

    if (obSQL.length > 0) {
      orderBy = ' ' + field.parent.dialect.sqlOrderBy(obSQL, 'analytical');
    }
  }

  let between = '';
  if (dialectOverload.between) {
    const [preceding, following] = [
      dialectOverload.between.preceding,
      dialectOverload.between.following,
    ].map(value => {
      if (value === -1) {
        return 'UNBOUNDED';
      }
      if (typeof value === 'number') {
        return value;
      }
      const argIndex = overload.params.findIndex(param => param.name === value);
      const arg = args[argIndex];
      if (arg.node !== 'numberLiteral') {
        throw new Error('Invalid number of rows for window spec');
      }
      // TODO this does not handle float literals correctly
      return arg.literal;
    });
    between = `ROWS BETWEEN ${preceding} PRECEDING AND ${following} FOLLOWING`;
  }

  const funcSQL = exprToSQL(field, resultStruct, context, expr, state);

  let retExpr = `${funcSQL} OVER(${partitionBy} ${orderBy} ${between})`;
  if (isComplex) {
    retExpr = `CASE WHEN group_set=${resultStruct.groupSet} THEN ${retExpr} END`;
  }
  return retExpr;
}

export function generateFunctionCallExpression(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  frag: FunctionCallNode,
  state: GenerateState
): string {
  const overload = frag.overload;
  const args = frag.kids.args;
  const isSymmetric = frag.overload.isSymmetric ?? false;
  const distinctKey =
    expressionIsAggregate(overload.returnType.expressionType) &&
    !isSymmetric &&
    field.generateDistinctKeyIfNecessary(resultSet, context, frag.structPath);
  const aggregateLimit = frag.limit ? `LIMIT ${frag.limit}` : undefined;
  if (
    frag.name === 'string_agg' &&
    distinctKey &&
    !context.dialect.supportsAggDistinct &&
    context.dialect.name !== 'snowflake'
  ) {
    return generateAsymmetricStringAggExpression(
      field,
      resultSet,
      context,
      args[0],
      args[1],
      distinctKey,
      frag.kids.orderBy,
      context.dialect.name,
      state
    );
  }
  if (distinctKey) {
    if (!context.dialect.supportsAggDistinct) {
      throw new Error(
        `Function \`${frag.name}\` does not support fanning out in ${context.dialect.name}`
      );
    }
    const argsExpressions = args.map(arg => {
      return field.generateDimFragment(resultSet, context, arg, state);
    });
    const orderBys = frag.kids.orderBy ?? [];
    const orderByExpressions = orderBys.map(ob => {
      const defaultOrderByArgIndex =
        overload.dialect[context.dialect.name].defaultOrderByArgIndex ?? 0;
      const expr =
        ob.node === 'functionOrderBy' ? ob.e : args[defaultOrderByArgIndex];
      return field.generateDimFragment(resultSet, context, expr, state);
    });
    return context.dialect.sqlAggDistinct(
      distinctKey,
      [...argsExpressions, ...orderByExpressions],
      valNames => {
        const vals: Expr[] = valNames.map((v, i) => {
          // Special case: the argument is required to be literal, so we use the actual argument
          // rather than the packed value
          // TODO don't even pack the value in the first place
          if (i < args.length) {
            const param = getParamForArgIndex(overload.params, i);
            if (param.allowedTypes.every(t => isLiteral(t.evalSpace))) {
              return args[i];
            }
          }
          return composeSQLExpr([v]);
        });
        const newArgs = vals.slice(0, argsExpressions.length);
        const orderBy: FunctionOrderBy[] = vals
          .slice(argsExpressions.length)
          .map((e, i) => {
            return {node: 'functionOrderBy', e, dir: orderBys[i].dir};
          });
        const orderBySQL = field.getFunctionOrderBy(
          resultSet,
          context,
          state,
          orderBy,
          newArgs,
          overload
        );
        const funcCall = expandFunctionCall(
          context.dialect.name,
          overload,
          newArgs,
          orderBySQL,
          aggregateLimit
        );
        return exprToSQL(field, resultSet, context, funcCall, state);
      }
    );
  } else {
    const mappedArgs = expressionIsAggregate(overload.returnType.expressionType)
      ? args.map((arg, index) => {
          // TODO We assume that all arguments to this aggregate-returning function need to
          // have filters applied to them. This is not necessarily true in the general case,
          // e.g. in a function `avg_plus(a, b) = avg(a) + b` -- here, `b` should not be
          // be filtered. But since there aren't any aggregate functions like this in the
          // standard library we have planned, we ignore this for now.
          // Update: Now we apply this only to arguments whose parameter is not constant-requiring.
          // So in `string_agg(val, sep)`, `sep` does not get filters applied to it because
          // it must be constant
          const param = getParamForArgIndex(overload.params, index);
          // TODO technically this should probably look at _which_ allowed param type was matched
          // for this argument and see if that type is at most constant... but we lose type information
          // by this point in the compilation, so that info would have to be passed into the func call
          // fragment.
          return param.allowedTypes.every(t => isLiteral(t.evalSpace))
            ? arg
            : composeSQLExpr([
                field.generateDimFragment(resultSet, context, arg, state),
              ]);
        })
      : args;
    const orderBySql = frag.kids.orderBy
      ? field.getFunctionOrderBy(
          resultSet,
          context,
          state,
          frag.kids.orderBy,
          args,
          overload
        )
      : '';
    const funcCall: Expr = expandFunctionCall(
      context.dialect.name,
      overload,
      mappedArgs,
      orderBySql,
      aggregateLimit
    );

    if (expressionIsAnalytic(overload.returnType.expressionType)) {
      const extraPartitions = (frag.partitionBy ?? []).map(outputName => {
        return `(${resultSet.getField(outputName).getAnalyticalSQL(false)})`;
      });
      return generateAnalyticFragment(
        field,
        context.dialect.name,
        resultSet,
        context,
        funcCall,
        overload,
        state,
        args,
        extraPartitions,
        orderBySql
      );
    }
    return exprToSQL(field, resultSet, context, funcCall, state);
  }
}
