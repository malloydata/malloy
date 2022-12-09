/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { cloneDeep } from "lodash";
import { StandardSQLDialect } from "../dialect/standardsql";
import { Dialect, DialectFieldList, getDialect } from "../dialect";
import {
  FieldDateDef,
  FieldDef,
  FieldRef,
  FieldTimestampDef,
  FilterExpression,
  getIdentifier,
  ModelDef,
  Query,
  QueryFieldDef,
  StructDef,
  StructRef,
  OrderBy,
  ResultMetadataDef,
  FieldAtomicDef,
  Expr,
  isFieldFragment,
  FieldFragment,
  AggregateFragment,
  isAggregateFragment,
  isAsymmetricFragment,
  CompiledQuery,
  FilterFragment,
  isFilterFragment,
  hasExpression,
  PipeSegment,
  TurtleDef,
  QuerySegment,
  IndexSegment,
  Filtered,
  isApplyFragment,
  isApplyValue,
  isParameterFragment,
  ParameterFragment,
  Parameter,
  isValueParameter,
  JoinRelationship,
  isPhysical,
  isJoinOn,
  isQuerySegment,
  DialectFragment,
  isDialectFragment,
  getPhysicalFields,
  isIndexSegment,
  UngroupFragment,
  isUngroupFragment,
} from "./malloy_types";

import { indent, AndChain } from "./utils";
import md5 from "md5";
import { ResultStructMetadataDef, SearchIndexResult } from ".";
import { Connection } from "..";

interface TurtleDefPlus extends TurtleDef, Filtered {}

// quote a string for SQL use.  Perhaps should be in dialect.
function generateSQLStringLiteral(sourceString: string): string {
  return `'${sourceString}'`;
}

// Storage for SQL code for multi stage turtle pipelines that don't support UNNEST(ARRAY_AGG)
interface OutputPipelinedSQL {
  sqlFieldName: string;
  pipelineSQL: string;
}

class StageWriter {
  withs: string[] = [];
  udfs: string[] = [];
  pdts: string[] = [];
  stagePrefix = "__stage";
  parent: StageWriter | undefined;
  useCTE: boolean;

  constructor(useCTE = true, parent: StageWriter | undefined) {
    this.parent = parent;
    this.useCTE = useCTE;
  }

  getName(id: number) {
    return `${this.stagePrefix}${id}`;
  }

  root(): StageWriter {
    if (this.parent === undefined) {
      return this;
    } else {
      return this.parent.root();
    }
  }

  addStage(sql: string): string {
    if (this.useCTE) {
      this.withs.push(sql);
      return this.getName(this.withs.length - 1);
    } else {
      this.withs[0] = sql;
      return indent(`\n(${sql})\n`);
    }
  }

  addUDF(
    stageWriter: StageWriter,
    dialect: Dialect,
    structDef: StructDef
  ): string {
    // eslint-disable-next-line prefer-const
    let { sql, lastStageName } = stageWriter.combineStages(true);
    if (lastStageName === undefined) {
      throw new Error("Internal Error: no stage to combine");
    }
    sql += dialect.sqlCreateFunctionCombineLastStage(lastStageName, structDef);

    const id = `${dialect.udfPrefix}${this.root().udfs.length}`;
    sql = dialect.sqlCreateFunction(id, sql);
    this.root().udfs.push(sql);
    return id;
  }

  addPDT(baseName: string, dialect: Dialect): string {
    const sql =
      this.combineStages(false).sql + this.withs[this.withs.length - 1];
    const tableName = "scratch." + baseName + md5(sql);
    this.root().pdts.push(dialect.sqlCreateTableAsSelect(tableName, sql));
    return tableName;
  }

  // combine all the stages except the last one into a WITH statement
  //  return SQL and the last stage name
  combineStages(includeLastStage: boolean): {
    sql: string;
    lastStageName: string | undefined;
  } {
    if (!this.useCTE) {
      return { sql: this.withs[0], lastStageName: this.withs[0] };
    }
    let lastStageName = this.getName(0);
    let prefix = `WITH `;
    let w = "";
    for (let i = 0; i < this.withs.length - (includeLastStage ? 0 : 1); i++) {
      const sql = this.withs[i];
      lastStageName = this.getName(i);
      if (sql === undefined) {
        throw new Error(
          `Expected sql WITH to be present for stage ${lastStageName}.`
        );
      }
      w += `${prefix}${lastStageName} AS (\n${indent(sql)})\n`;
      prefix = ", ";
    }
    return { sql: w, lastStageName };
  }

  /** emit the SQL for all the stages.  */
  generateSQLStages(): string {
    const lastStageNum = this.withs.length - 1;
    if (lastStageNum < 0) {
      throw new Error("No SQL generated");
    }
    const udfs = this.udfs.join(`\n`);
    const pdts = this.pdts.join(`\n`);
    const sql = this.combineStages(false).sql;
    return udfs + pdts + sql + this.withs[lastStageNum];
  }

  generateCoorelatedSubQuery(dialect: Dialect, structDef: StructDef): string {
    if (!this.useCTE) {
      return dialect.sqlCreateFunctionCombineLastStage(
        `(${this.withs[0]})`,
        structDef
      );
    } else {
      return (
        this.combineStages(true).sql +
        dialect.sqlCreateFunctionCombineLastStage(
          this.getName(this.withs.length - 1),
          structDef
        )
      );
    }
  }
}

type QuerySomething = QueryField | QueryStruct | QueryTurtle;

// type QueryNodeType =
//   | "abstract"
//   | "dimension"
//   | "measure"
//   | "query"
//   | "turtle"
//   | "struct";

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

abstract class QueryNode {
  fieldDef: FieldDef;
  constructor(fieldDef: FieldDef) {
    this.fieldDef = fieldDef;
  }

  getIdentifier() {
    return getIdentifier(this.fieldDef);
  }

  getChildByName(_name: string): QuerySomething | undefined {
    return undefined;
  }
}

class QueryField extends QueryNode {
  fieldDef: FieldDef;
  parent: QueryStruct;

  constructor(fieldDef: FieldDef, parent: QueryStruct) {
    super(fieldDef);
    this.parent = parent;
    this.fieldDef = fieldDef;
  }

  mayNeedUniqueKey(): boolean {
    return false;
  }

  getJoinableParent(): QueryStruct {
    // if it is inline it should always have a parent
    const parent = this.parent;
    if (parent.fieldDef.structRelationship.type === "inline") {
      if (parent) {
        return parent.getJoinableParent();
      } else {
        throw new Error(`Internal Error: inline struct cannot be root`);
      }
    }
    return parent;
  }

  caseGroup(groupSets: number[], s: string): string {
    if (groupSets.length === 0) {
      return s;
    } else {
      const exp =
        groupSets.length === 1
          ? `=${groupSets[0]}`
          : ` IN (${groupSets.join(",")})`;
      return `CASE WHEN group_set${exp} THEN\n  ${s}\n  END`;
    }
  }

  getFullOutputName() {
    return this.parent.getFullOutputName() + this.getIdentifier();
  }

  generateFieldFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: FieldFragment,
    state: GenerateState
  ): string {
    // find the structDef and return the path to the field...
    const field = context.getFieldByName(expr.path) as QueryField;
    if (hasExpression(field.fieldDef)) {
      let ret = this.generateExpressionFromExpr(
        resultSet,
        field.parent,
        field.fieldDef.e,
        state
      );
      if (!ret.match(/^\(.*\)$/)) {
        ret = `(${ret})`;
      }
      return ret;
    } else {
      // return field.parent.getIdentifier() + "." + field.fieldDef.name;
      return field.generateExpression(resultSet);
    }
  }

  generateParameterFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: ParameterFragment,
    state: GenerateState
  ): string {
    // find the structDef and return the path to the field...
    const param = context.parameters()[expr.path];
    if (isValueParameter(param)) {
      if (param.value) {
        return this.generateExpressionFromExpr(
          resultSet,
          context,
          param.value,
          state
        );
      }
    } else if (param.condition) {
      return this.generateExpressionFromExpr(
        resultSet,
        context,
        param.condition,
        state
      );
    }
    throw new Error(`Can't generate SQL, no value for ${expr.path}`);
  }

  generateFilterFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: FilterFragment,
    state: GenerateState
  ): string {
    const allWhere = new AndChain(state.whereSQL);
    for (const cond of expr.filterList) {
      allWhere.add(
        this.generateExpressionFromExpr(
          resultSet,
          context,
          cond.expression,
          state.withWhere()
        )
      );
    }
    return this.generateExpressionFromExpr(
      resultSet,
      context,
      expr.e,
      state.withWhere(allWhere.sql())
    );
  }

  generateDimFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateFragment,
    state: GenerateState
  ): string {
    let dim = this.generateExpressionFromExpr(
      resultSet,
      context,
      expr.e,
      state
    );
    if (state.whereSQL) {
      dim = `CASE WHEN ${state.whereSQL} THEN ${dim} END`;
    }
    return dim;
  }

  generateUngroupedFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: UngroupFragment,
    state: GenerateState
  ): string {
    if (state.totalGroupSet !== -1) {
      throw new Error(`Already in ALL.  Cannot nest within an all calcuation.`);
    }

    let totalGroupSet;
    let ungroupSet: UngroupSet | undefined;

    if (expr.fields && expr.fields.length > 0) {
      const key = expr.fields.sort().join("|") + expr.type;
      ungroupSet = resultSet.ungroupedSets.get(key);
      if (ungroupSet === undefined) {
        throw new Error(`Internal Error, cannot find groupset with key ${key}`);
      }
      totalGroupSet = ungroupSet.groupSet;
    } else {
      totalGroupSet = resultSet.parent ? resultSet.parent.groupSet : 0;
    }

    const s = this.generateExpressionFromExpr(
      resultSet,
      context,
      expr.e,
      state.withTotal(totalGroupSet)
    );

    const fields = resultSet.getUngroupPartitions(ungroupSet);

    let partitionBy = "";
    const fieldsString = fields.map((f) => f.getPartitionSQL()).join(", ");
    if (fieldsString.length > 0) {
      partitionBy = `PARTITION BY ${fieldsString}`;
    }
    return `MAX(${s}) OVER (${partitionBy})`;
  }

  generateDistinctKeyIfNecessary(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    structPath: string | undefined
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
    expr: AggregateFragment,
    state: GenerateState
  ): string {
    const dimSQL = this.generateDimFragment(resultSet, context, expr, state);
    const distinctKeySQL = this.generateDistinctKeyIfNecessary(
      resultSet,
      context,
      expr.structPath
    );
    let ret;
    if (distinctKeySQL) {
      if (this.parent.dialect.supportsSumDistinctFunction) {
        ret = this.parent.dialect.sqlSumDistinct(distinctKeySQL, dimSQL);
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
    expr: AggregateFragment,
    state: GenerateState
  ): string {
    const dimSQL = this.generateDimFragment(resultSet, context, expr, state);
    const f =
      expr.function === "count_distinct"
        ? "count(distinct "
        : expr.function + "(";
    return `${f}${dimSQL})`;
  }

  generateAvgFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateFragment,
    state: GenerateState
  ): string {
    // find the structDef and return the path to the field...
    const dimSQL = this.generateDimFragment(resultSet, context, expr, state);
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
      if (this.parent.dialect.supportsSumDistinctFunction) {
        sumDistinctSQL = this.parent.dialect.sqlSumDistinct(
          distinctKeySQL,
          dimSQL
        );
      } else {
        sumDistinctSQL = sqlSumDistinct(
          this.parent.dialect,
          dimSQL,
          distinctKeySQL
        );
      }
      return `(${sumDistinctSQL})/NULLIF(COUNT(DISTINCT ${countDistinctKeySQL}),0)`;
    } else {
      return `AVG(${dimSQL})`;
    }
  }

  generateCountFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateFragment,
    state: GenerateState
  ): string {
    let func = "COUNT(";
    let thing = "1";
    const distinctKeySQL = this.generateDistinctKeyIfNecessary(
      resultSet,
      context,
      expr.structPath
    );
    if (distinctKeySQL) {
      func = "COUNT(DISTINCT";
      thing = distinctKeySQL;
    }

    // find the structDef and return the path to the field...
    if (state.whereSQL) {
      return `${func} CASE WHEN ${state.whereSQL} THEN ${thing} END)`;
    } else {
      return `${func} ${thing})`;
    }
  }

  generateDialect(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: DialectFragment,
    state: GenerateState
  ): string {
    return this.generateExpressionFromExpr(
      resultSet,
      context,
      context.dialect.dialectExpr(expr),
      state
    );
  }

  generateExpressionFromExpr(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    e: Expr,
    state: GenerateState = new GenerateState()
  ): string {
    let s = "";
    for (const expr of e) {
      if (typeof expr === "string") {
        s += expr;
      } else if (isFieldFragment(expr)) {
        s += this.generateFieldFragment(resultSet, context, expr, state);
      } else if (isParameterFragment(expr)) {
        s += this.generateParameterFragment(resultSet, context, expr, state);
      } else if (isFilterFragment(expr)) {
        s += this.generateFilterFragment(resultSet, context, expr, state);
      } else if (isUngroupFragment(expr)) {
        s += this.generateUngroupedFragment(resultSet, context, expr, state);
      } else if (isAggregateFragment(expr)) {
        let agg;
        if (expr.function === "sum") {
          agg = this.generateSumFragment(resultSet, context, expr, state);
        } else if (expr.function === "avg") {
          agg = this.generateAvgFragment(resultSet, context, expr, state);
        } else if (expr.function === "count") {
          agg = this.generateCountFragment(resultSet, context, expr, state);
        } else if (["count_distinct", "min", "max"].includes(expr.function)) {
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
          s += this.caseGroup([groupSet], agg);
        } else {
          s += agg;
        }
      } else if (isApplyFragment(expr)) {
        const applyVal = this.generateExpressionFromExpr(
          resultSet,
          context,
          expr.value,
          state
        );
        s += this.generateExpressionFromExpr(
          resultSet,
          context,
          expr.to,
          state.withApply(applyVal)
        );
      } else if (isApplyValue(expr)) {
        if (state.applyValue) {
          s += state.applyValue;
        } else {
          throw new Error(
            `Internal Error: Partial application value referenced but not provided`
          );
        }
      } else if (expr.type == "dialect") {
        s += this.generateDialect(resultSet, context, expr, state);
      } else {
        throw new Error(
          `Internal Error: Unknown expression fragment ${JSON.stringify(
            expr,
            undefined,
            2
          )}`
        );
      }
    }
    return s;
  }

  getExpr(): Expr {
    if (hasExpression(this.fieldDef)) {
      return this.fieldDef.e;
    }
    return [
      this.parent.dialect.sqlFieldReference(
        this.parent.getSQLIdentifier(),
        this.fieldDef.name,
        this.fieldDef.type,
        this.parent.fieldDef.structSource.type === "nested" ||
          this.parent.fieldDef.structSource.type === "inline" ||
          (this.parent.fieldDef.structSource.type === "sql" &&
            this.parent.fieldDef.structSource.method === "nested"),
        this.parent.fieldDef.structRelationship.type === "nested" &&
          this.parent.fieldDef.structRelationship.isArray
      ),
    ];
  }

  generateExpression(resultSet: FieldInstanceResult): string {
    return this.generateExpressionFromExpr(
      resultSet,
      this.parent,
      this.getExpr()
    );
  }
}

function isAggregateField(f: QueryField): f is QueryAtomicField {
  return f instanceof QueryAtomicField && f.isAggregate();
}

function isScalarField(f: QueryField): f is QueryAtomicField {
  return f instanceof QueryAtomicField && !f.isAggregate();
}

class QueryAtomicField extends QueryField {
  includeInWildcard(): boolean {
    return true;
  }

  isAggregate(): boolean {
    return (
      (this.fieldDef as FieldAtomicDef).aggregate !== undefined &&
      (this.fieldDef as FieldAtomicDef).aggregate === true
    );
  }

  getFilterList(): FilterExpression[] {
    return [];
  }

  hasExpression(): boolean {
    return hasExpression(this.fieldDef);
  }
}

// class QueryMeasure extends QueryField {}

class QueryFieldString extends QueryAtomicField {}
class QueryFieldNumber extends QueryAtomicField {}
class QueryFieldBoolean extends QueryAtomicField {}

// in a query a struct can be referenced.  The struct will
//  emit the primary key field in the actual result set and
//  will include the StructDef as a foreign key join in the output
//  StructDef.
class QueryFieldStruct extends QueryAtomicField {
  primaryKey: string;

  constructor(fieldDef: FieldDef, parent: QueryStruct, primaryKey: string) {
    super(fieldDef, parent);
    this.primaryKey = primaryKey;
  }

  getName() {
    return getIdentifier(this.fieldDef);
  }

  getAsJoinedStructDef(foreignKeyName: string): StructDef {
    return {
      ...this.parent.fieldDef,
      structRelationship: {
        type: "one",
        onExpression: [
          {
            type: "field",
            path: this.primaryKey,
          },
          "=",
          { type: "field", path: foreignKeyName },
        ],
      },
    };
  }
}

class QueryFieldDate extends QueryAtomicField {
  generateExpression(resultSet: FieldInstanceResult): string {
    const fd = this.fieldDef as FieldDateDef;
    if (!fd.timeframe) {
      return super.generateExpression(resultSet);
    } else {
      const truncated = this.parent.dialect.sqlTrunc(
        { value: this.getExpr(), valueType: "date" },
        fd.timeframe
      );
      return this.generateExpressionFromExpr(resultSet, this.parent, truncated);
    }
  }

  // clone ourselves on demand as a timeframe.
  getChildByName(name: string): QueryFieldDate {
    const fieldDef = {
      ...this.fieldDef,
      as: `${this.getIdentifier()}_${name}`,
      timeframe: name,
    };
    return new QueryFieldDate(fieldDef as FieldDateDef, this.parent);
  }
}

class QueryFieldTimestamp extends QueryAtomicField {
  // clone ourselves on demand as a timeframe.
  getChildByName(name: string): QueryFieldTimestamp {
    const fieldDef = {
      ...this.fieldDef,
      as: `${this.getIdentifier()}_${name}`,
      timeframe: name,
    };
    return new QueryFieldTimestamp(fieldDef as FieldTimestampDef, this.parent);
  }
}

class QueryFieldDistinctKey extends QueryAtomicField {
  generateExpression(resultSet: FieldInstanceResult): string {
    if (this.parent.primaryKey()) {
      const pk = this.parent.getPrimaryKeyField(this.fieldDef);
      return pk.generateExpression(resultSet);
    } else if (this.parent.fieldDef.structSource.type === "nested") {
      const parentKey = this.parent.parent
        ?.getDistinctKey()
        .generateExpression(resultSet);
      return `CONCAT(${parentKey}, 'x', ${this.parent.dialect.sqlFieldReference(
        this.parent.getIdentifier(),
        "__row_id",
        "string",
        true,
        false
      )})`;
    } else {
      // return this.parent.getIdentifier() + "." + "__distinct_key";
      return this.parent.dialect.sqlFieldReference(
        this.parent.getIdentifier(),
        "__distinct_key",
        "string",
        this.parent.fieldDef.structRelationship.type === "nested",
        false
      );
    }
  }

  includeInWildcard(): boolean {
    return false;
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
      (CAST(ROUND(COALESCE(${sqlExp},0)*(${multiplier}*1.0), ${NUMERIC_DECIMAL_PRECISION}) AS NUMERIC) +
      ${uniqueInt}
    ))
    -
     SUM(DISTINCT ${uniqueInt})
  )`;
  let ret = `(${sumSQL}/(${multiplier}*1.0))`;
  ret = `CAST(${ret} as ${dialect.defaultNumberType})`;
  return ret;
}

type FieldUsage =
  | {
      type: "result";
      resultIndex: number;
    }
  | { type: "where" }
  | { type: "dependant" };

type FieldInstanceType = "field" | "query";

interface FieldInstance {
  type: FieldInstanceType;
  // groupSet: number;
  root(): FieldInstanceResultRoot;
}

class FieldInstanceField implements FieldInstance {
  type: FieldInstanceType = "field";
  f: QueryField;
  // the output index of this field (1 based)
  fieldUsage: FieldUsage;
  additionalGroupSets: number[] = [];
  parent: FieldInstanceResult;
  partitionSQL: string | undefined; // the name of the field when used as a partition.
  constructor(
    f: QueryField,
    fieldUsage: FieldUsage,
    parent: FieldInstanceResult
  ) {
    this.f = f;
    this.fieldUsage = fieldUsage;
    this.parent = parent;
  }

  root(): FieldInstanceResultRoot {
    return this.parent.root();
  }

  getSQL() {
    let exp = this.f.generateExpression(this.parent);
    if (isScalarField(this.f)) {
      exp = this.f.caseGroup(
        this.parent.childGroups.concat(this.additionalGroupSets),
        // this.parent.groupSet > 0 ? this.parent.childGroups : [],
        exp
      );
    }
    return exp;
  }

  getPartitionSQL() {
    if (this.partitionSQL === undefined) {
      return this.getSQL();
    } else {
      return this.partitionSQL;
    }
  }
}

type RepeatedResultType = "nested" | "inline_all_numbers" | "inline";

type UngroupSet = {
  type: "all" | "exclude";
  fields: string[];
  groupSet: number;
};

class FieldInstanceResult implements FieldInstance {
  type: FieldInstanceType = "query";
  allFields = new Map<string, FieldInstance>();
  groupSet = 0;
  depth = 0;
  parent: FieldInstanceResult | undefined;
  childGroups: number[] = [];
  turtleDef: TurtleDef;
  firstSegment: PipeSegment;
  hasHaving = false;
  ungroupedSets = new Map<string, UngroupSet>();
  // query: QueryQuery;

  resultUsesUngrouped = false;

  constructor(turtleDef: TurtleDef, parent: FieldInstanceResult | undefined) {
    this.parent = parent;
    this.turtleDef = turtleDef;
    this.firstSegment = turtleDef.pipeline[0];
  }

  addField(as: string, field: QueryField, usage: FieldUsage) {
    let fi;
    if ((fi = this.allFields.get(as))) {
      if (fi.type === "query") {
        throw new Error(
          `Redefinition of field ${field.fieldDef.name} as struct`
        );
      }
      const fif = fi as FieldInstanceField;
      if (fif.fieldUsage.type === "result") {
        if (usage.type !== "result") {
          // its already in the result, we can just ignore it.
          return;
        } else {
          throw new Error(
            `Ambiguous output field name '${field.fieldDef.name}'.`
          );
        }
      }
    }
    this.add(as, new FieldInstanceField(field, usage, this));
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

  getFieldByNumber(index: number): { name: string; fif: FieldInstanceField } {
    for (const [name, fi] of this.allFields) {
      if (fi instanceof FieldInstanceField) {
        if (
          fi.fieldUsage.type === "result" &&
          fi.fieldUsage.resultIndex === index
        ) {
          return { name, fif: fi };
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
      if (fi.type === "query") {
        const fir = fi as FieldInstanceResult;
        isComplex = true;
        if (fir.firstSegment.type === "reduce") {
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
    return { nextGroupSetNumber, maxDepth, children, isComplex };
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
    const ret = [];
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
    let ret: RepeatedResultType = "inline_all_numbers";
    for (const f of this.fields()) {
      if (f.fieldUsage.type === "result") {
        if (isScalarField(f.f)) {
          return "nested";
        }
        if (f.f instanceof QueryStruct) {
          ret = "inline";
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
        if (fi.fieldUsage.type === "result") {
          firstField ||= fi.fieldUsage.resultIndex;
          if (["date", "timestamp"].indexOf(fi.f.fieldDef.type) > -1) {
            return [{ dir: "desc", field: fi.fieldUsage.resultIndex }];
          } else if (isAggregateField(fi.f)) {
            return [{ dir: "desc", field: fi.fieldUsage.resultIndex }];
          }
        }
      }
    }
    if (firstField) {
      return [{ dir: "asc", field: firstField }];
    }
    return [];
  }

  addStructToJoin(
    qs: QueryStruct,
    query: QueryQuery,
    mayNeedUniqueKey: boolean,
    joinStack: string[]
  ): void {
    const name = qs.getIdentifier();

    // we're already chasing the dependency for this join.
    if (joinStack.indexOf(name) !== -1) {
      return;
    }

    let join;
    if ((join = this.root().joins.get(name))) {
      join.mayNeedUniqueKey ||= mayNeedUniqueKey;
      return;
    }

    // if we have a parent, join it first.
    let parent: JoinInstance | undefined;
    const parentStruct = qs.parent?.getJoinableParent();
    if (parentStruct) {
      // add dependant expressions first...
      this.addStructToJoin(parentStruct, query, false, joinStack);
      parent = this.root().joins.get(parentStruct.getIdentifier());
    }

    // add any dependant joins based on the ON
    const sr = qs.fieldDef.structRelationship;
    if (
      isJoinOn(sr) &&
      qs.parent && // if the join has an ON, it must thave a parent
      sr.onExpression !== undefined &&
      joinStack.indexOf(name) === -1
    ) {
      query.addDependantExpr(this, qs.parent, sr.onExpression, [
        ...joinStack,
        name,
      ]);
    }

    if (!(join = this.root().joins.get(name))) {
      join = new JoinInstance(qs, name, parent);
      this.root().joins.set(name, join);
    }
    join.mayNeedUniqueKey ||= mayNeedUniqueKey;
  }

  findJoins(query: QueryQuery) {
    for (const dim of this.fields()) {
      this.addStructToJoin(
        dim.f.getJoinableParent(),
        query,
        dim.f.mayNeedUniqueKey(),
        []
      );
    }
    for (const s of this.structs()) {
      s.findJoins(query);
    }
  }

  root(): FieldInstanceResultRoot {
    if (this.parent) {
      return this.parent.root();
    }
    throw new Error(`Internal Error, Null parent FieldInstanceResult`);
  }

  getUngroupPartitions(
    ungroupSet: UngroupSet | undefined
  ): FieldInstanceField[] {
    let ret: FieldInstanceField[] = [];

    let p: FieldInstanceResult | undefined = this as FieldInstanceResult;
    let excludeFields: string[] = [];
    let inScopeFieldNames: string[] = [];
    // all defaults to all fields at the current level.
    if (ungroupSet === undefined || ungroupSet.type === "all") {
      // fields specified an an all, convert it to an exclude set.
      const allFields = ungroupSet?.fields || [];
      // convert an All into the equivalent exclude
      excludeFields = this.fields(
        (fi) =>
          isScalarField(fi.f) &&
          fi.fieldUsage.type === "result" &&
          allFields.indexOf(fi.f.getIdentifier()) === -1
      ).map((fi) => fi.f.getIdentifier());
    } else {
      excludeFields = ungroupSet.fields;
    }
    let firstScope = true;
    while (p !== undefined) {
      // get a list of valid fieldnames for the current scope.
      if (firstScope || ungroupSet?.type === "exclude") {
        inScopeFieldNames = inScopeFieldNames.concat(
          p
            .fields(
              (fi) => isScalarField(fi.f) && fi.fieldUsage.type === "result"
            )
            .map((fi) => fi.f.getIdentifier())
        );
      }
      ret = ret.concat(
        p.fields(
          (fi) =>
            isScalarField(fi.f) &&
            fi.fieldUsage.type === "result" &&
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

/* Root Result as opposed to a turtled result */
class FieldInstanceResultRoot extends FieldInstanceResult {
  joins = new Map<string, JoinInstance>();
  havings = new AndChain();
  isComplexQuery = false;
  queryUsesUngrouped = false;
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
    if (this.elimatedComputeGroups || this.computeOnlyGroups.length == 0) {
      return "";
    } else {
      this.elimatedComputeGroups = true;
      return `group_set NOT IN (${this.computeOnlyGroups.join(",")})`;
    }
  }

  // look at all the fields again in the structs in the query

  calculateSymmetricAggregates() {
    let leafiest;
    for (const [name, join] of this.joins) {
      // first join is by default the
      const relationship = join.parentRelationship();
      if (relationship === "many_to_many") {
        // everything must be calculated with symmetric aggregates
        leafiest = "0never";
      } else if (leafiest === undefined) {
        leafiest = name;
      } else if (join.parentRelationship() === "one_to_many") {
        // check up the parent relationship until you find
        //  the current leafiest node.  If it isn't in the direct path
        //  we need symmetric aggregate for everything.
        //  if it is in the path, than this one becomes leafiest
        const s = join.queryStruct;
        if (s.parent && s.parent.getIdentifier() === leafiest) {
          leafiest = name;
        } else {
          // we have more than on one_to_many join chain, all bets are off.
          leafiest = "0never";
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
      // don't need keys on leafiest
      if (!join.leafiest && join.mayNeedUniqueKey) {
        let j: JoinInstance | undefined = join;
        while (j) {
          if (!j.queryStruct.primaryKey()) {
            j.makeUniqueKey = true;
          }
          if (j.queryStruct.fieldDef.structRelationship.type === "nested") {
            j = j.parent;
          } else {
            j = undefined;
          }
        }
      }
    }
  }
}

class JoinInstance {
  mayNeedUniqueKey = false;
  makeUniqueKey = false;
  leafiest = false;
  parent: JoinInstance | undefined;
  queryStruct: QueryStruct;
  joinFilterConditions?: QueryFieldBoolean[];
  alias: string;
  children: JoinInstance[] = [];
  constructor(
    queryStruct: QueryStruct,
    alias: string,
    parent: JoinInstance | undefined
  ) {
    this.queryStruct = queryStruct;
    this.parent = parent;
    this.alias = alias;
    if (parent) {
      parent.children.push(this);
    }

    // convert the filter list into a list of boolean fields so we can
    //  generate dependancies and code for them.
    if (this.queryStruct.fieldDef.filterList) {
      for (const filter of this.queryStruct.fieldDef.filterList) {
        this.joinFilterConditions = [];
        const qf = new QueryFieldBoolean(
          {
            type: "boolean",
            name: "ignoreme",
            e: filter.expression,
          },
          this.queryStruct
        );
        this.joinFilterConditions.push(qf);
      }
    }
  }

  parentRelationship(): "root" | JoinRelationship {
    if (this.queryStruct.parent === undefined) {
      return "root";
    }
    switch (this.queryStruct.fieldDef.structRelationship.type) {
      case "one":
        return "many_to_one";
      case "cross":
        return "many_to_many";
      case "many":
        return "one_to_many";
      case "nested":
        return "one_to_many";
      case "inline":
        return "one_to_one";
      default:
        throw new Error(
          `Internal error unknown relationship type to parent for ${this.queryStruct.fieldDef.name}`
        );
    }
  }

  // postgres unnest needs to know the names of the physical fields.
  getDialectFieldList(): DialectFieldList {
    const dialectFieldList: DialectFieldList = [];

    for (const f of this.queryStruct.fieldDef.fields.filter(isPhysical)) {
      dialectFieldList.push({
        type: f.type,
        sqlExpression: getIdentifier(f),
        sqlOutputName: getIdentifier(f),
      });
    }
    return dialectFieldList;
  }
}

/** nested query */
class QueryTurtle extends QueryField {}

/**
 * Used by the translator to get the output StructDef of a pipe segment
 *
 * half translated to the new world of types ..
 */
export class Segment {
  // static nextStructDef(s: StructDef, q: AnonymousQueryDef): StructDef
  static nextStructDef(structDef: StructDef, segment: PipeSegment): StructDef {
    const qs = new QueryStruct(structDef, {
      model: new QueryModel(undefined),
    });
    const turtleDef: TurtleDef = {
      type: "turtle",
      name: "ignoreme",
      pipeline: [segment],
    };

    const queryQueryQuery = QueryQuery.makeQuery(
      turtleDef,
      qs,
      new StageWriter(true, undefined) // stage write indicates we want to get a result.
    );
    return queryQueryQuery.getResultStructDef();
  }
}

type StageGroupMaping = { fromGroup: number; toGroup: number };

type StageOutputContext = {
  sql: string[]; // sql expressions
  lateralJoinSQLExpressions: string[];
  dimensionIndexes: number[]; // which indexes are dimensions
  fieldIndex: number;
  groupsAggregated: StageGroupMaping[]; // which groups were aggregated
  outputPipelinedSQL: OutputPipelinedSQL[]; // secondary stages for turtles.
};

/** Query builder object. */
class QueryQuery extends QueryField {
  fieldDef: TurtleDef;
  firstSegment: PipeSegment;
  prepared = false;
  maxDepth = 0;
  maxGroupSet = 0;
  rootResult: FieldInstanceResultRoot;
  resultStage: string | undefined;
  stageWriter: StageWriter | undefined;

  constructor(
    fieldDef: TurtleDef,
    parent: QueryStruct,
    stageWriter: StageWriter | undefined
  ) {
    super(fieldDef, parent);
    this.fieldDef = fieldDef;
    this.rootResult = new FieldInstanceResultRoot(fieldDef);
    this.stageWriter = stageWriter;
    // do some magic here to get the first segment.
    this.firstSegment = fieldDef.pipeline[0] as QuerySegment;
  }

  static makeQuery(
    fieldDef: TurtleDef,
    parentStruct: QueryStruct,
    stageWriter: StageWriter | undefined = undefined
  ): QueryQuery {
    let flatTurtleDef = parentStruct.flattenTurtleDef(fieldDef);
    let parent = parentStruct;

    const firstStage = flatTurtleDef.pipeline[0];

    // if we are generating code
    //  and have extended declaration, we need to make a new QueryStruct
    //  copy the definitions into a new structdef
    //  edit the declations from the pipeline
    if (
      stageWriter !== undefined &&
      isQuerySegment(firstStage) &&
      firstStage.extendSource !== undefined
    ) {
      parent = new QueryStruct(
        {
          ...parentStruct.fieldDef,
          fields: [...parentStruct.fieldDef.fields, ...firstStage.extendSource],
        },
        parent.parent ? { struct: parent } : { model: parent.model }
      );
      flatTurtleDef = {
        ...flatTurtleDef,
        pipeline: [
          {
            ...firstStage,
            extendSource: undefined,
          },
          ...flatTurtleDef.pipeline.slice(1),
        ],
      };
    }

    switch (firstStage.type) {
      case "reduce":
        return new QueryQueryReduce(flatTurtleDef, parent, stageWriter);
      case "project":
        return new QueryQueryProject(flatTurtleDef, parent, stageWriter);
      case "index":
        return new QueryQueryIndex(flatTurtleDef, parent, stageWriter);
    }
  }

  getFieldList(): QueryFieldDef[] {
    switch (this.firstSegment.type) {
      // case "index":
      //   return this.firstSegment.fields || [];
      case "reduce":
        return this.firstSegment.fields;
      // probably need some way of checking type class of field here...
      //  project should only contain scalars
      case "project":
        return this.firstSegment.fields;
      default:
        throw new Error(
          `Query contains no fields ${JSON.stringify(this.fieldDef)}`
        );
    }
  }

  // get a field ref and expand it.
  expandField(f: QueryFieldDef) {
    let as;
    let field: QuerySomething;
    // if it is a string
    if (typeof f === "string") {
      field = this.parent.getQueryFieldByName(f);
    } else if ("type" in f) {
      field = this.parent.makeQueryField(f);
    }
    // or FilteredAliasedName or a hacked timestamp field.
    else if ("name" in f && "as" in f) {
      field = this.parent.getQueryFieldByName(f.name);
      // QueryFieldStructs return new names...
      as = field.fieldDef.as || f.as;

      if (field instanceof QueryFieldStruct) {
        throw new Error(
          "Syntax currently disallowed. Semantics up for discussion"
        );
      }

      // Types of aliased fields.
      // turtles
      // Timestamps and Dates (are just fine to leave as is).
      // measures

      let e: Expr;
      if (field instanceof QueryQuery) {
        const newFieldDef: TurtleDefPlus = cloneDeep(field.fieldDef);
        newFieldDef.as = f.name;
        newFieldDef.filterList = f.filterList;
        field = QueryQuery.makeQuery(newFieldDef, this.parent);
      } else if (
        !(
          field instanceof QueryFieldTimestamp ||
          field instanceof QueryFieldDate
        )
      ) {
        // its a measure
        e = [{ type: "field", path: field.getFullOutputName() }];
        if ("filterList" in f && f.filterList) {
          e = [{ type: "filterExpression", filterList: f.filterList, e: e }];
        }
        const newFieldDef = {
          type: field.fieldDef.type,
          name: f.as,
          e,
          aggregate: isAggregateField(field as QueryField),
        };
        field = this.parent.makeQueryField(newFieldDef as FieldDef);
      }

      // or inline field FieldTypeDef
    } else {
      throw new Error(
        `Unrecognized field definition ${JSON.stringify(f, undefined, 2)}`
      );
    }
    if (!as) {
      as = field.getIdentifier();
    }
    return { as, field };
  }

  expandDependantField(resultStruct: FieldInstanceResult, fieldRef: FieldRef) {
    this.expandField(fieldRef);
  }

  // find all the fieldNames in the struct (and children)
  //  that match the filter
  expandWildCardStruct(
    struct: QueryStruct,
    expandChildren: boolean,
    filter: ((qf: QueryNode) => boolean) | undefined = undefined
  ): string[] {
    let fieldNames: string[] = [];
    const structs = [];

    for (const [_name, f] of struct.nameMap) {
      if (
        f instanceof QueryAtomicField &&
        isScalarField(f) &&
        f.includeInWildcard() &&
        !this.parent.dialect.ignoreInProject(f.fieldDef.name) &&
        (!filter || filter(f))
      ) {
        // fieldNames.push(`${struct.getFullOutputName()}${name}`);
        fieldNames.push(f.getFullOutputName());
      } else if (f instanceof QueryStruct && expandChildren) {
        structs.push(f);
      }
    }
    for (const s of structs) {
      fieldNames = fieldNames.concat(
        this.expandWildCardStruct(s, expandChildren, filter)
      );
    }
    return fieldNames;
  }

  // Do any '*' expansion.
  expandWildCards(
    fields: QueryFieldDef[],
    filter: ((qf: QueryNode) => boolean) | undefined = undefined
  ): QueryFieldDef[] {
    let ret: QueryFieldDef[] = [];
    for (const f of fields) {
      if (typeof f !== "string") {
        ret.push(f);
      } else {
        const fieldName = f;
        const path = fieldName.split(".");
        if (!path[path.length - 1].startsWith("*")) {
          ret.push(f);
        } else {
          const expandChildren = path.pop() === "**";
          let struct = this.parent;
          let pathElementName;
          while (path.length > 0 && (pathElementName = path.shift())) {
            const structNode = struct.getChildByName(pathElementName);
            if (structNode === undefined) {
              throw new Error(`Nested explore not found '${pathElementName}'`);
            }
            if (structNode instanceof QueryStruct) {
              struct = structNode;
            } else {
              throw new Error(`'${pathElementName}' is not an explore object`);
            }
          }
          ret = ret.concat(
            this.expandWildCardStruct(struct, expandChildren, filter)
          );
        }
      }
    }
    return ret;
  }

  addDependantPath(
    resultStruct: FieldInstanceResult,
    context: QueryStruct,
    path: string,
    mayNeedUniqueKey: boolean,
    joinStack: string[]
  ) {
    const node = context.getFieldByName(path);
    let struct;
    if (node instanceof QueryField) {
      struct = node.parent;
    } else if (node instanceof QueryStruct) {
      struct = node;
    } else {
      throw new Error(`Internal Error:  Unknown object type`);
    }
    resultStruct
      .root()
      .addStructToJoin(
        struct.getJoinableParent(),
        this,
        mayNeedUniqueKey,
        joinStack
      );
  }

  addDependantExpr(
    resultStruct: FieldInstanceResult,
    context: QueryStruct,
    e: Expr,
    joinStack: string[]
  ): void {
    for (const expr of e) {
      if (isUngroupFragment(expr)) {
        resultStruct.resultUsesUngrouped = true;
        resultStruct.root().isComplexQuery = true;
        resultStruct.root().queryUsesUngrouped = true;
        if (expr.fields && expr.fields.length > 0) {
          const key = expr.fields.sort().join("|") + expr.type;
          if (resultStruct.ungroupedSets.get(key) === undefined) {
            resultStruct.ungroupedSets.set(key, {
              type: expr.type,
              fields: expr.fields,
              groupSet: -1,
            });
          }
        }

        this.addDependantExpr(resultStruct, context, expr.e, joinStack);
      } else if (isFieldFragment(expr)) {
        const field = context.getDimensionOrMeasureByName(expr.path);
        if (hasExpression(field.fieldDef)) {
          this.addDependantExpr(
            resultStruct,
            field.parent,
            field.fieldDef.e,
            joinStack
          );
        } else {
          resultStruct
            .root()
            .addStructToJoin(
              field.parent.getJoinableParent(),
              this,
              false,
              joinStack
            );
          // this.addDependantPath(resultStruct, field.parent, expr.path, false);
        }
      } else if (isFilterFragment(expr)) {
        for (const filterCond of expr.filterList) {
          this.addDependantExpr(
            resultStruct,
            context,
            filterCond.expression,
            joinStack
          );
        }
      } else if (isDialectFragment(expr)) {
        const expressions: Expr[] = [];
        switch (expr.function) {
          case "now":
            break;
          case "div":
            expressions.push(expr.denominator);
            expressions.push(expr.numerator);
            break;
          case "timeLiteral":
            break;
          case "timeDiff":
            expressions.push(expr.left.value, expr.right.value);
            break;
          case "delta":
            expressions.push(expr.base.value, expr.delta);
            break;
          case "trunc":
          case "extract":
            expressions.push(expr.expr.value);
            break;
          case "regexpMatch":
          case "cast":
            expressions.push(expr.expr);
            break;
          default:
            throw new Error(
              "Unknown dialect Fragment type.  Can't generate dependancies"
            );
        }
        for (const e of expressions) {
          this.addDependantExpr(resultStruct, context, e, joinStack);
        }
      } else if (isAggregateFragment(expr)) {
        if (isAsymmetricFragment(expr)) {
          if (expr.structPath) {
            this.addDependantPath(
              resultStruct,
              context,
              expr.structPath,
              true,
              joinStack
            );
          } else {
            // we are doing a sum in the root.  It may need symetric aggregates
            resultStruct.addStructToJoin(context, this, true, joinStack);
          }
        }
        this.addDependantExpr(resultStruct, context, expr.e, joinStack);
      }
    }
  }

  addDependancies(resultStruct: FieldInstanceResult, field: QueryField): void {
    if (hasExpression(field.fieldDef)) {
      this.addDependantExpr(resultStruct, field.parent, field.fieldDef.e, []);
    }
  }

  expandFields(resultStruct: FieldInstanceResult) {
    let resultIndex = 1;
    for (const f of this.expandWildCards(resultStruct.firstSegment.fields)) {
      const { as, field } = this.expandField(f);

      if (field instanceof QueryTurtle || field instanceof QueryQuery) {
        if (this.firstSegment.type === "project") {
          throw new Error(
            `Turtled Queries cannot be used in PROJECT - '${field.fieldDef.name}'`
          );
        }
        const fir = new FieldInstanceResult(
          field.fieldDef as TurtleDef,
          resultStruct
        );
        this.expandFields(fir);
        resultStruct.add(as, fir);
      } else if (field instanceof QueryAtomicField) {
        resultStruct.addField(as, field, {
          resultIndex,
          type: "result",
        });
        this.addDependancies(resultStruct, field);

        if (isAggregateField(field)) {
          if (this.firstSegment.type === "project") {
            throw new Error(
              `Aggregate Fields cannot be used in PROJECT - '${field.fieldDef.name}'`
            );
          }
        }
        // } else if (field instanceof QueryStruct) {
        //   // this could probably be optimized.  We are adding the primary key of the joined structure
        //   //  instead of the foreignKey.  We have to do this in at least the INNER join case
        //   //  so i'm just going to let the SQL database do the optimization (which is pretty rudimentary)
        //   const pkFieldDef = field.getAsQueryField();
        //   resultStruct.addField(as, pkFieldDef, {
        //     resultIndex,
        //     type: "result",
        //   });
        //   resultStruct.addStructToJoin(field, false);
      }
      // else if (
      //   this.firstSegment.type === "project" &&
      //   field instanceof QueryStruct
      // ) {
      //   // TODO lloyd refactor or comment why we do nothing here
      // } else {
      //   throw new Error(`'${as}' cannot be used as in this way.`);
      // }
      resultIndex++;
    }
    this.expandFilters(resultStruct);
  }

  expandFilters(resultStruct: FieldInstanceResult) {
    if (resultStruct.firstSegment.filterList === undefined) {
      return;
    }
    // Go through the filters and make or find dependant fields
    //  add them to the field index. Place the individual filters
    // in the correct catgory.
    for (const cond of resultStruct.firstSegment.filterList || []) {
      const context = this.parent;
      this.addDependantExpr(resultStruct, context, cond.expression, []);
    }
    for (const join of resultStruct.root().joins.values() || []) {
      for (const qf of join.joinFilterConditions || []) {
        if (qf.fieldDef.type === "boolean" && qf.fieldDef.e) {
          this.addDependantExpr(resultStruct, qf.parent, qf.fieldDef.e, []);
        }
      }
    }
  }

  generateSQLFilters(
    resultStruct: FieldInstanceResult,
    which: "where" | "having",
    filterList: FilterExpression[] | undefined = undefined
  ): AndChain {
    const resultFilters = new AndChain();
    const list = filterList || resultStruct.firstSegment.filterList;
    if (list === undefined) {
      return resultFilters;
    }
    // Go through the filters and make or find dependant fields
    //  add them to the field index. Place the individual filters
    // in the correct catgory.
    for (const cond of list || []) {
      const context = this.parent;

      if (
        (which === "having" && cond.aggregate) ||
        (which === "where" && !cond.aggregate)
      ) {
        const sqlClause = this.generateExpressionFromExpr(
          resultStruct,
          context,
          cond.expression,
          undefined
        );
        resultFilters.add(sqlClause);
      }
    }
    return resultFilters;
  }

  prepare(_stageWriter: StageWriter | undefined) {
    if (!this.prepared) {
      this.expandFields(this.rootResult);
      this.rootResult.findJoins(this);
      this.rootResult.calculateSymmetricAggregates();
      this.prepared = true;
    }
  }

  // get the source fieldname and filters associated with the field (so we can drill later)
  getResultMetadata(
    fi: FieldInstance
  ): ResultStructMetadataDef | ResultMetadataDef | undefined {
    if (fi instanceof FieldInstanceField) {
      if (fi.fieldUsage.type === "result") {
        const fieldDef = fi.f.fieldDef as FieldAtomicDef;
        let filterList;
        const sourceField =
          fi.f.parent.getFullOutputName() + (fieldDef.name || fieldDef.as);
        const sourceExpression: string | undefined = fieldDef.code;
        const sourceClasses = [sourceField];
        if (isAggregateField(fi.f)) {
          filterList = fi.f.getFilterList();
          return {
            sourceField,
            sourceExpression,
            filterList,
            sourceClasses,
            fieldKind: "measure",
          };
        }
        if (isScalarField(fi.f)) {
          return {
            sourceField,
            sourceExpression,
            filterList,
            sourceClasses,
            fieldKind: "dimension",
          };
        } else {
          return undefined;
        }
      }
      return undefined;
    } else if (fi instanceof FieldInstanceResult) {
      const sourceField = fi.turtleDef.name || fi.turtleDef.as;
      const sourceClasses = sourceField ? [sourceField] : [];
      const filterList = fi.firstSegment.filterList;
      const limit =
        fi.turtleDef.pipeline[fi.turtleDef.pipeline.length - 1].limit;
      if (sourceField) {
        return {
          sourceField,
          filterList,
          sourceClasses,
          fieldKind: "struct",
          limit,
        };
      }
    }
    return undefined;
  }

  /**  returns a fields and primary key of a struct for this query */
  getResultStructDef(
    resultStruct: FieldInstanceResult = this.rootResult,
    isRoot = true
  ): StructDef {
    const fields: FieldDef[] = [];
    let primaryKey;
    this.prepare(undefined);

    let dimCount = 0;
    for (const [name, fi] of resultStruct.allFields) {
      const resultMetadata = this.getResultMetadata(fi);
      if (fi instanceof FieldInstanceResult) {
        const { structDef } = this.generateTurtlePipelineSQL(
          fi,
          new StageWriter(true, undefined),
          "<nosource>"
        );

        // LTNOTE: This is probably broken now.  Need to look at the last stage
        //  to figure out the resulting nested/inline state...

        const resultType =
          fi.getRepeatedResultType() === "nested" ? "nested" : "inline";
        structDef.name = name;
        structDef.structRelationship = {
          field: name,
          type: resultType,
          isArray: false,
        };
        structDef.structSource = { type: resultType };
        structDef.resultMetadata = resultMetadata;
        fields.push(structDef);
      } else if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === "result") {
          if (fi.f instanceof QueryFieldStruct) {
            fields.push(fi.f.getAsJoinedStructDef(name));
          }
          // if there is only one dimension, it is the primaryKey
          //  if there are more, primaryKey is undefined.
          if (isScalarField(fi.f)) {
            if (dimCount === 0 && isRoot) {
              primaryKey = name;
            } else {
              primaryKey = undefined;
            }
            dimCount++;
          }

          const location = fi.f.fieldDef.location;

          // build out the result fields...
          switch (fi.f.fieldDef.type) {
            case "boolean":
            case "string":
              fields.push({
                name,
                type: fi.f.fieldDef.type,
                resultMetadata,
                location,
              });
              break;
            case "timestamp": {
              const timeframe = fi.f.fieldDef.timeframe;
              switch (timeframe) {
                case "year":
                case "month":
                case "week":
                case "quarter":
                case "day":
                  fields.push({
                    name,
                    type: "date",
                    timeframe,
                    resultMetadata,
                    location,
                  });
                  break;
                case "second":
                case "minute":
                case "hour":
                  fields.push({
                    name,
                    type: "timestamp",
                    timeframe,
                    resultMetadata,
                    location,
                  });
                  break;
                default:
                  fields.push({
                    name,
                    type: "timestamp",
                    resultMetadata,
                    location,
                  });
                  break;
              }
              break;
            }
            case "date": {
              fields.push({
                name,
                type: fi.f.fieldDef.type,
                timeframe: fi.f.fieldDef.timeframe,
                resultMetadata,
                location,
              });
              break;
            }
            case "number":
              fields.push({
                name,
                numberType: fi.f.fieldDef.numberType,
                type: "number",
                resultMetadata,
                location,
              });
              break;
            default:
              throw new Error(
                `unknown Field Type in query ${JSON.stringify(fi.f.fieldDef)}`
              );
          }
        }
      }
    }
    return {
      fields,
      name: this.resultStage || "result",
      dialect: this.parent.dialect.name,
      primaryKey,
      structRelationship: {
        type: "basetable",
        connectionName: this.parent.connectionName,
      },
      structSource: { type: "query_result" },
      resultMetadata: this.getResultMetadata(this.rootResult),
      type: "struct",
    };
  }

  generateSQLJoinBlock(stageWriter: StageWriter, ji: JoinInstance): string {
    let s = "";
    const qs = ji.queryStruct;
    const structRelationship = qs.fieldDef.structRelationship;
    let structSQL = qs.structSourceSQL(stageWriter);
    if (isJoinOn(structRelationship)) {
      if (ji.makeUniqueKey) {
        structSQL = `(SELECT ${qs.dialect.sqlGenerateUUID()} as __distinct_key, * FROM ${structSQL})`;
      }
      let onCondition = "";
      if (qs.parent === undefined) {
        throw new Error("Expected joined struct to have a parent.");
      }
      if (structRelationship.onExpression) {
        onCondition = new QueryFieldBoolean(
          {
            type: "boolean",
            name: "ignoreme",
            e: structRelationship.onExpression,
          },
          qs.parent
        ).generateExpression(this.rootResult);
      } else {
        onCondition = "1=1";
      }
      let filters = "";
      let conditions = undefined;
      if (ji.joinFilterConditions) {
        conditions = ji.joinFilterConditions.map((qf) =>
          qf.generateExpression(this.rootResult)
        );
      }
      if (ji.children.length === 0 || conditions === undefined) {
        if (conditions !== undefined && conditions.length >= 1) {
          filters = ` AND (${conditions.join(" AND ")})`;
        }
        s += `LEFT JOIN ${structSQL} AS ${ji.alias}\n  ON ${onCondition}${filters}\n`;
      } else {
        let select = `SELECT ${ji.alias}.*`;
        let joins = "";
        for (const childJoin of ji.children) {
          joins += this.generateSQLJoinBlock(stageWriter, childJoin);
          const physicalFields = getPhysicalFields(
            childJoin.queryStruct.fieldDef
          ).map((fieldDef) =>
            this.parent.dialect.sqlMaybeQuoteIdentifier(fieldDef.name)
          );
          select += `, ${this.parent.dialect.sqlSelectAliasAsStruct(
            childJoin.alias,
            physicalFields
          )} AS ${childJoin.alias}`;
        }
        select += `\nFROM ${structSQL} AS ${
          ji.alias
        }\n${joins}\nWHERE ${conditions?.join(" AND ")}\n`;
        s += `LEFT JOIN (\n${indent(select)}) AS ${
          ji.alias
        }\n  ON ${onCondition}\n`;
        return s;
      }
    } else if (structRelationship.type === "nested") {
      if (qs.parent === undefined || ji.parent === undefined) {
        throw new Error("Internal Error, nested structure with no parent.");
      }
      const fieldExpression = this.parent.dialect.sqlFieldReference(
        qs.parent.getSQLIdentifier(),
        structRelationship.field as string,
        "struct",
        qs.parent.fieldDef.structRelationship.type === "nested",
        this.parent.fieldDef.structRelationship.type === "nested" &&
          this.parent.fieldDef.structRelationship.isArray
      );
      // we need to generate primary key.  If parent has a primary key combine
      s += `${this.parent.dialect.sqlUnnestAlias(
        fieldExpression,
        ji.alias,
        ji.getDialectFieldList(),
        ji.makeUniqueKey,
        structRelationship.isArray
      )}\n`;
    } else if (structRelationship.type === "inline") {
      throw new Error(
        "Internal Error: inline structs should never appear in join trees"
      );
    } else {
      throw new Error(
        `Join type not implemented ${JSON.stringify(
          qs.fieldDef.structRelationship
        )}`
      );
    }
    for (const childJoin of ji.children) {
      s += this.generateSQLJoinBlock(stageWriter, childJoin);
    }
    return s;
  }

  generateSQLJoins(stageWriter: StageWriter): string {
    let s = "";
    // get the first value from the map (weird, I know)
    const [[, ji]] = this.rootResult.joins;
    const qs = ji.queryStruct;
    // Joins
    let structSQL = qs.structSourceSQL(stageWriter);
    if (isIndexSegment(this.firstSegment)) {
      structSQL = this.parent.dialect.sqlSampleTable(
        structSQL,
        this.firstSegment.sample
      );
      if (this.firstSegment.sample) {
        structSQL = stageWriter.addStage(
          `SELECT * from ${structSQL} as x limit 100000 `
        );
      }
    }
    const structRelationship = qs.fieldDef.structRelationship;
    if (structRelationship.type === "basetable") {
      if (ji.makeUniqueKey) {
        structSQL = `(SELECT ${qs.dialect.sqlGenerateUUID()} as __distinct_key, * FROM ${structSQL} as x)`;
      }
      s += `FROM ${structSQL} as ${this.parent.getIdentifier()}\n`;
    } else {
      throw new Error("Internal Error, queries must start from a basetable");
    }

    for (const childJoin of ji.children) {
      s += this.generateSQLJoinBlock(stageWriter, childJoin);
    }
    return s;
  }

  genereateSQLOrderBy(
    queryDef: QuerySegment,
    resultStruct: FieldInstanceResult
  ): string {
    let s = "";
    if (this.firstSegment.type === "project" && !queryDef.orderBy) {
      return ""; // No default ordering for project.
    }
    const orderBy = queryDef.orderBy || resultStruct.calculateDefaultOrderBy();
    const o = [];
    for (const f of orderBy) {
      if (typeof f.field === "string") {
        // convert name to an index
        const fi = resultStruct.getField(f.field);
        if (fi && fi.fieldUsage.type === "result") {
          o.push(`${fi.fieldUsage.resultIndex} ${f.dir || "ASC"}`);
        } else {
          throw new Error(`Unknown field in ORDER BY ${f.field}`);
        }
      } else {
        o.push(`${f.field} ${f.dir || "ASC"}`);
      }
    }
    if (o.length > 0) {
      s = this.parent.dialect.sqlOrderBy(o) + `\n`;
    }
    return s;
  }

  generateSimpleSQL(stageWriter: StageWriter): string {
    let s = "";
    s += "SELECT \n";
    const fields = [];

    for (const [name, field] of this.rootResult.allFields) {
      const fi = field as FieldInstanceField;
      const sqlName = this.parent.dialect.sqlMaybeQuoteIdentifier(name);
      if (fi.fieldUsage.type === "result") {
        fields.push(
          ` ${fi.f.generateExpression(this.rootResult)} as ${sqlName}`
        );
      }
    }
    s += indent(fields.join(",\n")) + "\n";

    s += this.generateSQLJoins(stageWriter);
    s += this.generateSQLFilters(this.rootResult, "where").sql("where");

    // group by
    if (this.firstSegment.type === "reduce") {
      const n = [];
      for (const field of this.rootResult.fields()) {
        const fi = field as FieldInstanceField;
        if (fi.fieldUsage.type === "result" && isScalarField(fi.f)) {
          n.push(fi.fieldUsage.resultIndex.toString());
        }
      }
      if (n.length > 0) {
        s += `GROUP BY ${n.join(",")}\n`;
      }
    }

    s += this.generateSQLFilters(this.rootResult, "having").sql("having");

    // order by
    s += this.genereateSQLOrderBy(
      this.firstSegment as QuerySegment,
      this.rootResult
    );

    // limit
    if (this.firstSegment.limit) {
      s += `LIMIT ${this.firstSegment.limit}\n`;
    }
    this.resultStage = stageWriter.addStage(s);
    return this.resultStage;
  }

  // This probably should be generated in a dialect independat way.
  //  but for now, it is just googleSQL.
  generatePipelinedStages(
    outputPipelinedSQL: OutputPipelinedSQL[],
    lastStageName: string,
    stageWriter: StageWriter
  ): string {
    if (outputPipelinedSQL.length === 0) {
      return lastStageName;
    }
    const pipelinesSQL = outputPipelinedSQL
      .map(
        (o) =>
          `${o.pipelineSQL} as ${o.sqlFieldName}
      `
      )
      .join(",\n");
    return stageWriter.addStage(
      `SELECT * replace (${pipelinesSQL}) FROM ${lastStageName}
      `
    );
  }

  generateStage0Fields(
    resultSet: FieldInstanceResult,
    output: StageOutputContext,
    stageWriter: StageWriter
  ) {
    for (const [name, fi] of resultSet.allFields) {
      const outputName = this.parent.dialect.sqlMaybeQuoteIdentifier(
        `${name}__${resultSet.groupSet}`
      );
      if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === "result") {
          const exp = fi.getSQL();
          if (isScalarField(fi.f)) {
            if (
              this.parent.dialect.name === "standardsql" &&
              this.rootResult.queryUsesUngrouped
            ) {
              // BigQuery can't partition aggregate function except when the field has no
              //  expression.  Additionally it can't partition by floats.  We stuff expressions
              //  and numbers as strings into a lateral join when the query has ungrouped expressions
              if (fi.f.fieldDef.type === "number") {
                // make an extra dimension as a string
                output.sql.push(`${exp} as ${outputName}`);
                const outputFieldName = `__lateral_join_bag.${outputName}_string`;
                output.sql.push(outputFieldName);
                output.dimensionIndexes.push(output.fieldIndex++);
                output.lateralJoinSQLExpressions.push(
                  `CAST(${exp} as STRING) as ${outputName}_string`
                );
                fi.partitionSQL = outputFieldName;
              } else {
                const outputFieldName = `__lateral_join_bag.${outputName}`;
                fi.partitionSQL = outputFieldName;
                output.lateralJoinSQLExpressions.push(
                  `${exp} as ${outputName}`
                );
                output.sql.push(outputFieldName);
              }
            } else {
              // just treat it like a regular field.
              output.sql.push(`${exp} as ${outputName}`);
            }
            output.dimensionIndexes.push(output.fieldIndex++);
          } else if (isAggregateField(fi.f)) {
            output.sql.push(`${exp} as ${outputName}`);
            output.fieldIndex++;
          }
        }
      } else if (fi instanceof FieldInstanceResult) {
        if (fi.firstSegment.type === "reduce") {
          this.generateStage0Fields(fi, output, stageWriter);
        } else if (fi.firstSegment.type === "project") {
          const s = this.generateTurtleSQL(
            fi,
            stageWriter,
            outputName,
            output.outputPipelinedSQL
          );
          output.sql.push(`${s} as ${outputName}`);
          output.fieldIndex++;
        }
      }
    }
    // LTNOTE: we could optimize here in the future.
    //  leaf turtles can have their having clauses in the main query
    //  turtles with leaves need to promote their state to their
    //  children.
    const having = this.generateSQLFilters(resultSet, "having");
    if (!having.empty()) {
      // if we have no children, the having can run at the root level
      if (resultSet.childGroups.length === 1) {
        resultSet
          .root()
          .havings.add(
            `(group_set<>${resultSet.groupSet} OR (group_set=${
              resultSet.groupSet
            } AND ${having.sql()}))`
          );
      } else {
        resultSet.hasHaving = true;
        output.sql.push(
          `CASE WHEN group_set=${
            resultSet.groupSet
          } THEN CASE WHEN ${having.sql()} THEN 0 ELSE 1 END END as __delete__${
            resultSet.groupSet
          }`
        );
        output.fieldIndex++;
      }
    }
  }

  generateSQLWhereChildren(resultStruct: FieldInstanceResult): AndChain {
    const wheres = new AndChain();
    for (const [, field] of resultStruct.allFields) {
      if (field.type === "query") {
        const fir = field as FieldInstanceResult;
        const turtleWhere = this.generateSQLFilters(fir, "where");
        if (turtleWhere.present()) {
          const groupSets = fir.childGroups.join(",");
          wheres.add(
            `(group_set NOT IN (${groupSets})` +
              ` OR (group_set IN (${groupSets}) AND ${turtleWhere.sql()}))`
          );
        }
        wheres.addChain(this.generateSQLWhereChildren(fir));
      }
    }
    return wheres;
  }

  generateSQLWhereTurtled(): string {
    const wheres = this.generateSQLFilters(this.rootResult, "where");
    wheres.addChain(this.generateSQLWhereChildren(this.rootResult));
    return wheres.sql("where");
  }

  // iterate over the nested queries looking for Havings (and someday limits).
  //  if you find any, generate a new stage(s) to perform these functions.
  generateSQLHavingLimit(
    stageWriter: StageWriter,
    lastStageName: string
  ): string {
    const fields = [];
    const resultsWithHaving = this.rootResult.selectStructs(
      [],
      (result: FieldInstanceResult) => result.hasHaving
    );

    if (resultsWithHaving.length > 0) {
      for (const result of resultsWithHaving) {
        // find all the parent dimension names.
        const dimensions = [];
        let r: FieldInstanceResult | undefined = result;
        while (r) {
          for (const name of r.fieldNames((fi) => isScalarField(fi.f))) {
            dimensions.push(
              this.parent.dialect.sqlMaybeQuoteIdentifier(
                `${name}__${r.groupSet}`
              )
            );
          }
          r = r.parent;
        }
        fields.push(
          `MAX(CASE WHEN group_set IN (${result.childGroups.join(
            ","
          )}) THEN __delete__${
            result.groupSet
          } END) OVER(partition by ${dimensions
            .map((x) => `CAST(${x} AS ${this.parent.dialect.stringTypeName}) `)
            .join(",")}) as __shaving__${result.groupSet}`
        );
      }
    }
    if (resultsWithHaving.length > 0) {
      lastStageName = stageWriter.addStage(
        `SELECT\n  *,\n  ${fields.join(",\n  ")} \nFROM ${lastStageName}`
      );
      const havings = new AndChain();
      for (const result of resultsWithHaving) {
        havings.add(
          `group_set IN (${result.childGroups.join(",")}) AND __shaving__${
            result.groupSet
          }=1`
        );
      }
      lastStageName = stageWriter.addStage(
        `SELECT *\nFROM ${lastStageName}\nWHERE NOT (${havings.sqlOr()})`
      );
    }
    return lastStageName;
  }

  generateSQLStage0(stageWriter: StageWriter): string {
    let s = "SELECT\n";
    let from = this.generateSQLJoins(stageWriter);
    const wheres = this.generateSQLWhereTurtled();

    const f: StageOutputContext = {
      dimensionIndexes: [1],
      fieldIndex: 2,
      sql: ["group_set"],
      lateralJoinSQLExpressions: [],
      groupsAggregated: [],
      outputPipelinedSQL: [],
    };
    this.generateStage0Fields(this.rootResult, f, stageWriter);

    if (this.firstSegment.type === "project") {
      throw new Error("PROJECT cannot be used on queries with turtles");
    }
    const groupBy = "GROUP BY " + f.dimensionIndexes.join(",") + "\n";

    from += this.parent.dialect.sqlGroupSetTable(this.maxGroupSet) + "\n";

    s += indent(f.sql.join(",\n")) + "\n";

    // this should only happen on standard SQL,  BigQuery can't partition by expressions and
    //  aggregates.
    if (f.lateralJoinSQLExpressions.length > 0) {
      from += `LEFT JOIN UNNEST([STRUCT(${f.lateralJoinSQLExpressions.join(
        ",\n"
      )})]) as __lateral_join_bag\n`;
    }
    s += from + wheres + groupBy + this.rootResult.havings.sql("having");

    // generate the stage
    const resultStage = stageWriter.addStage(s);

    // generate stages for havings and limits
    this.resultStage = this.generateSQLHavingLimit(stageWriter, resultStage);

    this.resultStage = this.generatePipelinedStages(
      f.outputPipelinedSQL,
      this.resultStage,
      stageWriter
    );

    return this.resultStage;
  }

  generateDepthNFields(
    depth: number,
    resultSet: FieldInstanceResult,
    output: StageOutputContext,
    stageWriter: StageWriter
  ) {
    const groupsToMap = [];
    for (const [name, fi] of resultSet.allFields) {
      const sqlFieldName = this.parent.dialect.sqlMaybeQuoteIdentifier(
        `${name}__${resultSet.groupSet}`
      );
      if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === "result") {
          if (isScalarField(fi.f)) {
            const exp = this.caseGroup(
              resultSet.groupSet > 0 ? resultSet.childGroups : [],
              sqlFieldName
            );
            output.sql.push(`${exp} as ${sqlFieldName}`);
            output.dimensionIndexes.push(output.fieldIndex++);
          } else if (isAggregateField(fi.f)) {
            const exp = this.parent.dialect.sqlAnyValue(
              resultSet.groupSet,
              sqlFieldName
            );
            output.sql.push(`${exp} as ${sqlFieldName}`);
            output.fieldIndex++;
          }
        }
      } else if (fi instanceof FieldInstanceResult) {
        if (fi.depth > depth) {
          // ignore it, we've already dealt with it.
        } else if (fi.depth === depth) {
          const s = this.generateTurtleSQL(
            fi,
            stageWriter,
            sqlFieldName,
            output.outputPipelinedSQL
          );
          output.groupsAggregated.push({
            fromGroup: fi.groupSet,
            toGroup: resultSet.groupSet,
          });
          groupsToMap.push(fi.groupSet);
          output.sql.push(`${s} as ${sqlFieldName}`);
          output.fieldIndex++;
        } else {
          this.generateDepthNFields(depth, fi, output, stageWriter);
        }
      }
    }
    if (output.groupsAggregated.length > 0) {
      output.sql[0] = `CASE `;
      for (const m of output.groupsAggregated) {
        output.sql[0] += `WHEN group_set=${m.fromGroup} THEN ${m.toGroup} `;
      }
      output.sql[0] += ` ELSE group_set END as group_set`;
    }
  }

  generateSQLDepthN(
    depth: number,
    stageWriter: StageWriter,
    stageName: string
  ): string {
    let s = "SELECT \n";
    const f: StageOutputContext = {
      dimensionIndexes: [1],
      fieldIndex: 2,
      sql: ["group_set"],
      lateralJoinSQLExpressions: [],
      groupsAggregated: [],
      outputPipelinedSQL: [],
    };
    this.generateDepthNFields(depth, this.rootResult, f, stageWriter);
    s += indent(f.sql.join(",\n")) + "\n";
    s += `FROM ${stageName}\n`;
    const where = this.rootResult.eliminateComputeGroupsSQL();
    if (where.length > 0) {
      s += `WHERE ${where}\n`;
    }
    if (f.dimensionIndexes.length > 0) {
      s += `GROUP BY ${f.dimensionIndexes.join(",")}\n`;
    }

    this.resultStage = stageWriter.addStage(s);

    this.resultStage = this.generatePipelinedStages(
      f.outputPipelinedSQL,
      this.resultStage,
      stageWriter
    );

    return this.resultStage;
  }

  genereateSQLCombineTurtles(
    stageWriter: StageWriter,
    stage0Name: string
  ): string {
    let s = "SELECT\n";
    const fieldsSQL = [];
    let fieldIndex = 1;
    const outputPipelinedSQL: OutputPipelinedSQL[] = [];
    const dimensionIndexes = [];
    for (const [name, fi] of this.rootResult.allFields) {
      const sqlName = this.parent.dialect.sqlMaybeQuoteIdentifier(name);
      if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === "result") {
          if (isScalarField(fi.f)) {
            fieldsSQL.push(
              this.parent.dialect.sqlMaybeQuoteIdentifier(
                `${name}__${this.rootResult.groupSet}`
              ) + ` as ${sqlName}`
            );
            dimensionIndexes.push(fieldIndex++);
          } else if (isAggregateField(fi.f)) {
            fieldsSQL.push(
              this.parent.dialect.sqlAnyValueLastTurtle(
                name,
                this.rootResult.groupSet,
                sqlName
              )
            );
            fieldIndex++;
          }
        }
      } else if (fi instanceof FieldInstanceResult) {
        if (fi.firstSegment.type === "reduce") {
          fieldsSQL.push(
            `${this.generateTurtleSQL(
              fi,
              stageWriter,
              sqlName,
              outputPipelinedSQL
            )} as ${sqlName}`
          );
          fieldIndex++;
        } else if (fi.firstSegment.type === "project") {
          fieldsSQL.push(
            this.parent.dialect.sqlAnyValueLastTurtle(
              name,
              this.rootResult.groupSet,
              sqlName
            )
          );
          fieldIndex++;
        }
      }
    }
    s += indent(fieldsSQL.join(",\n")) + `\nFROM ${stage0Name}\n`;

    const where = this.rootResult.eliminateComputeGroupsSQL();
    if (where.length > 0) {
      s += `WHERE ${where}\n`;
    }

    if (dimensionIndexes.length > 0) {
      s += `GROUP BY ${dimensionIndexes.join(",")}\n`;
    }

    // order by
    s += this.genereateSQLOrderBy(
      this.firstSegment as QuerySegment,
      this.rootResult
    );

    // limit
    if (this.firstSegment.limit) {
      s += `LIMIT ${this.firstSegment.limit}\n`;
    }

    this.resultStage = stageWriter.addStage(s);
    this.resultStage = this.generatePipelinedStages(
      outputPipelinedSQL,
      this.resultStage,
      stageWriter
    );

    return this.resultStage;
  }

  generateTurtleSQL(
    resultStruct: FieldInstanceResult,
    stageWriter: StageWriter,
    sqlFieldName: string,
    outputPipelinedSQL: OutputPipelinedSQL[]
  ): string {
    // let fieldsSQL: string[] = [];
    const dialectFieldList: DialectFieldList = [];
    let orderBy = "";
    const limit: number | undefined = resultStruct.firstSegment.limit;

    // calculate the ordering.
    const obSQL = [];
    let orderingField;
    const orderByDef =
      (resultStruct.firstSegment as QuerySegment).orderBy ||
      resultStruct.calculateDefaultOrderBy();
    for (const ordering of orderByDef) {
      if (typeof ordering.field === "string") {
        orderingField = {
          name: ordering.field,
          fif: resultStruct.getField(ordering.field),
        };
      } else {
        orderingField = resultStruct.getFieldByNumber(ordering.field);
      }
      if (resultStruct.firstSegment.type === "reduce") {
        obSQL.push(
          " " +
            this.parent.dialect.sqlMaybeQuoteIdentifier(
              `${orderingField.name}__${resultStruct.groupSet}`
            ) +
            ` ${ordering.dir || "ASC"}`
        );
      } else if (resultStruct.firstSegment.type === "project") {
        obSQL.push(
          ` ${orderingField.fif.f.generateExpression(resultStruct)} ${
            ordering.dir || "ASC"
          }`
        );
      }
    }

    if (obSQL.length > 0) {
      orderBy = " " + this.parent.dialect.sqlOrderBy(obSQL);
    }

    for (const [name, field] of resultStruct.allFields) {
      const sqlName = this.parent.dialect.sqlMaybeQuoteIdentifier(name);
      //
      if (
        resultStruct.firstSegment.type === "reduce" &&
        (field instanceof FieldInstanceResult ||
          (field instanceof FieldInstanceField &&
            field.fieldUsage.type === "result"))
      ) {
        // fieldsSQL.push(`${name}__${resultStruct.groupSet} as ${sqlName}`);
        // outputFieldNames.push(name);
        dialectFieldList.push({
          type:
            field instanceof FieldInstanceField
              ? field.f.fieldDef.type
              : "struct",
          sqlExpression: this.parent.dialect.sqlMaybeQuoteIdentifier(
            `${name}__${resultStruct.groupSet}`
          ),
          sqlOutputName: sqlName,
        });
      } else if (
        resultStruct.firstSegment.type === "project" &&
        field instanceof FieldInstanceField &&
        field.fieldUsage.type === "result"
      ) {
        // fieldsSQL.push(
        //   `${field.f.generateExpression(resultStruct)} as ${sqlName}`
        // );
        dialectFieldList.push({
          type: field.type,
          sqlExpression: field.f.generateExpression(resultStruct),
          sqlOutputName: sqlName,
        });
      }
    }

    let resultType;
    let ret;
    if ((resultType = resultStruct.getRepeatedResultType()) !== "nested") {
      if (resultType === "inline_all_numbers") {
        ret = this.parent.dialect.sqlCoaleseMeasuresInline(
          resultStruct.groupSet,
          dialectFieldList
        );
      } else {
        ret = this.parent.dialect.sqlAnyValueTurtle(
          resultStruct.groupSet,
          dialectFieldList
        );
      }
    } else {
      ret = this.parent.dialect.sqlAggregateTurtle(
        resultStruct.groupSet,
        dialectFieldList,
        orderBy,
        limit
      );
    }

    // If the turtle is a pipeline, generate a UDF to compute it.
    const newStageWriter = new StageWriter(
      this.parent.dialect.supportsCTEinCoorelatedSubQueries,
      stageWriter
    );
    const { structDef, pipeOut } = this.generateTurtlePipelineSQL(
      resultStruct,
      newStageWriter,
      this.parent.dialect.supportUnnestArrayAgg ? ret : sqlFieldName
    );

    // if there was a pipeline.
    if (pipeOut !== undefined) {
      const sql = newStageWriter.generateCoorelatedSubQuery(
        this.parent.dialect,
        structDef
      );

      if (this.parent.dialect.supportUnnestArrayAgg) {
        ret = `(${sql})`;
      } else {
        outputPipelinedSQL.push({
          sqlFieldName,
          pipelineSQL: `(${sql})`,
        });
      }
    }

    return ret;
    // return `${aggregateFunction}(CASE WHEN group_set=${
    //   resultStruct.groupSet
    // } THEN STRUCT(${fieldsSQL.join(",\n")}) END${tailSQL})`;
  }

  generateTurtlePipelineSQL(
    fi: FieldInstanceResult,
    stageWriter: StageWriter,
    sourceSQLExpression: string
  ) {
    let structDef = this.getResultStructDef(fi, false);
    const repeatedResultType = fi.getRepeatedResultType();
    const hasPipeline = fi.turtleDef.pipeline.length > 1;
    let pipeOut;
    if (hasPipeline) {
      const pipeline: PipeSegment[] = [...fi.turtleDef.pipeline];
      pipeline.shift();
      const newTurtle: TurtleDef = {
        type: "turtle",
        name: "starthere",
        pipeline,
      };
      structDef.name = this.parent.dialect.sqlUnnestPipelineHead(
        repeatedResultType === "inline_all_numbers",
        sourceSQLExpression
      );
      structDef.structSource = { type: "sql", method: "nested" };
      const qs = new QueryStruct(structDef, {
        model: this.parent.getModel(),
      });
      const q = QueryQuery.makeQuery(newTurtle, qs, stageWriter);
      pipeOut = q.generateSQLFromPipeline(stageWriter);
      // console.log(stageWriter.generateSQLStages());
      structDef = pipeOut.outputStruct;
    }
    return {
      structDef,
      pipeOut,
    };
  }

  generateComplexSQL(stageWriter: StageWriter): string {
    let stageName = this.generateSQLStage0(stageWriter);

    if (this.maxDepth > 1) {
      let i = this.maxDepth;
      while (i > 1) {
        stageName = this.generateSQLDepthN(i, stageWriter, stageName);
        i--;
      }
    }

    // nest the turtles.
    return this.genereateSQLCombineTurtles(stageWriter, stageName);
  }

  generateSQL(stageWriter: StageWriter): string {
    const r = this.rootResult.computeGroups(0, 0);
    this.maxDepth = r.maxDepth;
    this.maxGroupSet = r.nextGroupSetNumber - 1;

    this.rootResult.assignFieldsToGroups();

    this.rootResult.isComplexQuery ||= this.maxDepth > 0 || r.isComplex;
    if (this.rootResult.isComplexQuery) {
      return this.generateComplexSQL(stageWriter);
    } else {
      return this.generateSimpleSQL(stageWriter);
    }
  }

  toMalloy(): string {
    let ret = `EXPLORE ${getIdentifier(this.parent.fieldDef)} | `;
    ret += this.fieldDef.type.toUpperCase() + " ";
    return ret;
  }

  generateSQLFromPipeline(stageWriter: StageWriter) {
    this.prepare(stageWriter);
    let lastStageName = this.generateSQL(stageWriter);
    let outputStruct = this.getResultStructDef();
    if (this.fieldDef.pipeline.length > 1) {
      // console.log(pretty(outputStruct));
      const pipeline = [...this.fieldDef.pipeline];
      let structDef: StructDef = {
        ...outputStruct,
        structSource: { type: "sql", method: "lastStage" },
      };
      pipeline.shift();
      for (const transform of pipeline) {
        const s = new QueryStruct(structDef, {
          model: this.parent.getModel(),
        });
        const q = QueryQuery.makeQuery(
          { type: "turtle", name: "ignoreme", pipeline: [transform] },
          s,
          stageWriter
        );
        q.prepare(stageWriter);
        lastStageName = q.generateSQL(stageWriter);
        outputStruct = q.getResultStructDef();
        structDef = {
          ...outputStruct,
          structSource: { type: "sql", method: "lastStage" },
        };
      }
    }
    return { lastStageName, outputStruct };
  }
}

class QueryQueryReduce extends QueryQuery {}

class QueryQueryProject extends QueryQuery {}

// generates a single stage query for the index.
//  wildcards have been expanded
//  nested repeated fields are safe to use.
class QueryQueryIndexStage extends QueryQuery {
  fieldDef: TurtleDef;
  constructor(
    fieldDef: TurtleDef,
    parent: QueryStruct,
    stageWriter: StageWriter | undefined
  ) {
    super(fieldDef, parent, stageWriter);
    this.fieldDef = fieldDef;
  }
  // get a field ref and expand it.
  expandField(f: string) {
    const field = this.parent.getFieldByName(f);
    return { as: f, field };
  }

  expandFields(resultStruct: FieldInstanceResult) {
    let resultIndex = 1;
    const groupIndex = resultStruct.groupSet;
    this.maxGroupSet = groupIndex;

    const fieldNames = (this.firstSegment as IndexSegment).fields || [];
    for (const f of fieldNames) {
      const { as, field } = this.expandField(f);

      resultStruct.addField(as, field as QueryField, {
        resultIndex,
        type: "result",
      });
      if (field instanceof QueryAtomicField) {
        this.addDependancies(resultStruct, field);
      }
      resultIndex++;
    }
    const measure = (this.firstSegment as IndexSegment).weightMeasure;
    if (measure !== undefined) {
      const f = this.parent.getFieldByName(measure) as QueryField;
      resultStruct.addField(measure, f, {
        resultIndex,
        type: "result",
      });
      this.addDependancies(resultStruct, f);
    }
    this.expandFilters(resultStruct);
  }

  generateSQL(stageWriter: StageWriter): string {
    let measureSQL = "COUNT(*)";
    const dialect = this.parent.dialect;
    const fieldNameColumn = dialect.sqlMaybeQuoteIdentifier("fieldName");
    const fieldValueColumn = dialect.sqlMaybeQuoteIdentifier("fieldValue");
    const fieldTypeColumn = dialect.sqlMaybeQuoteIdentifier("fieldType");
    const fieldRangeColumn = dialect.sqlMaybeQuoteIdentifier("fieldRange");
    const measureName = (this.firstSegment as IndexSegment).weightMeasure;
    if (measureName) {
      measureSQL = this.rootResult
        .getField(measureName)
        .f.generateExpression(this.rootResult);
    }

    const fields = [];
    for (const [name, field] of this.rootResult.allFields) {
      const fi = field as FieldInstanceField;
      if (fi.fieldUsage.type === "result" && isScalarField(fi.f)) {
        const expression = fi.f.generateExpression(this.rootResult);
        fields.push({ name, type: fi.f.fieldDef.type, expression });
      }
    }

    let s = `SELECT\n  group_set,\n`;
    s += `  CASE group_set\n`;
    for (let i = 0; i < fields.length; i++) {
      s += `    WHEN ${i} THEN '${fields[i].name}'\n`;
    }
    s += `  END as ${fieldNameColumn},`;
    s += `  CASE group_set\n`;
    for (let i = 0; i < fields.length; i++) {
      s += `    WHEN ${i} THEN '${fields[i].type}'\n`;
    }
    s += `  END as ${fieldTypeColumn},`;
    s += `  CASE group_set\n`;
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].type === "string") {
        s += `    WHEN ${i} THEN ${fields[i].expression}\n`;
      }
    }
    s += `  END as ${fieldValueColumn},\n`;
    s += ` ${measureSQL} as weight,\n`;

    // just in case we don't have any field types, force the case statement to have at least one value.
    s += `  CASE group_set\n    WHEN 99999 THEN ''`;
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].type === "number") {
        s += `    WHEN ${i} THEN CAST(MIN(${fields[i].expression}) AS ${dialect.stringTypeName}) || ' to ' || CAST(MAX(${fields[i].expression}) AS ${dialect.stringTypeName})\n`;
      }
      if (fields[i].type === "timestamp" || fields[i].type === "date") {
        s += `    WHEN ${i} THEN MIN(${dialect.sqlDateToString(
          fields[i].expression
        )}) || ' to ' || MAX(${dialect.sqlDateToString(
          fields[i].expression
        )})\n`;
      }
    }
    s += `  END as ${fieldRangeColumn}\n`;

    // CASE
    //   WHEN field_type = 'timestamp' or field_type = 'date'
    //     THEN MIN(field_value) || ' to ' || MAX(field_value)
    //   WHEN field_type = 'number'
    //     THEN
    // ELSE NULL
    // END as field_range\n`;

    s += this.generateSQLJoins(stageWriter);

    s += dialect.sqlGroupSetTable(fields.length) + "\n";

    s += this.generateSQLFilters(this.rootResult, "where").sql("where");

    s += "GROUP BY 1,2,3,4\n";

    // limit
    if (this.firstSegment.limit) {
      s += `LIMIT ${this.firstSegment.limit}\n`;
    }
    // console.log(s);
    const resultStage = stageWriter.addStage(s);
    this.resultStage = stageWriter.addStage(
      `SELECT
  ${fieldNameColumn},
  ${fieldTypeColumn},
  COALESCE(${fieldValueColumn}, ${fieldRangeColumn}) as ${fieldValueColumn},
  weight
FROM ${resultStage}\n`
    );
    return this.resultStage;
  }
}

class QueryQueryIndex extends QueryQuery {
  fieldDef: TurtleDef;
  rootFields: string[] = [];
  fanPrefixMap: Record<string, string[]> = {};

  constructor(
    fieldDef: TurtleDef,
    parent: QueryStruct,
    stageWriter: StageWriter | undefined
  ) {
    super(fieldDef, parent, stageWriter);
    this.fieldDef = fieldDef;
    this.findFanPrefexes(parent);
  }

  // we want to generate a different query for each
  //  nested structure so we don't do a crazy cross product.
  findFanPrefexes(qs: QueryStruct) {
    for (const [_name, f] of qs.nameMap) {
      if (
        f instanceof QueryStruct &&
        (f.fieldDef.structRelationship.type === "many" ||
          f.fieldDef.structRelationship.type === "nested") &&
        f.fieldDef.fields.length > 1 && // leave arrays in parent.
        this.parent.dialect.dontUnionIndex === false
      ) {
        this.fanPrefixMap[f.getFullOutputName()] = [];
        this.findFanPrefexes(f);
      }
    }
  }

  expandIndexWildCards(): string[] {
    // if no fields were specified, look in the parent struct for strings.
    let fieldNames = (this.firstSegment as IndexSegment).fields || [];
    if (fieldNames.length === 0) {
      fieldNames.push("**");
    }
    fieldNames = this.expandWildCards(
      fieldNames,
      (qf) =>
        ["string", "number", "timestamp", "date"].indexOf(qf.fieldDef.type) !==
        -1
    ) as string[];
    return fieldNames;
  }

  // return the number of stages it is going to take to generate this index.
  getStageFields(): string[][] {
    const s: string[][] = [];
    if (this.rootFields.length > 0) {
      s.push(this.rootFields);
    }
    for (const fieldList of Object.values(this.fanPrefixMap)) {
      if (fieldList.length > 0) {
        s.push(fieldList);
      }
    }
    return s;
  }

  // Map fields into stages based on their level of repeated nesting
  //
  mapFieldsIntoStages(fieldNames: string[]) {
    // find all the fanned prefixes, longest ones first.
    const fannedPrefixes = Object.keys(this.fanPrefixMap).sort((k1, k2) => {
      if (k1.length < k2.length) {
        return 1;
      }
      if (k1.length > k2.length) {
        return -1;
      }
      return 0;
    });

    // Find the deepest fanned prefix
    for (const fn of fieldNames) {
      let found = false;
      for (const prefix of fannedPrefixes) {
        if (fn.startsWith(prefix)) {
          this.fanPrefixMap[prefix].push(fn);
          found = true;
        }
      }
      if (!found) {
        this.rootFields.push(fn);
      }
    }
  }

  expandFields(_resultStruct: FieldInstanceResult) {
    const fieldNames = this.expandIndexWildCards();
    this.mapFieldsIntoStages(fieldNames);
  }

  generateSQL(stageWriter: StageWriter): string {
    const stages = this.getStageFields();
    const outputStageNames: string[] = [];
    for (const fields of stages) {
      const q = new QueryQueryIndexStage(
        {
          ...this.fieldDef,
          pipeline: [
            {
              ...(this.fieldDef.pipeline[0] as IndexSegment),
              fields: fields,
            },
          ],
        },
        this.parent,
        stageWriter
      );
      q.prepare(stageWriter);
      const lastStageName = q.generateSQL(stageWriter);
      outputStageNames.push(lastStageName);
    }
    if (outputStageNames.length === 1) {
      this.resultStage = outputStageNames[0];
    } else {
      this.resultStage = stageWriter.addStage(
        outputStageNames
          .map((n) => `SELECT * FROM ${n}\n`)
          .join(" UNION ALL \n")
      );
    }
    return this.resultStage;
  }

  /**  All Indexes have the same output schema */
  getResultStructDef(): StructDef {
    return {
      type: "struct",
      name: this.resultStage || "result",
      dialect: this.parent.fieldDef.dialect,
      fields: [
        { type: "string", name: "fieldName" },
        { type: "string", name: "fieldValue" },
        { type: "string", name: "fieldType" },
        { type: "number", name: "weight", numberType: "integer" },
      ],
      structRelationship: {
        type: "basetable",
        connectionName: this.parent.connectionName,
      },
      structSource: { type: "query_result" },
    };
  }
}

/** Structure object as it is used to build a query */
class QueryStruct extends QueryNode {
  fieldDef: StructDef;
  parent: QueryStruct | undefined;
  model: QueryModel;
  nameMap = new Map<string, QuerySomething>();
  pathAliasMap: Map<string, string>;
  dialect: Dialect;
  connectionName: string;

  constructor(
    fieldDef: StructDef,
    parent:
      | { struct: QueryStruct }
      | {
          model: QueryModel;
        }
  ) {
    super(fieldDef);
    this.setParent(parent);

    if ("model" in parent) {
      this.model = parent.model;
      this.pathAliasMap = new Map<string, string>();
      if (fieldDef.structRelationship.type === "basetable") {
        this.connectionName = fieldDef.structRelationship.connectionName;
      } else {
        throw new Error("All root StructDefs should be a baseTable");
      }
    } else {
      this.model = this.getModel();
      this.pathAliasMap = this.root().pathAliasMap;
      this.connectionName = this.root().connectionName;
    }

    this.fieldDef = fieldDef; // shouldn't have to do this, but
    // type script is missing a beat here.

    this.dialect = getDialect(this.fieldDef.dialect);

    this.addFieldsFromFieldList(this.fieldDef.fields);
  }

  parameters(): Record<string, Parameter> {
    return this.fieldDef.parameters || {};
  }

  addFieldsFromFieldList(fields: FieldDef[]) {
    for (const field of fields) {
      const as = getIdentifier(field);

      switch (field.type) {
        case "struct": {
          this.addFieldToNameMap(
            as,
            new QueryStruct(field as StructDef, {
              struct: this,
            })
          );
          break;
        }
        // case "reduce" || "project" || "index": {
        case "turtle": {
          // not sure why we need to cast here...
          this.addFieldToNameMap(as, QueryQuery.makeQuery(field, this));
          break;
        }
        default: {
          this.addFieldToNameMap(as, this.makeQueryField(field));
        }
      }
    }
    // if we don't have distinct key yet for this struct, add it.
    if (!this.nameMap.has("__distinct_key")) {
      this.addFieldToNameMap(
        "__distinct_key",
        new QueryFieldDistinctKey(
          { type: "string", name: "__distinct_key" },
          this
        )
      );
    }
  }

  // generate unique string for the alias.
  // return a string that can be used to represent the full
  //  join path to a struct.
  getAliasIdentifier(): string {
    const path = this.getFullOutputName();
    const ret: string | undefined = this.pathAliasMap.get(path);

    // make a unique alias name
    if (ret === undefined) {
      const aliases = Array.from(this.pathAliasMap.values());
      const base = getIdentifier(this.fieldDef);
      let name = `${base}_0`;
      let n = 1;
      while (aliases.includes(name) && n < 1000) {
        n++;
        name = `${base}_${n}`;
      }
      if (n < 1000) {
        this.pathAliasMap.set(path, name);
        return name;
      } else {
        throw new Error("Internal Error: cannot create unique alias name");
      }

      // get the malloy name for this struct (will include a trailing dot)
      // return this.getFullOutputName().replace(/\.$/, "").replace(/\./g, "_o_");
    } else {
      return ret;
    }
  }

  // when structs are referenced in queries, incorporate the
  //  primary key of struct and add the struct as a join to the result.
  getAsQueryField(): QueryFieldStruct {
    if (this.fieldDef.primaryKey === undefined) {
      throw new Error(
        `Joined explores can only be included in queries if a primary key is defined: '${this.getFullOutputName()}' has no primary key`
      );
    }

    const pkField = this.getPrimaryKeyField(this.fieldDef);
    const pkType = pkField.fieldDef.type;
    if (pkType !== "string" && pkType !== "number") {
      throw new Error(`Unknown Primary key data type for ${name}`);
    }
    const aliasName = getIdentifier(this.fieldDef);
    const pkName = this.fieldDef.primaryKey;
    const fieldDef: FieldDef = {
      type: pkType,
      name: `${aliasName}_id`,
      e: [
        {
          type: "field",
          // path: pkField.getFullOutputName(),
          path: pkField.getIdentifier(),
        },
      ],
    };
    return new QueryFieldStruct(fieldDef, this, `${aliasName}.${pkName}`);
  }

  getSQLIdentifier(): string {
    if (this.unnestWithNumbers() && this.parent !== undefined) {
      const x =
        this.parent.getSQLIdentifier() +
        "." +
        getIdentifier(this.fieldDef) +
        `[${this.getIdentifier()}.__row_id]`;
      return x;
    } else {
      return this.getIdentifier();
    }
  }

  // return the name of the field in SQL
  getIdentifier(): string {
    // if it is the root table, use provided alias if we have one.
    if (this.fieldDef.structRelationship.type === "basetable") {
      if (this.fieldDef.as === undefined) {
        return "base";
      } else {
        return super.getIdentifier();
      }
    }
    // if this is an inline object, include the parents alias.
    if (this.fieldDef.structRelationship.type === "inline" && this.parent) {
      return this.parent.getSQLIdentifier() + "." + super.getIdentifier();
    }
    // we are somewhere in the join tree.  Make sure the alias is unique.
    return this.getAliasIdentifier();
  }

  // return the name of the field in Malloy
  getFullOutputName(): string {
    if (this.parent) {
      return (
        this.parent.getFullOutputName() + getIdentifier(this.fieldDef) + "."
      );
    } else {
      return "";
    }
  }

  needsSymetricCalculation(resultSet: FieldInstanceResult): boolean {
    const joinName = this.getJoinableParent().getIdentifier();
    const join = resultSet.root().joins.get(joinName);
    if (join) {
      return !join.leafiest;
    }
    throw new Error(`Join ${joinName} not found in result set`);
  }

  unnestWithNumbers(): boolean {
    return (
      this.dialect.unnestWithNumbers &&
      this.fieldDef.structRelationship.type === "nested"
    );
  }

  getJoinableParent(): QueryStruct {
    // if it is inline it should always have a parent
    if (this.fieldDef.structRelationship.type === "inline") {
      if (this.parent) {
        return this.parent.getJoinableParent();
      } else {
        throw new Error(`Internal Error: inline struct cannot be root`);
      }
    }
    return this;
  }

  addFieldToNameMap(as: string, n: QuerySomething) {
    if (this.nameMap.has(as)) {
      throw new Error(`Redefinition of ${as}`);
    }
    this.nameMap.set(as, n);
  }

  /** the the primary key or throw an error. */
  getPrimaryKeyField(fieldDef: FieldDef) {
    let pk;
    if ((pk = this.primaryKey())) {
      return pk;
    } else {
      throw new Error(`Missing primary key for ${fieldDef}`);
    }
  }

  /**
   * called after all structure has been loaded.  Examine this structure to see
   * if if it is based on a query and if it is, add the output fields (unless
   * they exist) to the structure.
   */
  resolveQueryFields() {
    if (this.fieldDef.structSource.type === "query") {
      const structDef = this.model
        .loadQuery(this.fieldDef.structSource.query, undefined)
        .structs.pop();

      // should never happen.
      if (!structDef) {
        throw new Error("Internal Error, query didn't produce a struct");
      }

      const fieldDef = { ...this.fieldDef };
      for (const f of structDef.fields) {
        let as;
        if (!this.nameMap.has((as = getIdentifier(f)))) {
          fieldDef.fields.push(f);
          this.nameMap.set(as, this.makeQueryField(f));
        }
      }
      this.fieldDef = fieldDef;
      if (!this.fieldDef.primaryKey && structDef.primaryKey) {
        this.fieldDef.primaryKey = structDef.primaryKey;
      }
    }
    for (const [, v] of this.nameMap) {
      if (v instanceof QueryStruct) {
        v.resolveQueryFields();
      }
    }
  }

  getModel(): QueryModel {
    if (this.model) {
      return this.model;
    } else {
      if (this.parent === undefined) {
        throw new Error(
          "Expected this query struct to have a parent, as no model was present."
        );
      }
      return this.parent.getModel();
    }
  }

  setParent(parent: { struct: QueryStruct } | { model: QueryModel }) {
    if ("struct" in parent) {
      this.parent = parent.struct;
    }
    if ("model" in parent) {
      this.model = parent.model;
    } else {
      this.model = this.getModel();
    }
  }

  /** makes a new queryable field object from a fieldDef */
  makeQueryField(field: FieldDef): QueryField {
    switch (field.type) {
      case "string":
        return new QueryFieldString(field, this);
      case "date":
        return new QueryFieldDate(field, this);
      case "timestamp":
        return new QueryFieldTimestamp(field, this);
      case "number":
        return new QueryFieldNumber(field, this);
      case "boolean":
        return new QueryFieldBoolean(field, this);
      // case "reduce":
      // case "project":
      // case "index":
      case "turtle":
        return new QueryTurtle(field, this);
      default:
        throw new Error(`unknown field definition ${JSON.stringify(field)}`);
    }
  }

  /**
   * return a field if it exists, make one if we are passed a field definition.
   */
  getOrMakeField(fieldRef: FieldRef) {
    if (typeof fieldRef === "string") {
      return this.getFieldByName(fieldRef);
    } else {
      return this.makeQueryField(fieldRef);
    }
  }

  /** returns a dimension for the given name  or make one. */
  getOrMakeDimension(fieldRef: FieldRef): QueryAtomicField {
    const dim = this.getOrMakeField(fieldRef);

    if (dim instanceof QueryAtomicField && isScalarField(dim)) {
      return dim;
    } else {
      throw new Error(`${fieldRef} is not of type a scalar'`);
    }
  }

  structSourceSQL(stageWriter: StageWriter): string {
    switch (this.fieldDef.structSource.type) {
      case "table": {
        const tablePath = this.fieldDef.structSource.tablePath;
        return this.dialect.quoteTablePath(tablePath);
      }
      case "sql":
        if (
          this.fieldDef.structSource.method === "nested" ||
          this.fieldDef.structSource.method === "lastStage"
        ) {
          return this.fieldDef.name;
        } else if (this.fieldDef.structSource.method === "subquery") {
          return `(${this.fieldDef.structSource.sqlBlock.select})`;
        }
        throw new Error(
          "Internal Error: Unknown structSource type 'sql' method"
        );
      case "nested":
        // 'name' is always the source field even if has been renamed through
        // 'as'
        return `UNNEST(this.fieldDef.name)`;
      case "inline":
        return "";
      case "query": {
        // cache derived table.
        const name = getIdentifier(this.fieldDef);
        // this is a hack for now.  Need some way to denote this table
        //  should be cached.
        if (name.includes("cache")) {
          const dtStageWriter = new StageWriter(true, stageWriter);
          this.model.loadQuery(this.fieldDef.structSource.query, dtStageWriter);
          return dtStageWriter.addPDT(name, this.dialect);
        } else {
          // returns the stage name.
          return this.model.loadQuery(
            this.fieldDef.structSource.query,
            stageWriter
          ).lastStageName;
        }
      }
      default:
        throw new Error(`unknown structSource ${this.fieldDef}`);
    }
  }

  root(): QueryStruct {
    if (this.parent === undefined) {
      return this;
    } else {
      return this.parent.root();
    }
  }

  primaryKey(): QueryAtomicField | undefined {
    if (this.fieldDef.primaryKey) {
      return this.getDimensionByName(this.fieldDef.primaryKey);
    } else {
      return undefined;
    }
  }

  /** get the componennts of a field path */
  static resolvePath(name: string): string[] {
    return name.split(".");
  }

  getChildByName(name: string): QuerySomething | undefined {
    return this.nameMap.get(name);
  }

  /** convert a name into a field reference */
  getFieldByName(name: string): QuerySomething {
    const path = QueryStruct.resolvePath(name);
    let ret = this as QuerySomething;
    for (const n of path) {
      const r = ret.getChildByName(n);
      if (r === undefined) {
        throw new Error(`Path not found ${name}`);
      }
      ret = r;
    }
    return ret;
  }

  // structs referenced in queries are converted to fields.
  getQueryFieldByName(name: string): QuerySomething {
    let field = this.getFieldByName(name);
    if (field instanceof QueryStruct) {
      field = field.getAsQueryField();
    }
    return field;
  }

  getDimensionOrMeasureByName(name: string): QueryAtomicField {
    const query = this.getFieldByName(name);
    if (query instanceof QueryAtomicField) {
      return query;
    } else {
      throw new Error(`${name} is not of type a scalar'`);
    }
  }

  /** returns a query object for the given name */
  getDimensionByName(name: string): QueryAtomicField {
    const query = this.getFieldByName(name);

    if (query instanceof QueryAtomicField && isScalarField(query)) {
      return query;
    } else {
      throw new Error(`${name} is not of type a scalar'`);
    }
  }

  /** returns a query object for the given name */
  getStructByName(name: string): QueryStruct {
    const struct = this.getFieldByName(name);
    if (struct instanceof QueryStruct) {
      return struct;
    } else {
      throw new Error(`Error: Path to structure not found '${name}'`);
    }
  }

  getDistinctKey(): QueryAtomicField {
    if (this.fieldDef.structRelationship.type !== "inline") {
      return this.getDimensionByName("__distinct_key");
    } else if (this.parent) {
      return this.parent.getDistinctKey();
    } else {
      throw new Error("Internal Error.  inline struct can not be top level");
    }
  }

  // take a TurtleDef that might have names and make it so it doesn't.
  flattenTurtleDef(turtleDef: TurtleDef | TurtleDefPlus): TurtleDef {
    let pipeline = turtleDef.pipeline;
    let pipeHead = turtleDef.pipeHead;
    while (pipeHead) {
      const field = this.getFieldByName(pipeHead.name);
      if (field instanceof QueryQuery) {
        pipeHead = field.fieldDef.pipeHead;
        pipeline = field.fieldDef.pipeline.concat(pipeline);
      } else {
        throw new Error(
          `Only Turtles can be used in a pipeline ${pipeHead.name}`
        );
      }
    }

    const addedFilters = (turtleDef as TurtleDefPlus).filterList || [];
    pipeline = cloneDeep(pipeline);
    pipeline[0].filterList = addedFilters.concat(
      pipeline[0].filterList || [],
      this.fieldDef.filterList || []
    );

    const flatTurtleDef: TurtleDef = {
      type: "turtle",
      name: turtleDef.name,
      pipeline,
      location: turtleDef.location,
    };
    return flatTurtleDef;
  }

  // /** returns a query object for the given name */
  // getQueryByName(name: string, stageWriter: StageWriter): QueryQuery {
  //   const query = this.getFieldByName(name);
  //   // make a new one
  //   if (query instanceof QueryQuery || query instanceof QueryTurtle) {
  //     // return QueryQuery.makeQuery((query as QueryTurtle).fieldDef, query.parent, stageWriter);
  //     throw new Error("something broken here.");
  //   } else {
  //     throw new Error(`${name} is not of type 'reduce', 'project' or 'index'`);
  //   }
  // }

  //   // Check to see if we need to convert a local reference to a global one on the
  //   // model.
  //   getQueryFromQueryRef(
  //     queryRef: QueryRef,
  //     filterList: FilterCondition[] | undefined,
  //     stageWriter: StageWriter
  //   ): QueryQuery {
  //     if (typeof queryRef === "string") {
  //       const query = this.getQueryByName(queryRef, stageWriter);
  //       if (filterList === undefined) {
  //         return query;
  //       }
  //       queryRef = query.fieldDef;
  //     }

  //     // setup the source if it doesn't exist, merge filter lists.
  //     // queryRef = { ...queryRef };
  //     // if (!queryRef.from) {
  //     //   queryRef.from = this.getOutputName();
  //     // }
  //     if (filterList) {
  //       queryRef = cloneDeep(queryRef);
  //       // maybe the order is backward...
  //       queryRef.filterList = filterList.concat(queryRef.filterList || []);
  //     }
  //     return this.model.getQueryFromDef(queryRef, this);
  //   }
}

/** the resulting SQL and the shape of the data at each stage of the pipeline */
interface QueryResults {
  lastStageName: string;
  stageWriter: StageWriter;
  structs: StructDef[];
  malloy: string;
  connectionName: string;
}

// const exploreSearchSQLMap = new Map<string, string>();

/** start here */
export class QueryModel {
  dialect: Dialect = new StandardSQLDialect();
  // dialect: Dialect = new PostgresDialect();
  modelDef: ModelDef | undefined = undefined;
  structs = new Map<string, QueryStruct>();
  constructor(modelDef: ModelDef | undefined) {
    if (modelDef) {
      this.loadModelFromDef(modelDef);
    }
  }

  loadModelFromDef(modelDef: ModelDef): void {
    this.modelDef = modelDef;
    for (const s of Object.values(this.modelDef.contents)) {
      let qs;
      if (s.type === "struct") {
        qs = new QueryStruct(s, { model: this });
        this.structs.set(getIdentifier(s), qs);
        qs.resolveQueryFields();
      } else if (s.type === "query") {
        /* TODO */
      } else {
        throw new Error("Internal Error: Unknown structure type");
      }
    }
  }

  parseQueryPath(name: string): { struct: QueryStruct; queryName: string } {
    const path = name.split(".");
    let struct;
    if ((struct = this.structs.get(path[0]))) {
      if (path.length > 1) {
        path.shift();
      } else {
        throw new Error(`No query specified in Struct '${path[0]}'`);
      }
      return { queryName: path.join("."), struct };
    } else {
      throw new Error(`Cannot find Struct '${path[0]}' Model`);
    }
  }

  getStructByName(name: string): QueryStruct {
    let s;
    if ((s = this.structs.get(name))) {
      return s;
    } else {
      throw new Error(`Struct ${name} not found in model.`);
    }
  }

  getStructFromRef(structRef: StructRef): QueryStruct {
    let structDef;
    if (typeof structRef === "string") {
      return this.getStructByName(structRef);
    } else if (structRef.type === "struct") {
      structDef = structRef;
    } else {
      throw new Error("Broken for now");
    }
    return new QueryStruct(structDef, { model: this });
  }

  loadQuery(
    query: Query,
    stageWriter: StageWriter | undefined,
    emitFinalStage = false
  ): QueryResults {
    const malloy = "";

    if (!stageWriter) {
      stageWriter = new StageWriter(true, undefined);
    }

    const turtleDef: TurtleDefPlus = {
      type: "turtle",
      name: "ignoreme",
      pipeHead: query.pipeHead,
      pipeline: query.pipeline,
      filterList: query.filterList,
    };

    const q = QueryQuery.makeQuery(
      turtleDef,
      this.getStructFromRef(query.structRef),
      stageWriter
    );

    const ret = q.generateSQLFromPipeline(stageWriter);
    if (emitFinalStage && q.parent.dialect.hasFinalStage) {
      // const fieldNames: string[] = [];
      // for (const f of ret.outputStruct.fields) {
      //   fieldNames.push(getIdentifier(f));
      // }
      const fieldNames = getPhysicalFields(ret.outputStruct).map((fieldDef) =>
        q.parent.dialect.sqlMaybeQuoteIdentifier(fieldDef.name)
      );
      ret.lastStageName = stageWriter.addStage(
        q.parent.dialect.sqlFinalStage(ret.lastStageName, fieldNames)
      );
    }
    return {
      lastStageName: ret.lastStageName,
      malloy,
      stageWriter,
      structs: [ret.outputStruct],
      connectionName: q.parent.connectionName,
    };
  }

  compileQuery(query: Query, finalize = true): CompiledQuery {
    let newModel: QueryModel | undefined;
    const m = newModel || this;
    const ret = m.loadQuery(query, undefined, finalize);
    const sourceExplore =
      typeof query.structRef === "string"
        ? query.structRef
        : // LTNOTE: the parser needs to capture the query before the |.  This will work
        //  in most cases but isn't actually complete.
        query.structRef.type === "struct"
        ? query.structRef.as || query.structRef.name
        : "(need to figure this out)";
    // LTNote:  I don't understand why this might be here.  It should have happened in loadQuery...
    if (finalize && this.dialect.hasFinalStage) {
      ret.lastStageName = ret.stageWriter.addStage(
        // note this will be broken on duckDB waiting on a real fix.
        this.dialect.sqlFinalStage(ret.lastStageName, [])
      );
    }
    return {
      lastStageName: ret.lastStageName,
      malloy: ret.malloy,
      sql: ret.stageWriter.generateSQLStages(),
      structs: ret.structs,
      sourceExplore,
      sourceFilters: query.filterList,
      queryName:
        query.pipeHead && query.pipeline.length === 0
          ? query.pipeHead.name
          : undefined,
      connectionName: ret.connectionName,
    };
  }

  exploreSearchSQLMap = new Map();

  async searchIndex(
    connection: Connection,
    explore: string,
    searchValue: string,
    limit = 1000,
    searchField: string | undefined = undefined
  ): Promise<SearchIndexResult[] | undefined> {
    if (!connection.canPersist()) {
      return undefined;
    }
    // make a search index if one isn't modelled.
    const struct = this.getStructByName(explore);
    let indexQuery: Query;

    if (!struct.nameMap.get("search_index")) {
      indexQuery = {
        structRef: explore,
        pipeline: [
          {
            type: "index",
            fields: ["*"],
            sample: struct.dialect.defaultSampling,
          },
        ],
      };
    } else {
      indexQuery = {
        structRef: explore,
        pipeHead: { name: "search_index" },
        pipeline: [],
      };
    }
    const fieldNameColumn = struct.dialect.sqlMaybeQuoteIdentifier("fieldName");
    const fieldValueColumn =
      struct.dialect.sqlMaybeQuoteIdentifier("fieldValue");
    const fieldTypeColumn = struct.dialect.sqlMaybeQuoteIdentifier("fieldType");

    // if we've compiled the SQL before use it otherwise
    let sqlPDT = this.exploreSearchSQLMap.get(explore);
    if (sqlPDT === undefined) {
      sqlPDT = (await this.compileQuery(indexQuery, false)).sql;
      this.exploreSearchSQLMap.set(explore, sqlPDT);
    }

    let query = `SELECT
              ${fieldNameColumn},
              ${fieldValueColumn},
              ${fieldTypeColumn},
              weight,
              CASE WHEN lower(${fieldValueColumn}) LIKE  lower(${generateSQLStringLiteral(
      searchValue + "%"
    )}) THEN 1 ELSE 0 END as match_first
            FROM  ${await connection.manifestTemporaryTable(sqlPDT)}
            WHERE lower(${fieldValueColumn}) LIKE lower(${generateSQLStringLiteral(
      "%" + searchValue + "%"
    )}) ${
      searchField !== undefined
        ? ` AND ${fieldNameColumn} = '` + searchField + "' \n"
        : ""
    }
            ORDER BY CASE WHEN lower(${fieldValueColumn}) LIKE  lower(${generateSQLStringLiteral(
      searchValue + "%"
    )}) THEN 1 ELSE 0 END DESC, weight DESC
            LIMIT ${limit}
          `;
    if (struct.dialect.hasFinalStage) {
      query = `WITH __stage0 AS(\n${query}\n)\n${struct.dialect.sqlFinalStage(
        "__stage0",
        [
          fieldNameColumn,
          fieldValueColumn,
          fieldTypeColumn,
          "weight",
          "match_first",
        ]
      )}`;
    }
    const result = await connection.runSQL(query, {
      rowLimit: 1000,
    });
    return result.rows as unknown as SearchIndexResult[];
  }
}
