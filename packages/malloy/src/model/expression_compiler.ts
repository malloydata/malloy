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
  hasExpression,
} from './malloy_types';
import type {
  Expr,
  FilterMatchExpr,
  FunctionCallNode,
  FunctionOverloadDef,
  FunctionParameterDef,
  FunctionOrderBy,
  QuerySegment,
  FieldnameNode,
  OutputFieldNode,
  GenericSQLExpr,
  FilteredExpr,
  UngroupNode,
  ParameterNode,
  SpreadExpr,
  AggregateExpr,
  SourceReferenceNode,
  CaseExpr,
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
import {
  sqlFullChildReference,
  type FieldInstanceResult,
  type FieldInstanceField,
  type UngroupSet,
} from './field_instance';
import {FilterCompilers} from './filter_compilers';
import type {SQLExprElement} from './utils';
import {
  exprMap,
  composeSQLExpr,
  range,
  AndChain,
  groupingKey,
  GenerateState,
  caseGroup,
} from './utils';
import {isBasicScalar} from './query_node';
import type {QueryStruct, QueryField} from './query_node';
import type {Dialect} from '../dialect';

const NUMERIC_DECIMAL_PRECISION = 9;

function sqlSumDistinct(
  dialect: Dialect,
  sqlExp: string,
  sqlDistintKey: string
) {
  const precision = 9;
  const uniqueInt = dialect.sqlSumDistinctHashedKey(sqlDistintKey);
  const multiplier = 10 ** (precision - NUMERIC_DECIMAL_PRECISION);
  const sumSQL = `
  (
    SUM(DISTINCT
      (CAST(ROUND(COALESCE(${sqlExp},0)*(${multiplier}*1.0), ${NUMERIC_DECIMAL_PRECISION}) AS ${dialect.defaultDecimalType}) +
      ${uniqueInt}
    ))
    -
     SUM(DISTINCT ${uniqueInt})
  )`;
  let ret = `(${sumSQL}/(${multiplier}*1.0))`;
  ret = `CAST(${ret} AS ${dialect.defaultNumberType})`;
  return ret;
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
      return generateFieldFragment(field, resultSet, context, expr, state);
    case 'parameter':
      return generateParameterFragment(field, resultSet, context, expr, state);
    case 'filteredExpr':
      return generateFilterFragment(field, resultSet, context, expr, state);
    case 'all':
    case 'exclude':
      return generateUngroupedFragment(field, resultSet, context, expr, state);
    case 'genericSQLExpr':
      return Array.from(
        stringsFromSQLExpression(field, resultSet, context, expr, state)
      ).join('');
    case 'aggregate': {
      let agg = '';
      if (expr.function === 'sum') {
        agg = generateSumFragment(field, resultSet, context, expr, state);
      } else if (expr.function === 'avg') {
        agg = generateAvgFragment(field, resultSet, context, expr, state);
      } else if (expr.function === 'count') {
        agg = generateCountFragment(field, resultSet, context, expr, state);
      } else if (
        expr.function === 'min' ||
        expr.function === 'max' ||
        expr.function === 'distinct'
      ) {
        agg = generateSymmetricFragment(field, resultSet, context, expr, state);
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
        return caseGroup([groupSet], agg);
      }
      return agg;
    }
    case 'function_parameter':
      throw new Error(
        'Internal Error: Function parameter fragment remaining during SQL generation'
      );
    case 'outputField':
      return generateOutputFieldFragment(
        field,
        resultSet,
        context,
        expr,
        state
      );
    case 'function_call':
      return generateFunctionCallExpression(
        field,
        resultSet,
        context,
        expr,
        state
      );
    case 'spread':
      return generateSpread(field, resultSet, context, expr, state);
    case 'source-reference':
      return generateSourceReference(field, resultSet, context, expr);
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
      return generateCaseSQL(field, expr);
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
  const valueSQL = generateDimFragment(field, resultSet, context, value, state);
  const separatorSQL = separator
    ? generateDimFragment(field, resultSet, context, separator, state)
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
  const partitionFields = getAnalyticPartitions(
    field,
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
    let orderingField: {name: string; fif: FieldInstanceField} | undefined;
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
      if ('expressionType' in orderingField.fif.f.fieldDef) {
        const exprType = orderingField.fif.f.fieldDef['expressionType'];
        // TODO today we do not support ordering by analytic functions at all, so this works
        // but eventually we will, and this check will just want to ensure that the order field
        // isn't the same as the field we're currently compiling (otherwise we will loop infintely)
        if (expressionIsAnalytic(exprType)) {
          continue;
        }
      }
      if (resultStruct.firstSegment.type === 'reduce') {
        const orderSQL = orderingField.fif.getAnalyticalSQL(false);
        // const orderSQL = this.generateDimFragment(resultSet, context, arg, state)
        obSQL.push(` ${orderSQL} ${ordering.dir || 'ASC'}`);
      } else if (resultStruct.firstSegment.type === 'project') {
        // Verify that the field's parent result structure matches what we expect
        if (orderingField.fif.parent !== resultStruct) {
          throw new Error(
            `Field instance parent mismatch: field '${orderingField.name}' has parent from different result structure. ` +
              'This likely means the field is from a previous pipeline stage and needs special handling.'
          );
        }
        const orderSQL = orderingField.fif.generateExpression();
        obSQL.push(` ${orderSQL} ${ordering.dir || 'ASC'}`);
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
    generateDistinctKeyIfNecessary(field, resultSet, context, frag.structPath);
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
      return generateDimFragment(field, resultSet, context, arg, state);
    });
    const orderBys = frag.kids.orderBy ?? [];
    const orderByExpressions = orderBys.map(ob => {
      const defaultOrderByArgIndex =
        overload.dialect[context.dialect.name].defaultOrderByArgIndex ?? 0;
      const expr =
        ob.node === 'functionOrderBy' ? ob.e : args[defaultOrderByArgIndex];
      return generateDimFragment(field, resultSet, context, expr, state);
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
        const orderBySQL = getFunctionOrderBy(
          field,
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
                generateDimFragment(field, resultSet, context, arg, state),
              ]);
        })
      : args;
    const orderBySql = frag.kids.orderBy
      ? getFunctionOrderBy(
          field,
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

export function generateFieldFragment(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  expr: FieldnameNode,
  state: GenerateState
): string {
  // find the structDef and return the path to the field...
  const fieldRef = context.getFieldByName(expr.path);
  if (hasExpression(fieldRef.fieldDef)) {
    const ret = exprToSQL(
      field,
      resultSet,
      fieldRef.parent,
      fieldRef.fieldDef.e,
      state
    );
    return `(${ret})`;
  } else {
    // Instead of calling FieldInstanceFeild.generateExpression, which will just call back here
    // copy what that would do ..

    // Check for distinct key by its characteristic properties
    if (
      fieldRef.fieldDef.type === 'string' &&
      fieldRef.fieldDef.name === '__distinct_key'
    ) {
      return generateDistinctKeySQL(fieldRef, resultSet);
    }

    // The normal case - just generate the SQL reference
    return sqlFullChildReference(
      fieldRef.parent,
      fieldRef.fieldDef.name,
      fieldRef.parent.structDef.type === 'record'
        ? {
            result: resultSet,
            field: fieldRef,
          }
        : undefined
    );
  }
}

export function generateOutputFieldFragment(
  field: QueryField,
  resultSet: FieldInstanceResult,
  _context: QueryStruct,
  frag: OutputFieldNode,
  _state: GenerateState
): string {
  return `(${resultSet.getField(frag.name).getAnalyticalSQL(false)})`;
}

export function generateParameterFragment(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  expr: ParameterNode,
  state: GenerateState
): string {
  const name = expr.path[0];
  context.eventStream?.emit('source-argument-compiled', {name});
  const argument = context.arguments()[name];
  if (argument.value) {
    return exprToSQL(field, resultSet, context, argument.value, state);
  }
  throw new Error(`Can't generate SQL, no value for ${expr.path}`);
}

export function generateFilterFragment(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  expr: FilteredExpr,
  state: GenerateState
): string {
  const allWhere = new AndChain(state.whereSQL);
  for (const cond of expr.kids.filterList) {
    allWhere.add(
      exprToSQL(field, resultSet, context, cond.e, state.withWhere())
    );
  }
  return exprToSQL(
    field,
    resultSet,
    context,
    expr.kids.e,
    state.withWhere(allWhere.sql())
  );
}

export function generateDimFragment(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  expr: Expr,
  state: GenerateState
): string {
  let dim = exprToSQL(field, resultSet, context, expr, state);
  if (state.whereSQL) {
    dim = `CASE WHEN ${state.whereSQL} THEN ${dim} END`;
  }
  return dim;
}

export function generateUngroupedFragment(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  expr: UngroupNode,
  state: GenerateState
): string {
  if (state.totalGroupSet !== -1) {
    throw new Error('Already in ALL.  Cannot nest within an all calcuation.');
  }

  let totalGroupSet;
  let ungroupSet: UngroupSet | undefined;

  if (expr.fields && expr.fields.length > 0) {
    const key = groupingKey(expr.node, expr.fields);
    ungroupSet = resultSet.ungroupedSets.get(key);
    if (ungroupSet === undefined) {
      throw new Error(`Internal Error, cannot find groupset with key ${key}`);
    }
    totalGroupSet = ungroupSet.groupSet;
  } else {
    totalGroupSet = resultSet.parent ? resultSet.parent.groupSet : 0;
  }

  const s = exprToSQL(
    field,
    resultSet,
    context,
    expr.e,
    state.withTotal(totalGroupSet)
  );

  const fields = resultSet.getUngroupPartitions(ungroupSet);

  let partitionBy = '';
  const fieldsString = fields.map(f => f.getAnalyticalSQL(true)).join(', ');
  if (fieldsString.length > 0) {
    partitionBy = `PARTITION BY ${fieldsString}`;
  }
  return `MAX(${s}) OVER (${partitionBy})`;
}

function getDistinctKeySQL(
  struct: QueryStruct,
  resultSet: FieldInstanceResult
): string {
  const distinctKeyField = struct.getDistinctKey();
  return generateDistinctKeySQL(distinctKeyField, resultSet);
}

export function generateDistinctKeyIfNecessary(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  structPath: string[] | undefined
): string | undefined {
  let struct = context;
  if (structPath) {
    struct = field.parent.getStructByName(structPath);
  }
  if (needsSymetricCalculation(struct, resultSet)) {
    return getDistinctKeySQL(struct, resultSet);
  } else {
    return undefined;
  }
}

export function generateSumFragment(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  expr: AggregateExpr,
  state: GenerateState
): string {
  const dimSQL = generateDimFragment(field, resultSet, context, expr.e, state);
  const distinctKeySQL = generateDistinctKeyIfNecessary(
    field,
    resultSet,
    context,
    expr.structPath
  );
  let ret;
  if (distinctKeySQL) {
    if (field.parent.dialect.supportsSumDistinctFunction) {
      ret = field.parent.dialect.sqlSumDistinct(distinctKeySQL, dimSQL, 'SUM');
    } else {
      ret = sqlSumDistinct(field.parent.dialect, dimSQL, distinctKeySQL);
    }
  } else {
    ret = `SUM(${dimSQL})`;
  }
  return `COALESCE(${ret},0)`;
}

export function generateSymmetricFragment(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  expr: AggregateExpr,
  state: GenerateState
): string {
  const dimSQL = generateDimFragment(field, resultSet, context, expr.e, state);
  const f =
    expr.function === 'distinct' ? 'count(distinct ' : expr.function + '(';
  return `${f}${dimSQL})`;
}

export function generateAvgFragment(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  expr: AggregateExpr,
  state: GenerateState
): string {
  const dimSQL = generateDimFragment(field, resultSet, context, expr.e, state);
  const distinctKeySQL = generateDistinctKeyIfNecessary(
    field,
    resultSet,
    context,
    expr.structPath
  );
  if (distinctKeySQL) {
    let countDistinctKeySQL = distinctKeySQL;
    if (state.whereSQL) {
      countDistinctKeySQL = `CASE WHEN ${state.whereSQL} THEN ${distinctKeySQL} END`;
    }
    let sumDistinctSQL;
    let avgDistinctSQL;
    if (field.parent.dialect.supportsSumDistinctFunction) {
      avgDistinctSQL = field.parent.dialect.sqlSumDistinct(
        distinctKeySQL,
        dimSQL,
        'AVG'
      );
    } else {
      sumDistinctSQL = sqlSumDistinct(
        field.parent.dialect,
        dimSQL,
        distinctKeySQL
      );
      avgDistinctSQL = `(${sumDistinctSQL})/NULLIF(COUNT(DISTINCT CASE WHEN ${dimSQL} IS NOT NULL THEN ${countDistinctKeySQL} END),0)`;
    }
    return avgDistinctSQL;
  } else {
    return `AVG(${dimSQL})`;
  }
}

export function generateCountFragment(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  expr: AggregateExpr,
  state: GenerateState
): string {
  let func = 'COUNT(';
  let thing = '1';

  let struct = context;
  if (expr.structPath) {
    struct = field.parent.getStructByName(expr.structPath);
  }
  const joinName = struct.getJoinableParent().getIdentifier();
  const join = resultSet.root().joins.get(joinName);
  if (!join) {
    throw new Error(`Join ${joinName} not found in result set`);
  }
  if (!join.leafiest || join.makeUniqueKey) {
    func = 'COUNT(DISTINCT ';
    thing = getDistinctKeySQL(struct, resultSet);
  }

  if (state.whereSQL) {
    return `${func}CASE WHEN ${state.whereSQL} THEN ${thing} END)`;
  } else {
    return `${func}${thing})`;
  }
}

export function generateSpread(
  field: QueryField,
  _resultSet: FieldInstanceResult,
  _context: QueryStruct,
  _frag: SpreadExpr,
  _state: GenerateState
): string {
  throw new Error(
    `Unexpanded spread encountered during SQL generation for ${field.getIdentifier()}`
  );
}

export function generateSourceReference(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  expr: SourceReferenceNode
): string {
  if (expr.path === undefined) {
    return context.getSQLIdentifier();
  } else {
    return context.getFieldByName(expr.path).getIdentifier();
  }
}

export function generateCaseSQL(field: QueryField, pf: CaseExpr): string {
  const caseStmt = ['CASE'];
  if (pf.kids.caseValue !== undefined) {
    caseStmt.push(`${pf.kids.caseValue.sql}`);
  }
  for (let i = 0; i < pf.kids.caseWhen.length; i += 1) {
    caseStmt.push(
      `WHEN ${pf.kids.caseWhen[i].sql} THEN ${pf.kids.caseThen[i].sql}`
    );
  }
  if (pf.kids.caseElse !== undefined) {
    caseStmt.push(`ELSE ${pf.kids.caseElse.sql}`);
  }
  caseStmt.push('END');
  return caseStmt.join(' ');
}

export function getFunctionOrderBy(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  state: GenerateState,
  orderBy: FunctionOrderBy[],
  args: Expr[],
  overload: FunctionOverloadDef
): string | undefined {
  if (orderBy.length === 0) return undefined;
  return (
    'ORDER BY ' +
    orderBy
      .map(ob => {
        const defaultOrderByArgIndex =
          overload.dialect[context.dialect.name].defaultOrderByArgIndex ?? 0;
        const expr =
          ob.node === 'functionOrderBy' ? ob.e : args[defaultOrderByArgIndex];
        const osql = generateDimFragment(
          field,
          resultSet,
          context,
          expr,
          state
        );
        const dirsql =
          ob.dir === 'asc' ? ' ASC' : ob.dir === 'desc' ? ' DESC' : '';
        return `${osql}${dirsql}`;
      })
      .join(', ')
  );
}

export function getAnalyticPartitions(
  field: QueryField,
  resultStruct: FieldInstanceResult,
  extraPartitionFields?: string[]
): string[] {
  const ret: string[] = [];
  let p = resultStruct.parent;
  while (p !== undefined) {
    const scalars = p.fields(
      fi => isBasicScalar(fi.f) && fi.fieldUsage.type === 'result'
    );
    const partitionSQLs = scalars.map(fi => fi.getAnalyticalSQL(true));
    ret.push(...partitionSQLs);
    p = p.parent;
  }
  if (extraPartitionFields) {
    ret.push(...extraPartitionFields);
  }
  return ret;
}

export function* stringsFromSQLExpression(
  field: QueryField,
  resultSet: FieldInstanceResult,
  context: QueryStruct,
  e: GenericSQLExpr,
  state: GenerateState
): Generator<string, void, unknown> {
  /*
   * Like template strings, the array of strings is paired with template insertions,
   * each string is followed by at most one expression to be inserted
   */
  const subExprList = [...e.kids.args];
  for (const str of e.src) {
    yield str;
    const expr = subExprList.shift();
    if (expr) {
      yield exprToSQL(field, resultSet, context, expr, state);
    }
  }
}

// Add this function to expression_compiler.ts

function generateDistinctKeySQL(
  fieldRef: QueryField,
  resultSet: FieldInstanceResult
): string {
  const parent = fieldRef.parent;

  if (parent.primaryKey()) {
    const pk = parent.getPrimaryKeyField(fieldRef.fieldDef);
    // Recursively generate the primary key SQL
    return generateFieldFragment(
      fieldRef, // Use fieldRef as the field parameter
      resultSet,
      parent,
      {node: 'field', path: [pk.getIdentifier()]},
      new GenerateState()
    );
  } else if (parent.structDef.type === 'array') {
    const parentDistinctKey = parent.parent?.getDistinctKey();
    let parentKeySQL = '';
    if (parentDistinctKey && parent.parent) {
      parentKeySQL = generateFieldFragment(
        fieldRef, // Use fieldRef as the field parameter
        resultSet,
        parent.parent,
        {node: 'field', path: ['__distinct_key']},
        new GenerateState()
      );
    }
    return parent.dialect.sqlMakeUnnestKey(
      parentKeySQL,
      parent.dialect.sqlFieldReference(
        parent.getIdentifier(),
        'table',
        '__row_id',
        'string'
      )
    );
  } else {
    return parent.dialect.sqlFieldReference(
      parent.getIdentifier(),
      'table',
      '__distinct_key',
      'string'
    );
  }
}

function needsSymetricCalculation(
  qs: QueryStruct,
  resultSet: FieldInstanceResult
): boolean {
  const joinName = qs.getJoinableParent().getIdentifier();
  const join = resultSet.root().joins.get(joinName);
  if (join) {
    return !join.leafiest;
  }
  throw new Error(`Join ${joinName} not found in result set`);
}
