/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FieldReferenceType, QueryInfo} from '../dialect';
import type {QueryStruct} from './query_node';
import type {
  Expr,
  OrderBy,
  PipeSegment,
  TurtleDef,
  UniqueKeyRequirement,
} from './malloy_types';
import {
  isIndexSegment,
  isRawSegment,
  isJoined,
  expressionIsAnalytic,
  hasExpression,
  isAtomic,
  mergeUniqueKeyRequirement,
  isTemporalType,
} from './malloy_types';
import {AndChain, caseGroup, type GenerateState} from './utils';
import {JoinInstance} from './join_instance';
import {
  isBasicAggregate,
  isBasicScalar,
  isScalarField,
  QueryFieldStruct,
  type QueryField,
} from './query_node';
import type * as Malloy from '@malloydata/malloy-interfaces';

type InstanceFieldUsage =
  | {
      type: 'result';
      resultIndex: number;
    }
  | {type: 'where'}
  | {type: 'dependant'};

export class FieldInstanceField implements FieldInstance {
  type: FieldInstanceType = 'field';
  additionalGroupSets: number[] = [];
  analyticalSQL: string | undefined; // the name of the field when used in a window function calculation.
  partitionSQL: string | undefined; // the name of the field when used as a partition.
  constructor(
    public f: QueryField,
    public fieldUsage: InstanceFieldUsage,
    public parent: FieldInstanceResult,
    public readonly drillExpression: Malloy.Expression | undefined
  ) {}

  root(): FieldInstanceResultRoot {
    return this.parent.root();
  }

  // Breaking circularity with query_field requires registratrion
  static exprCompiler?: (
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: Expr,
    state?: GenerateState
  ) => string;

  static registerExpressionCompiler(
    compiler: (
      resultSet: FieldInstanceResult,
      context: QueryStruct,
      expr: Expr,
      state?: GenerateState
    ) => string
  ) {
    FieldInstanceField.exprCompiler = compiler;
  }

  getSQL() {
    let exp = this.generateExpression(); // Changed from this.f.generateExpression(this.parent)
    if (isScalarField(this.f)) {
      exp = caseGroup(
        this.parent.groupSet > 0
          ? this.parent.childGroups.concat(this.additionalGroupSets)
          : [],
        exp
      );
    }
    return exp;
  }

  generateExpression(): string {
    if (!FieldInstanceField.exprCompiler) {
      throw new Error(
        'Expression compiler not registered with FieldInstanceField'
      );
    }
    // Check for distinct key by its characteristic properties
    if (
      this.f.fieldDef.type === 'string' &&
      this.f.fieldDef.name === '__distinct_key'
    ) {
      return this.generateDistinctKeyExpression();
    }

    // Normal field expression generation
    if (hasExpression(this.f.fieldDef)) {
      return FieldInstanceField.exprCompiler(
        this.parent,
        this.f.parent,
        this.f.fieldDef.e
      );
    }

    return sqlFullChildReference(
      this.f.parent,
      this.f.fieldDef.name,
      this.f.parent.structDef.type === 'record'
        ? {
            result: this.parent,
            field: this.f,
          }
        : undefined
    );
  }

  private generateDistinctKeyExpression(): string {
    if (this.f.parent.primaryKey()) {
      const pk = this.f.parent.getPrimaryKeyField(this.f.fieldDef);
      const pkName = pk.fieldDef.as || pk.fieldDef.name;
      const pkField = this.parent.getField(pkName);
      return pkField.generateExpression();
    } else if (this.f.parent.structDef.type === 'array') {
      const parentDistinctKey = this.f.parent.parent?.getDistinctKey();
      if (parentDistinctKey && this.parent.parent) {
        const keyField = this.parent.parent.getField('__distinct_key');
        const parentKeySQL = keyField.generateExpression();
        return this.f.parent.dialect.sqlMakeUnnestKey(
          parentKeySQL,
          this.f.parent.dialect.sqlFieldReference(
            this.f.parent.getIdentifier(),
            'table',
            '__row_id',
            'string'
          )
        );
      }
      return this.f.parent.dialect.sqlMakeUnnestKey(
        '',
        this.f.parent.dialect.sqlFieldReference(
          this.f.parent.getIdentifier(),
          'table',
          '__row_id',
          'string'
        )
      );
    } else {
      return this.f.parent.dialect.sqlFieldReference(
        this.f.parent.getIdentifier(),
        'table',
        '__distinct_key',
        'string'
      );
    }
  }

  getAnalyticalSQL(forPartition: boolean): string {
    if (this.analyticalSQL === undefined) {
      return this.getSQL();
    } else if (forPartition && this.partitionSQL) {
      return this.partitionSQL;
    } else {
      return this.analyticalSQL;
    }
  }
}

type RepeatedResultType = 'nested' | 'inline_all_numbers' | 'inline';

export type UngroupSet = {
  type: 'all' | 'exclude';
  fields: string[];
  groupSet: number;
};

export class FieldInstanceResult implements FieldInstance {
  type: FieldInstanceType = 'query';
  allFields = new Map<string, FieldInstance>();
  groupSet = 0;
  depth = 0;
  childGroups: number[] = [];
  firstSegment: PipeSegment;
  hasHaving = false;
  ungroupedSets = new Map<string, UngroupSet>();
  // query: QueryQuery;

  resultUsesUngrouped = false;

  constructor(
    public turtleDef: TurtleDef,
    public parent: FieldInstanceResult | undefined
  ) {
    this.firstSegment = turtleDef.pipeline[0];
  }

  // Gets a limit if it has one.
  getLimit() {
    if (
      this.firstSegment.type === 'reduce' ||
      this.firstSegment.type === 'project'
    ) {
      return this.firstSegment.limit;
    } else {
      return undefined;
    }
  }

  /**
   * Information about the query containing this result set. Invented
   * to pass on timezone information, but maybe more things will
   * eventually go in here.
   *
   * For nested queries, this walks up the FieldInstanceResult parent chain
   * to find the most specific (innermost) query timezone that applies.
   * @returns QueryInfo
   */
  getQueryInfo(): QueryInfo {
    if (
      !isIndexSegment(this.firstSegment) &&
      !isRawSegment(this.firstSegment)
    ) {
      const {queryTimezone} = this.firstSegment;
      if (queryTimezone) {
        return {queryTimezone};
      }
    }

    if (this.parent) {
      return this.parent.getQueryInfo();
    }

    return {};
  }

  addField(
    as: string,
    field: QueryField,
    usage: InstanceFieldUsage,
    drillExpression: Malloy.Expression | undefined
  ) {
    const fi = this.allFields.get(as);
    if (fi) {
      if (fi.type === 'query') {
        throw new Error(
          `Redefinition of field ${field.fieldDef.name} as struct`
        );
      }
      const fif = fi as FieldInstanceField;
      if (fif.fieldUsage.type === 'result') {
        if (usage.type !== 'result') {
          // its already in the result, we can just ignore it.
          return;
        } else {
          throw new Error(
            `Ambiguous output field name '${field.fieldDef.name}'.`
          );
        }
      }
    }
    this.add(as, new FieldInstanceField(field, usage, this, drillExpression));
  }

  parentGroupSet(): number {
    if (this.parent) {
      return this.parent.groupSet;
    } else {
      return 0;
    }
  }

  add(name: string, f: FieldInstance) {
    this.allFields.set(name, f);
  }

  hasField(name: string): boolean {
    const fi = this.allFields.get(name);
    return fi !== undefined && fi instanceof FieldInstanceField;
  }

  getField(name: string): FieldInstanceField {
    const fi = this.allFields.get(name);
    if (fi === undefined) {
      throw new Error(`Internal Error, field Not defined ${name}`);
    } else if (fi instanceof FieldInstanceField) {
      return fi;
    }
    throw new Error(`can't use a query here ${name}`);
  }

  getFieldByNumber(index: number): {name: string; fif: FieldInstanceField} {
    for (const [name, fi] of this.allFields) {
      if (fi instanceof FieldInstanceField) {
        if (
          fi.fieldUsage.type === 'result' &&
          fi.fieldUsage.resultIndex === index
        ) {
          return {name, fif: fi};
        }
      }
    }
    throw new Error(`Invalid Order By index '${index}`);
  }

  // loops through all the turtled queries and computes recomputes the group numbers
  computeGroups(
    nextGroupSetNumber: number,
    depth: number
  ): {
    nextGroupSetNumber: number;
    maxDepth: number;
    children: number[];
    isComplex: boolean;
  } {
    // if the root node uses a total, start at 1.
    if (nextGroupSetNumber === 0 && this.resultUsesUngrouped) {
      this.root().computeOnlyGroups.push(nextGroupSetNumber++);
    }

    // make a groupset for each unique ungrouping expression
    for (const [_key, grouping] of this.ungroupedSets) {
      const groupSet = nextGroupSetNumber++;
      grouping.groupSet = groupSet;
      this.root().computeOnlyGroups.push(groupSet);
    }

    this.groupSet = nextGroupSetNumber++;
    this.depth = depth;
    let maxDepth = depth;
    let isComplex = false;
    let children: number[] = [this.groupSet];
    for (const [_name, fi] of this.allFields) {
      if (fi.type === 'query') {
        const fir = fi as FieldInstanceResult;
        isComplex = true;
        if (fir.firstSegment.type === 'reduce') {
          const r = fir.computeGroups(nextGroupSetNumber, depth + 1);
          children = children.concat(r.children);
          nextGroupSetNumber = r.nextGroupSetNumber;
          if (r.maxDepth > maxDepth) {
            maxDepth = r.maxDepth;
          }
        }
      }
    }
    this.childGroups = children;
    return {nextGroupSetNumber, maxDepth, children, isComplex};
  }

  fields(
    fn: undefined | ((field: FieldInstanceField) => boolean) = undefined
  ): FieldInstanceField[] {
    const ret: FieldInstanceField[] = [];
    for (const e of this.allFields.values()) {
      if (e instanceof FieldInstanceField) {
        if (fn === undefined || fn(e)) {
          ret.push(e);
        }
      }
    }
    return ret;
  }

  fieldNames(
    fn: undefined | ((field: FieldInstanceField) => boolean)
  ): string[] {
    const ret: string[] = [];
    for (const [name, fi] of this.allFields) {
      if (fi instanceof FieldInstanceField) {
        if (fn === undefined || fn(fi)) {
          ret.push(name);
        }
      }
    }
    return ret;
  }

  // if a turtled result is all measures, we emit use ANY_VALUE for the aggregation
  //  and emit the resulting structure as a RECORD instead of REPEATED
  //  if we have all numbers, we need to know because we'll have to conjur a record.
  getRepeatedResultType(): RepeatedResultType {
    let ret: RepeatedResultType = 'inline_all_numbers';
    for (const f of this.fields()) {
      if (f.fieldUsage.type === 'result') {
        if (isBasicScalar(f.f)) {
          return 'nested';
        }
        if (f.f instanceof QueryFieldStruct) {
          ret = 'inline';
        }
      }
    }
    return ret;
  }

  structs(): FieldInstanceResult[] {
    const ret: FieldInstanceResult[] = [];
    for (const e of this.allFields.values()) {
      if (e instanceof FieldInstanceResult) {
        ret.push(e);
      }
    }
    return ret;
  }

  // return a list of structs that match the criteria
  //  specified in the function.
  selectStructs(
    result: FieldInstanceResult[],
    fn: (result: FieldInstanceResult) => boolean
  ): FieldInstanceResult[] {
    if (fn(this)) {
      result.push(this);
    }
    for (const e of this.structs()) {
      e.selectStructs(result, fn);
    }
    return result;
  }

  calculateDefaultOrderBy(): OrderBy[] {
    // LookML rules for default ordering.
    //  Date or time  or ordnal based fields, that field ascending
    //  First Measure Descending.
    let firstField;
    for (const [_name, fi] of this.allFields) {
      if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === 'result') {
          if (
            fi.f.fieldDef.type === 'turtle' ||
            isJoined(fi.f.fieldDef) ||
            expressionIsAnalytic(fi.f.fieldDef.expressionType)
          ) {
            continue;
          }
          firstField ||= fi.fieldUsage.resultIndex;
          if (isTemporalType(fi.f.fieldDef.type)) {
            return [{dir: 'desc', field: fi.fieldUsage.resultIndex}];
          } else if (isBasicAggregate(fi.f)) {
            return [{dir: 'desc', field: fi.fieldUsage.resultIndex}];
          }
        }
      }
    }
    if (firstField) {
      return [{dir: 'asc', field: firstField}];
    }
    return [];
  }

  addStructToJoin(
    qs: QueryStruct,
    uniqueKeyRequirement: UniqueKeyRequirement,
    onReferencesChildren?: boolean
  ): void {
    const name = qs.getIdentifier();

    let join = this.root().joins.get(name);
    if (join) {
      join.uniqueKeyRequirement = mergeUniqueKeyRequirement(
        join.uniqueKeyRequirement,
        uniqueKeyRequirement
      );
      return;
    }

    // if we have a parent, join it first.
    let parent: JoinInstance | undefined;
    const parentStruct = qs.parent?.getJoinableParent();
    if (parentStruct) {
      // add dependant expressions first...
      this.addStructToJoin(parentStruct, undefined);
      parent = this.root().joins.get(parentStruct.getIdentifier());
    }

    if (!(join = this.root().joins.get(name))) {
      join = new JoinInstance(qs, name, parent);
      if (onReferencesChildren) {
        join.onReferencesChildren = true;
      }
      this.root().joins.set(name, join);
    }
    join.uniqueKeyRequirement = mergeUniqueKeyRequirement(
      join.uniqueKeyRequirement,
      uniqueKeyRequirement
    );
  }

  root(): FieldInstanceResultRoot {
    if (this.parent) {
      return this.parent.root();
    }
    throw new Error('Internal Error, Null parent FieldInstanceResult');
  }

  getUngroupPartitions(
    ungroupSet: UngroupSet | undefined
  ): FieldInstanceField[] {
    let ret: FieldInstanceField[] = [];

    let p: FieldInstanceResult | undefined = this as FieldInstanceResult;
    let excludeFields: string[] = [];
    let inScopeFieldNames: string[] = [];
    // all defaults to all fields at the current level.
    if (ungroupSet === undefined || ungroupSet.type === 'all') {
      // fields specified an an all, convert it to an exclude set.
      const allFields = ungroupSet?.fields || [];
      // convert an All into the equivalent exclude
      excludeFields = this.fields(
        fi =>
          isBasicScalar(fi.f) &&
          fi.fieldUsage.type === 'result' &&
          allFields.indexOf(fi.f.getIdentifier()) === -1
      ).map(fi => fi.f.getIdentifier());
    } else {
      excludeFields = ungroupSet.fields;
    }
    let firstScope = true;
    while (p !== undefined) {
      // get a list of valid fieldnames for the current scope.
      if (firstScope || ungroupSet?.type === 'exclude') {
        inScopeFieldNames = inScopeFieldNames.concat(
          p
            .fields(
              fi => isScalarField(fi.f) && fi.fieldUsage.type === 'result'
            )
            .map(fi => fi.f.getIdentifier())
        );
      }
      ret = ret.concat(
        p.fields(
          fi =>
            isScalarField(fi.f) &&
            fi.fieldUsage.type === 'result' &&
            excludeFields.indexOf(fi.f.getIdentifier()) === -1
        )
      );
      p = p.parent;
      firstScope = false;
    }
    // verify that all names specified are available in the current scope.
    for (const fieldName of ungroupSet?.fields || []) {
      if (inScopeFieldNames.indexOf(fieldName) === -1) {
        throw new Error(
          `${ungroupSet?.type}(): unknown field name "${fieldName}" or name not in scope.`
        );
      }
    }

    return ret;
  }

  assignFieldsToGroups() {
    for (const [_key, grouping] of this.ungroupedSets) {
      for (const fieldInstance of this.getUngroupPartitions(grouping)) {
        fieldInstance.additionalGroupSets.push(grouping.groupSet);
      }
    }
    for (const child of this.structs()) {
      child.assignFieldsToGroups();
    }
  }
}

type FieldInstanceType = 'field' | 'query';

export interface FieldInstance {
  type: FieldInstanceType;
  // groupSet: number;
  root(): FieldInstanceResultRoot;
}

/* Root Result as opposed to a turtled result */
export class FieldInstanceResultRoot extends FieldInstanceResult {
  joins = new Map<string, JoinInstance>();
  havings = new AndChain();
  isComplexQuery = false;
  queryUsesPartitioning = false;
  computeOnlyGroups: number[] = [];
  elimatedComputeGroups = false;

  constructor(turtleDef: TurtleDef) {
    super(turtleDef, undefined);
  }

  root(): FieldInstanceResultRoot {
    return this;
  }

  // in the stage immediately following stage0 we need to elimiate any of the
  //  groups that were used in ungroup calculations.  We need to do this only
  //  once and in the very next stage.
  eliminateComputeGroupsSQL(): string {
    if (this.elimatedComputeGroups || this.computeOnlyGroups.length === 0) {
      return '';
    } else {
      this.elimatedComputeGroups = true;
      return `group_set NOT IN (${this.computeOnlyGroups.join(',')})`;
    }
  }

  // look at all the fields again in the structs in the query

  calculateSymmetricAggregates() {
    let leafiest: string | undefined;
    for (const [name, join] of this.joins) {
      // first join is by default the
      const relationship = join.parentRelationship();
      if (
        relationship === 'many_to_many' ||
        join.forceAllSymmetricCalculations()
      ) {
        // everything must be calculated with symmetric aggregates
        leafiest = '0never';
      } else if (leafiest === undefined) {
        leafiest = name;
      } else if (join.parentRelationship() === 'one_to_many') {
        // check up the parent relationship until you find
        //  the current leafiest node.  If it isn't in the direct path
        //  we need symmetric aggregate for everything.
        //  if it is in the path, than this one becomes leafiest
        const s = join.queryStruct;
        if (s.parent && s.parent.getIdentifier() === leafiest) {
          leafiest = name;
        } else {
          // we have more than on one_to_many join chain, all bets are off.
          leafiest = '0never';
        }
      }
    }
    // console.log(`LEAFIEST: ${leafiest}`);
    for (const [name, join] of this.joins) {
      join.leafiest = name === leafiest;
    }

    // figure out which joins we need to manufacture distinct keys for.
    //  Nested Unique keys are dependant on the primary key of the parent
    //  and the table.
    for (const [_name, join] of this.joins) {
      // in a one_to_many join we need a key to count there may be a failed
      //  match in a left join.
      // users -> {
      //   group_by: user_id
      //   aggregate: order_count is orders.count()
      if (
        // we have a leafiest count() joined subtree
        (join.leafiest &&
          join.parent !== undefined &&
          join.uniqueKeyRequirement?.isCount) ||
        // or not leafiest and we use an asymetric function
        (!join.leafiest && join.uniqueKeyRequirement)
      ) {
        let j: JoinInstance | undefined = join;
        while (j) {
          if (!j.queryStruct.primaryKey()) {
            j.makeUniqueKey = true;
          }
          if (j.queryStruct.structDef.type === 'array') {
            j = j.parent;
          } else {
            j = undefined;
          }
        }
      }
    }
  }
}

export function sqlFullChildReference(
  struct: QueryStruct,
  name: string,
  expand: {result: FieldInstanceResult; field: QueryField} | undefined
): string {
  let parentRef = struct.getSQLIdentifier();
  if (expand && isAtomic(struct.structDef) && hasExpression(struct.structDef)) {
    if (!struct.parent) {
      throw new Error(`Cannot expand reference to ${name} without parent`);
    }
    if (!FieldInstanceField.exprCompiler) {
      throw new Error(
        'Expression compiler not registered with FieldInstanceField'
      );
    }
    parentRef = FieldInstanceField.exprCompiler(
      expand.result,
      struct.parent,
      struct.structDef.e
    );
  }
  let refType: FieldReferenceType = 'table';
  if (struct.structDef.type === 'record') {
    refType = 'record';
  } else if (struct.structDef.type === 'array') {
    refType =
      struct.structDef.elementTypeDef.type === 'record_element'
        ? 'array[record]'
        : 'array[scalar]';
  } else if (struct.structDef.type === 'nest_source') {
    refType = 'nest source';
  }
  const child = struct.getChildByName(name);
  const childType = child?.fieldDef.type || 'unknown';
  return struct.dialect.sqlFieldReference(parentRef, refType, name, childType);
}
