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
  FunctionOrderBy,
  AggregateExpr,
  SourceReferenceNode,
  CaseExpr,
  FilteredExpr,
  UngroupNode,
  SpreadExpr,
  ParameterNode,
  FilterCondition,
  AggregateFunctionType,
  FieldnameNode,
  TimestampUnit,
  TimeTruncExpr,
} from './malloy_types';

import {
  getIdentifier,
  isAtomic,
  mkTemporal,
  expressionIsAggregate,
  expressionIsCalculation,
  hasExpression,
} from './malloy_types';
import type {FieldInstanceResult, UngroupSet} from './field_instance';
import {AndChain} from './utils';
import type {Dialect} from '../dialect';
import {exprToSQL} from './expression_compiler';

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
      const ret = exprToSQL(
        this,
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
        yield exprToSQL(this, resultSet, context, expr, state);
      }
    }
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
      return exprToSQL(this, resultSet, context, argument.value, state);
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
        exprToSQL(this, resultSet, context, cond.e, state.withWhere())
      );
    }
    return exprToSQL(
      this,
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
    let dim = exprToSQL(this, resultSet, context, expr, state);
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

    const s = exprToSQL(
      this,
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
      return exprToSQL(this, resultSet, this.parent, this.fieldDef.e);
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
        const aliasValue = exprToSQL(
          this,
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
      return exprToSQL(this, resultSet, this.parent, truncated);
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
