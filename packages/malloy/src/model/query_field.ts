/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {v4 as uuidv4} from 'uuid';
import type {QueryStruct, QueryStructParams} from './query_struct';
import type {
  FieldDef,
  BooleanFieldDef,
  DateFieldDef,
  StringFieldDef,
  JSONFieldDef,
  NumberFieldDef,
  TimestampFieldDef,
  NativeUnsupportedFieldDef,
  JoinFieldDef,
  DateUnit,
  Expr,
  Argument,
  PrepareResultOptions,
  AtomicFieldDef,
  BasicAtomicDef,
  OutputFieldNode,
  GenericSQLExpr,
  FunctionOverloadDef,
  FunctionParameterDef,
  FunctionOrderBy,
  AggregateExpr,
  SourceReferenceNode,
  CaseExpr,
  FilteredExpr,
  UngroupNode,
  FunctionCallNode,
  SpreadExpr,
  ParameterNode,
  FilterMatchExpr,
  FilterCondition,
  QuerySegment,
  AggregateFunctionType,
  FieldnameNode,
  TimestampUnit,
  TimeTruncExpr,
} from './malloy_types';

import {
  getIdentifier,
  isAtomic,
  mkTemporal,
  expressionIsAnalytic,
  isLiteral,
  exprHasKids,
  exprHasE,
  expressionIsAggregate,
  expressionIsCalculation,
  hasExpression,
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
import type {FieldInstanceResult, UngroupSet} from './field_instance';
import {FilterCompilers} from './filter_compilers';
import type {SQLExprElement} from './utils';
import {exprMap, composeSQLExpr, AndChain, range} from './utils';
import type {Dialect} from '../dialect';

export type UniqueKeyPossibleUse =
  | AggregateFunctionType
  | 'generic_asymmetric_aggregate';

export class UniqueKeyUse extends Set<UniqueKeyPossibleUse> {
  add_use(k: UniqueKeyPossibleUse | undefined) {
    if (k !== undefined) {
      return this.add(k);
    }
  }

  hasAsymetricFunctions(): boolean {
    return (
      this.has('sum') ||
      this.has('avg') ||
      this.has('count') ||
      this.has('generic_asymmetric_aggregate')
    );
  }
}

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
// Factory function type
export type QueryStructFactory = (...args: QueryStructParams) => QueryStruct;

export abstract class QueryNode {
  readonly referenceId: string;
  constructor(referenceId?: string) {
    this.referenceId = referenceId ?? uuidv4();
  }
  abstract getIdentifier(): string;
  getChildByName(_name: string): QueryField | undefined {
    return undefined;
  }
}

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

export class QueryField extends QueryNode {
  fieldDef: FieldDef;
  parent: QueryStruct;

  constructor(fieldDef: FieldDef, parent: QueryStruct, referenceId?: string) {
    super(referenceId);
    this.fieldDef = fieldDef;
    this.parent = parent;
    this.fieldDef = fieldDef;
  }

  getIdentifier() {
    return getIdentifier(this.fieldDef);
  }

  uniqueKeyPossibleUse(): UniqueKeyPossibleUse | undefined {
    return undefined;
  }

  getJoinableParent(): QueryStruct {
    const parent = this.parent;
    if (parent.structDef.type === 'record') {
      return parent.getJoinableParent();
    }
    return parent;
  }

  isAtomic() {
    return isAtomic(this.fieldDef);
  }

  caseGroup(groupSets: number[], s: string): string {
    if (groupSets.length === 0) {
      return s;
    } else {
      const exp =
        groupSets.length === 1
          ? `=${groupSets[0]}`
          : ` IN (${groupSets.join(',')})`;
      return `CASE WHEN group_set${exp} THEN\n  ${s}\n  END`;
    }
  }

  getFullOutputName() {
    return this.parent.getFullOutputName() + this.getIdentifier();
  }

  generateFieldFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: FieldnameNode,
    state: GenerateState
  ): string {
    // find the structDef and return the path to the field...
    const field = context.getFieldByName(expr.path);
    if (hasExpression(field.fieldDef)) {
      const ret = this.exprToSQL(
        resultSet,
        field.parent,
        field.fieldDef.e,
        state
      );
      // in order to avoid too many parens, there was some code here ..
      // if (!ret.match(/^\(.*\)$/)) {
      //   ret = `(${ret})`;
      // }
      // but this  failed when the expresion was (bool1)or(bool2)
      // there could maybe be a smarter parse of the expression to avoid
      // an extra paren, but correctness first, beauty AND correctness later
      return `(${ret})`;
    } else {
      // return field.parent.getIdentifier() + "." + field.fieldDef.name;
      return field.generateExpression(resultSet);
    }
  }

  generateOutputFieldFragment(
    resultSet: FieldInstanceResult,
    _context: QueryStruct,
    frag: OutputFieldNode,
    _state: GenerateState
  ): string {
    return `(${resultSet.getField(frag.name).getAnalyticalSQL(false)})`;
  }

  *stringsFromSQLExpression(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    e: GenericSQLExpr,
    state: GenerateState
  ) {
    /*
     * Like template strings, the array of strings is paired with template insertions,
     * each string is followed by at most one expression to be inserted
     */
    const subExprList = [...e.kids.args];
    for (const str of e.src) {
      yield str;
      const expr = subExprList.shift();
      if (expr) {
        yield this.exprToSQL(resultSet, context, expr, state);
      }
    }
  }

  private getParameterMap(
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

  private expandFunctionCall(
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
    const paramMap = this.getParameterMap(overload, args.length);
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

  getFunctionOrderBy(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    state: GenerateState,
    orderBy: FunctionOrderBy[],
    args: Expr[],
    overload: FunctionOverloadDef
  ) {
    if (orderBy.length === 0) return undefined;
    return (
      'ORDER BY ' +
      orderBy
        .map(ob => {
          const defaultOrderByArgIndex =
            overload.dialect[context.dialect.name].defaultOrderByArgIndex ?? 0;
          const expr =
            ob.node === 'functionOrderBy' ? ob.e : args[defaultOrderByArgIndex];
          const osql = this.generateDimFragment(
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

  generateAsymmetricStringAggExpression(
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
    const valueSQL = this.generateDimFragment(resultSet, context, value, state);
    const separatorSQL = separator
      ? this.generateDimFragment(resultSet, context, separator, state)
      : '';

    return this.parent.dialect.sqlStringAggDistinct(
      distinctKey,
      valueSQL,
      separatorSQL
    );
  }

  getParamForArgIndex(params: FunctionParameterDef[], argIndex: number) {
    const prevVariadic = params.slice(0, argIndex).find(p => p.isVariadic);
    return prevVariadic ?? params[argIndex];
  }

  generateFunctionCallExpression(
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
      this.generateDistinctKeyIfNecessary(resultSet, context, frag.structPath);
    const aggregateLimit = frag.limit ? `LIMIT ${frag.limit}` : undefined;
    if (
      frag.name === 'string_agg' &&
      distinctKey &&
      !context.dialect.supportsAggDistinct &&
      context.dialect.name !== 'snowflake'
    ) {
      return this.generateAsymmetricStringAggExpression(
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
        return this.generateDimFragment(resultSet, context, arg, state);
      });
      const orderBys = frag.kids.orderBy ?? [];
      const orderByExpressions = orderBys.map(ob => {
        const defaultOrderByArgIndex =
          overload.dialect[context.dialect.name].defaultOrderByArgIndex ?? 0;
        const expr =
          ob.node === 'functionOrderBy' ? ob.e : args[defaultOrderByArgIndex];
        return this.generateDimFragment(resultSet, context, expr, state);
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
              const param = this.getParamForArgIndex(overload.params, i);
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
          const orderBySQL = this.getFunctionOrderBy(
            resultSet,
            context,
            state,
            orderBy,
            newArgs,
            overload
          );
          const funcCall = this.expandFunctionCall(
            context.dialect.name,
            overload,
            newArgs,
            orderBySQL,
            aggregateLimit
          );
          return this.exprToSQL(resultSet, context, funcCall, state);
        }
      );
    } else {
      const mappedArgs = expressionIsAggregate(
        overload.returnType.expressionType
      )
        ? args.map((arg, index) => {
            // TODO We assume that all arguments to this aggregate-returning function need to
            // have filters applied to them. This is not necessarily true in the general case,
            // e.g. in a function `avg_plus(a, b) = avg(a) + b` -- here, `b` should not be
            // be filtered. But since there aren't any aggregate functions like this in the
            // standard library we have planned, we ignore this for now.
            // Update: Now we apply this only to arguments whose parameter is not constant-requiring.
            // So in `string_agg(val, sep)`, `sep` does not get filters applied to it because
            // it must be constant
            const param = this.getParamForArgIndex(overload.params, index);
            // TODO technically this should probably look at _which_ allowed param type was matched
            // for this argument and see if that type is at most constant... but we lose type information
            // by this point in the compilation, so that info would have to be passed into the func call
            // fragment.
            return param.allowedTypes.every(t => isLiteral(t.evalSpace))
              ? arg
              : composeSQLExpr([
                  this.generateDimFragment(resultSet, context, arg, state),
                ]);
          })
        : args;
      const orderBySql = frag.kids.orderBy
        ? this.getFunctionOrderBy(
            resultSet,
            context,
            state,
            frag.kids.orderBy,
            args,
            overload
          )
        : '';
      const funcCall: Expr = this.expandFunctionCall(
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
        return this.generateAnalyticFragment(
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
      return this.exprToSQL(resultSet, context, funcCall, state);
    }
  }

  generateSpread(
    _resultSet: FieldInstanceResult,
    _context: QueryStruct,
    _frag: SpreadExpr,
    _state: GenerateState
  ): string {
    throw new Error('Unexpanded spread encountered during SQL generation');
  }

  generateParameterFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: ParameterNode,
    state: GenerateState
  ): string {
    const name = expr.path[0];
    context.eventStream?.emit('source-argument-compiled', {name});
    const argument = context.arguments()[name];
    if (argument.value) {
      return this.exprToSQL(resultSet, context, argument.value, state);
    }
    throw new Error(`Can't generate SQL, no value for ${expr.path}`);
  }

  generateFilterFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: FilteredExpr,
    state: GenerateState
  ): string {
    const allWhere = new AndChain(state.whereSQL);
    for (const cond of expr.kids.filterList) {
      allWhere.add(
        this.exprToSQL(resultSet, context, cond.e, state.withWhere())
      );
    }
    return this.exprToSQL(
      resultSet,
      context,
      expr.kids.e,
      state.withWhere(allWhere.sql())
    );
  }

  generateDimFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: Expr,
    state: GenerateState
  ): string {
    let dim = this.exprToSQL(resultSet, context, expr, state);
    if (state.whereSQL) {
      dim = `CASE WHEN ${state.whereSQL} THEN ${dim} END`;
    }
    return dim;
  }

  generateUngroupedFragment(
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
      const key = expr.fields.sort().join('|') + expr.node;
      ungroupSet = resultSet.ungroupedSets.get(key);
      if (ungroupSet === undefined) {
        throw new Error(`Internal Error, cannot find groupset with key ${key}`);
      }
      totalGroupSet = ungroupSet.groupSet;
    } else {
      totalGroupSet = resultSet.parent ? resultSet.parent.groupSet : 0;
    }

    const s = this.exprToSQL(
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

  generateDistinctKeyIfNecessary(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    structPath: string[] | undefined
  ): string | undefined {
    let struct = context;
    if (structPath) {
      struct = this.parent.root().getStructByName(structPath);
    }
    if (struct.needsSymetricCalculation(resultSet)) {
      return struct.getDistinctKey().generateExpression(resultSet);
    } else {
      return undefined;
    }
  }

  generateSumFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateExpr,
    state: GenerateState
  ): string {
    const dimSQL = this.generateDimFragment(resultSet, context, expr.e, state);
    const distinctKeySQL = this.generateDistinctKeyIfNecessary(
      resultSet,
      context,
      expr.structPath
    );
    let ret;
    if (distinctKeySQL) {
      if (this.parent.dialect.supportsSumDistinctFunction) {
        ret = this.parent.dialect.sqlSumDistinct(distinctKeySQL, dimSQL, 'SUM');
      } else {
        ret = sqlSumDistinct(this.parent.dialect, dimSQL, distinctKeySQL);
      }
    } else {
      ret = `SUM(${dimSQL})`;
    }
    return `COALESCE(${ret},0)`;
  }

  generateSymmetricFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateExpr,
    state: GenerateState
  ): string {
    const dimSQL = this.generateDimFragment(resultSet, context, expr.e, state);
    const f =
      expr.function === 'distinct' ? 'count(distinct ' : expr.function + '(';
    return `${f}${dimSQL})`;
  }

  generateAvgFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateExpr,
    state: GenerateState
  ): string {
    // find the structDef and return the path to the field...
    const dimSQL = this.generateDimFragment(resultSet, context, expr.e, state);
    const distinctKeySQL = this.generateDistinctKeyIfNecessary(
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
      if (this.parent.dialect.supportsSumDistinctFunction) {
        avgDistinctSQL = this.parent.dialect.sqlSumDistinct(
          distinctKeySQL,
          dimSQL,
          'AVG'
        );
      } else {
        sumDistinctSQL = sqlSumDistinct(
          this.parent.dialect,
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

  generateCountFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateExpr,
    state: GenerateState
  ): string {
    let func = 'COUNT(';
    let thing = '1';

    let struct = context;
    if (expr.structPath) {
      struct = this.parent.root().getStructByName(expr.structPath);
    }
    const joinName = struct.getJoinableParent().getIdentifier();
    const join = resultSet.root().joins.get(joinName);
    if (!join) {
      throw new Error(`Join ${joinName} not found in result set`);
    }
    if (!join.leafiest || join.makeUniqueKey) {
      func = 'COUNT(DISTINCT ';
      thing = struct.getDistinctKey().generateExpression(resultSet);
    }

    // const distinctKeySQL = this.generateDistinctKeyIfNecessary(
    //   resultSet,
    //   context,
    //   expr.structPath
    // );
    // if (distinctKeySQL) {
    //   func = 'COUNT(DISTINCT';
    //   thing = distinctKeySQL;
    // }

    // find the structDef and return the path to the field...
    if (state.whereSQL) {
      return `${func}CASE WHEN ${state.whereSQL} THEN ${thing} END)`;
    } else {
      return `${func}${thing})`;
    }
  }

  generateSourceReference(
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

  getAnalyticPartitions(
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

  generateAnalyticFragment(
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
    const partitionFields = this.getAnalyticPartitions(
      resultStruct,
      partitionByFields
    );
    const allPartitions = [
      ...(isComplex ? ['group_set'] : []),
      ...partitionFields,
    ];
    const partitionBy =
      allPartitions.length > 0
        ? `PARTITION BY ${allPartitions.join(', ')}`
        : '';

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
        orderBy = ' ' + this.parent.dialect.sqlOrderBy(obSQL, 'analytical');
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
        const argIndex = overload.params.findIndex(
          param => param.name === value
        );
        const arg = args[argIndex];
        if (arg.node !== 'numberLiteral') {
          throw new Error('Invalid number of rows for window spec');
        }
        // TODO this does not handle float literals correctly
        return arg.literal;
      });
      between = `ROWS BETWEEN ${preceding} PRECEDING AND ${following} FOLLOWING`;
    }

    const funcSQL = this.exprToSQL(resultStruct, context, expr, state);

    let retExpr = `${funcSQL} OVER(${partitionBy} ${orderBy} ${between})`;
    if (isComplex) {
      retExpr = `CASE WHEN group_set=${resultStruct.groupSet} THEN ${retExpr} END`;
    }
    return retExpr;
  }

  generateCaseSQL(pf: CaseExpr): string {
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

  exprToSQL(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    exprToTranslate: Expr,
    state: GenerateState = new GenerateState()
  ): string {
    // Wrap non leaf sub expressions in parenthesis
    const subExpr = function (qf: QueryField, e: Expr) {
      const sql = qf.exprToSQL(resultSet, context, e, state);
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
      const eSql = subExpr(this, expr.e);
      expr.e = {...expr.e, sql: eSql};
    } else if (exprHasKids(exprToTranslate)) {
      expr = {...exprToTranslate};
      const oldKids = exprToTranslate.kids;
      for (const [name, kidExpr] of Object.entries(oldKids)) {
        if (kidExpr === null) continue;
        if (Array.isArray(kidExpr)) {
          expr.kids[name] = kidExpr.map(e => {
            return {...e, sql: subExpr(this, e)};
          });
        } else {
          expr.kids[name] = {...oldKids[name], sql: subExpr(this, kidExpr)};
        }
      }
    }

    /*
     * Give the dialect a chance to translate this node
     */
    const qi = resultSet.getQueryInfo();
    const dialectSQL = this.parent.dialect.exprToSQL(qi, expr);
    if (dialectSQL) {
      return dialectSQL;
    }

    switch (expr.node) {
      case 'field':
        return this.generateFieldFragment(resultSet, context, expr, state);
      case 'parameter':
        return this.generateParameterFragment(resultSet, context, expr, state);
      case 'filteredExpr':
        return this.generateFilterFragment(resultSet, context, expr, state);
      case 'all':
      case 'exclude':
        return this.generateUngroupedFragment(resultSet, context, expr, state);
      case 'genericSQLExpr':
        return Array.from(
          this.stringsFromSQLExpression(resultSet, context, expr, state)
        ).join('');
      case 'aggregate': {
        let agg = '';
        if (expr.function === 'sum') {
          agg = this.generateSumFragment(resultSet, context, expr, state);
        } else if (expr.function === 'avg') {
          agg = this.generateAvgFragment(resultSet, context, expr, state);
        } else if (expr.function === 'count') {
          agg = this.generateCountFragment(resultSet, context, expr, state);
        } else if (
          expr.function === 'min' ||
          expr.function === 'max' ||
          expr.function === 'distinct'
        ) {
          agg = this.generateSymmetricFragment(resultSet, context, expr, state);
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
          return this.caseGroup([groupSet], agg);
        }
        return agg;
      }
      case 'function_parameter':
        throw new Error(
          'Internal Error: Function parameter fragment remaining during SQL generation'
        );
      case 'outputField':
        return this.generateOutputFieldFragment(
          resultSet,
          context,
          expr,
          state
        );
      case 'function_call':
        return this.generateFunctionCallExpression(
          resultSet,
          context,
          expr,
          state
        );
      case 'spread':
        return this.generateSpread(resultSet, context, expr, state);
      case 'source-reference':
        return this.generateSourceReference(resultSet, context, expr);
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
            ? this.parent.dialect.sqlLike(
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
        return this.generateCaseSQL(expr);
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
        return this.generateAppliedFilter(context, expr);
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

  generateAppliedFilter(
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

  isNestedInParent(parentDef: FieldDef) {
    switch (parentDef.type) {
      case 'record':
      case 'array':
        return true;
        return true;
      default:
        return false;
    }
  }

  isArrayElement(parentDef: FieldDef) {
    return (
      parentDef.type === 'array' &&
      parentDef.elementTypeDef.type !== 'record_element'
    );
  }

  generateExpression(resultSet: FieldInstanceResult): string {
    // If the field itself is an expression, generate it ..
    if (hasExpression(this.fieldDef)) {
      return this.exprToSQL(resultSet, this.parent, this.fieldDef.e);
    }
    // The field itself is not an expression, so we would like
    // to generate a dotted path to the field, EXCEPT ...
    // some of the steps in the dotting might not exist
    // in the namespace of their parent, but rather be record
    // expressions which should be evaluated in the namespace
    // of their parent.

    // So we walk the tree and ask each one to compute itself
    for (
      let ancestor: QueryStruct | undefined = this.parent;
      ancestor !== undefined;
      ancestor = ancestor.parent
    ) {
      if (
        ancestor.structDef.type === 'record' &&
        hasExpression(ancestor.structDef) &&
        ancestor.recordAlias === undefined
      ) {
        if (!ancestor.parent) {
          throw new Error(
            'Inconcievable record ancestor with expression but no parent'
          );
        }
        const aliasValue = this.exprToSQL(
          resultSet,
          ancestor.parent,
          ancestor.structDef.e
        );
        ancestor.informOfAliasValue(aliasValue);
      }
    }
    return this.parent.sqlChildReference(
      this.fieldDef.name,
      this.parent.structDef.type === 'record'
        ? {
            result: resultSet,
            field: this,
          }
        : undefined
    );
  }

  includeInWildcard() {
    return false;
  }
}

export abstract class QueryAtomicField<
  T extends AtomicFieldDef,
> extends QueryField {
  fieldDef: T;

  constructor(fieldDef: T, parent: QueryStruct, refId?: string) {
    super(fieldDef, parent, refId);
    this.fieldDef = fieldDef; // wish I didn't have to do this
  }

  includeInWildcard(): boolean {
    return true;
  }

  getFilterList(): FilterCondition[] {
    return [];
  }
}

export class QueryFieldBoolean extends QueryAtomicField<BooleanFieldDef> {}

export class QueryFieldDate extends QueryAtomicField<DateFieldDef> {
  generateExpression(resultSet: FieldInstanceResult): string {
    const fd = this.fieldDef;
    const superExpr = super.generateExpression(resultSet);
    if (!fd.timeframe) {
      return superExpr;
    } else {
      const truncated: TimeTruncExpr = {
        node: 'trunc',
        e: mkTemporal(
          {node: 'genericSQLExpr', src: [superExpr], kids: {args: []}},
          'date'
        ),
        units: fd.timeframe,
      };
      return this.exprToSQL(resultSet, this.parent, truncated);
    }
  }

  // clone ourselves on demand as a timeframe.
  getChildByName(name: DateUnit): QueryFieldDate {
    const fieldDef: DateFieldDef = {
      ...this.fieldDef,
      as: `${this.getIdentifier()}_${name}`,
      timeframe: name,
    };
    return new QueryFieldDate(fieldDef, this.parent);
  }
}

export class QueryFieldDistinctKey extends QueryAtomicField<StringFieldDef> {
  generateExpression(resultSet: FieldInstanceResult): string {
    if (this.parent.primaryKey()) {
      const pk = this.parent.getPrimaryKeyField(this.fieldDef);
      return pk.generateExpression(resultSet);
    } else if (this.parent.structDef.type === 'array') {
      const parentKey = this.parent.parent
        ?.getDistinctKey()
        .generateExpression(resultSet);
      return this.parent.dialect.sqlMakeUnnestKey(
        parentKey || '', // shouldn't have to do this...
        this.parent.dialect.sqlFieldReference(
          this.parent.getIdentifier(),
          'table',
          '__row_id',
          'string'
        )
      );
    } else {
      // return this.parent.getIdentifier() + "." + "__distinct_key";
      return this.parent.dialect.sqlFieldReference(
        this.parent.getIdentifier(),
        'table',
        '__distinct_key',
        'string'
      );
    }
  }

  includeInWildcard(): boolean {
    return false;
  }
}

export class QueryFieldJSON extends QueryAtomicField<JSONFieldDef> {}

export class QueryFieldNumber extends QueryAtomicField<NumberFieldDef> {}

export class QueryFieldString extends QueryAtomicField<StringFieldDef> {}

/*
 * The input to a query will always be a QueryStruct. A QueryStruct is also a namespace
 * for tracking joins, and so a QueryFieldStruct is a QueryField which has a QueryStruct.
 *
 * This is a result of it being impossible to inherit both from QueryStruct and QueryField
 * for array and record types.
 */
export class QueryFieldStruct extends QueryField {
  queryStruct: QueryStruct;
  fieldDef: JoinFieldDef;
  constructor(
    private createQueryStruct: QueryStructFactory,
    jfd: JoinFieldDef,
    sourceArguments: Record<string, Argument> | undefined,
    parent: QueryStruct,
    prepareResultOptions: PrepareResultOptions,
    referenceId?: string
  ) {
    super(jfd, parent, referenceId);
    this.fieldDef = jfd;
    this.queryStruct = this.createQueryStruct(
      jfd,
      sourceArguments,
      {struct: parent},
      prepareResultOptions
    );
  }

  /*
   * Proxy the field-like methods that QueryStruct implements, eventually
   * those probably should be in here ... I thought this would be important
   * but maybe it isn't, it doesn't fix the problem I am working on ...
   */

  getJoinableParent() {
    return this.queryStruct.getJoinableParent();
  }

  getFullOutputName() {
    return this.queryStruct.getFullOutputName();
  }

  includeInWildcard(): boolean {
    return this.isAtomic();
  }
}

export class QueryFieldTimestamp extends QueryAtomicField<TimestampFieldDef> {
  // clone ourselves on demand as a timeframe.
  getChildByName(name: TimestampUnit): QueryFieldTimestamp {
    const fieldDef = {
      ...this.fieldDef,
      as: `${this.getIdentifier()}_${name}`,
      timeframe: name,
    };
    return new QueryFieldTimestamp(fieldDef, this.parent);
  }
}

export class QueryFieldUnsupported extends QueryAtomicField<NativeUnsupportedFieldDef> {}
/*
 * When compound (arrays, records) types became atomic types, it became unclear
 * which code wanted just "numbers and strings" and which code wanted anything
 * atomic.
 *
 * All of the original QueryFields are now members of "QueryBasicField"
 *
 * I think the re-factor for adding atomic compound types isn't done yet,
 * but things are working well enough now. A bug with nesting repeated
 * records revealed the need for isScalarField, but I was not brave
 * enough to look at all the calls is isBasicScalar.
 */
export type QueryBasicField = QueryAtomicField<BasicAtomicDef>;

// ============================================================================
// QueryField utility functions (consolidated from is_* files)
// ============================================================================

export function isAggregateField(f: QueryField): boolean {
  if (f.isAtomic() && hasExpression(f.fieldDef)) {
    return expressionIsAggregate(f.fieldDef.expressionType);
  }
  return false;
}

export function isCalculatedField(f: QueryField): boolean {
  if (f.isAtomic() && hasExpression(f.fieldDef)) {
    return expressionIsCalculation(f.fieldDef.expressionType);
  }
  return false;
}

export function isScalarField(f: QueryField): boolean {
  if (f.isAtomic()) {
    if (hasExpression(f.fieldDef)) {
      const et = f.fieldDef.expressionType;
      if (expressionIsCalculation(et) || expressionIsAggregate(et)) {
        return false;
      }
    }
    return true;
  }
  return false;
}

export function isBasicAggregate(f: QueryField): f is QueryBasicField {
  return f instanceof QueryAtomicField && isAggregateField(f);
}

export function isBasicCalculation(f: QueryField): f is QueryBasicField {
  return f instanceof QueryAtomicField && isCalculatedField(f);
}

export function isBasicScalar(f: QueryField): f is QueryBasicField {
  return f instanceof QueryAtomicField && isScalarField(f);
}
