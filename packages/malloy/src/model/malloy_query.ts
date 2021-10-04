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

import { cloneDeep, upperCase } from "lodash";
import { MalloyTranslator } from "../lang/parse-malloy";
import { Malloy } from "../malloy";
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
  QueryData,
  QueryResult,
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
} from "./malloy_types";

import { generateSQLStringLiteral, indent, AndChain } from "./utils";

interface TurtleDefPlus extends TurtleDef, Filtered {}

let queryNumber = 0;
async function translatorFor(src: string): Promise<MalloyTranslator> {
  const queryURI = `internal://query/${queryNumber}`;
  queryNumber += 1;
  const parse = new MalloyTranslator(queryURI, { URLs: { [queryURI]: src } });
  const needThese = parse.unresolved();
  if (needThese?.tables) {
    const tables = await Malloy.db.getSchemaForMissingTables(needThese.tables);
    parse.update({ tables });
  }
  return parse;
}

// probably a dialect function at some point.
function quoteTableName(name: string): string {
  return `\`${name}\``;
}

class StageWriter {
  withs = new Map<string, string>();
  udfs = new Map<string, string>();

  addStage(name: string, sql: string): string {
    const id = `__${name}${this.withs.size}`;
    this.withs.set(id, sql);
    return id;
  }

  addUDF(stageWriter: StageWriter): string {
    // eslint-disable-next-line prefer-const
    let { sql, lastStageName } = stageWriter.combineStages(undefined);
    sql += `SELECT ARRAY((SELECT AS STRUCT * FROM ${lastStageName}))\n`;

    const id = `__udf${this.udfs.size}`;
    sql = `CREATE TEMPORARY FUNCTION ${id}(__param ANY TYPE) AS ((\n${indent(
      sql
    )}));\n`;
    this.udfs.set(id, sql);
    return id;
  }

  combineStages(stages: string[] | undefined): {
    sql: string;
    lastStageName: string | undefined;
  } {
    let lastStageName;
    if (!stages) {
      stages = Array.from(this.withs.keys());
    }
    let prefix = `WITH `;
    let w = "";
    for (const name of stages) {
      const sql = this.withs.get(name);
      if (sql === undefined) {
        throw new Error(`Expected sql WITH to be present for stage ${name}.`);
      }
      w += `${prefix}${name} AS (\n${indent(sql)})\n`;
      prefix = ", ";
      lastStageName = name;
    }
    return { sql: w, lastStageName };
  }

  /** emit the SQL for all the stages.  */
  generateSQLStages(): string {
    const udfs = Array.from(this.udfs.values()).join(`\n`);
    const stages = Array.from(this.withs.keys());
    const lastStage = stages.pop();
    const sql = this.combineStages(stages).sql;
    if (lastStage) {
      return udfs + sql + this.withs.get(lastStage);
    } else {
      throw new Error("No SQL generated");
    }
  }

  /** emit the SQL for all the stages.  */
  generateSQLStagesAsUDF(): string {
    let prefix = `WITH `;
    let w = "";
    const stages = Array.from(this.withs.keys());
    const lastStage = stages.pop();
    for (const name of stages) {
      const sql = this.withs.get(name);
      if (sql === undefined) {
        throw new Error(`Expected sql WITH to be present for stage ${name}.`);
      }
      w += `${prefix}${name} AS (\n${indent(sql)})\n`;
      prefix = ", ";
    }
    if (lastStage) {
      return w + this.withs.get(lastStage);
    } else {
      throw new Error("No SQL generated");
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

  withWhere(s?: string): GenerateState {
    const newState = new GenerateState();
    newState.whereSQL = s;
    newState.applyValue = this.applyValue;
    return newState;
  }

  withApply(s: string): GenerateState {
    const newState = new GenerateState();
    newState.whereSQL = this.whereSQL;
    newState.applyValue = s;
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
      return `CASE WHEN group_set${exp} THEN ${s} END`;
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
      return this.generateExpressionFromExpr(
        resultSet,
        field.parent,
        field.fieldDef.e,
        state
      );
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
    if (distinctKeySQL) {
      return sqlSumDistinct(dimSQL, distinctKeySQL);
    } else {
      return `SUM(${dimSQL})`;
    }
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
      return `${sqlSumDistinct(
        dimSQL,
        distinctKeySQL
      )}/NULLIF(COUNT(DISTINCT ${countDistinctKeySQL}),0)`;
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
      } else if (isAggregateFragment(expr)) {
        if (expr.function === "sum") {
          s += this.generateSumFragment(resultSet, context, expr, state);
        } else if (expr.function === "avg") {
          s += this.generateAvgFragment(resultSet, context, expr, state);
        } else if (expr.function === "count") {
          s += this.generateCountFragment(resultSet, context, expr, state);
        } else if (["count_distinct", "min", "max"].includes(expr.function)) {
          s += this.generateSymmetricFragment(resultSet, context, expr, state);
        } else {
          throw new Error(
            `Internal Error: Unknown aggregate function ${expr.function}`
          );
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

  generateExpression(resultSet: FieldInstanceResult): string {
    if (hasExpression(this.fieldDef)) {
      return this.generateExpressionFromExpr(
        resultSet,
        this.parent,
        this.fieldDef.e
      );
    }
    return (
      this.parent.getIdentifier() +
      "." +
      Malloy.db.sqlMaybeQuoteIdentifier(this.fieldDef.name)
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
}

// class QueryMeasure extends QueryField {}

class QueryFieldString extends QueryAtomicField {}
class QueryFieldNumber extends QueryAtomicField {}
class QueryFieldBoolean extends QueryAtomicField {}

const timeframeBQMap = {
  hour_of_day: "HOUR",
  day_of_month: "DAY",
  day_of_year: "DAYOFYEAR",
  month_of_year: "MONTH",
};

class QueryFieldDate extends QueryAtomicField {
  generateExpression(resultSet: FieldInstanceResult): string {
    const fd = this.fieldDef as FieldDateDef;
    if (!fd.timeframe) {
      return super.generateExpression(resultSet);
    } else {
      let e = super.generateExpression(resultSet);
      switch (fd.timeframe) {
        case "date":
          break;
        case "year":
        case "month":
        case "week":
          e = `DATE_TRUNC(${e}, ${fd.timeframe})`;
          break;
        case "day_of_month":
        case "day_of_year":
          e = `EXTRACT(${timeframeBQMap[fd.timeframe]} FROM ${e})`;
          break;
        default:
          e = `DATE_TRUNC(${e}, ${fd.timeframe})`;
      }
      return e;
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
  generateExpression(resultSet: FieldInstanceResult): string {
    const fd = this.fieldDef as FieldTimestampDef;
    if (!fd.timeframe) {
      return super.generateExpression(resultSet);
    } else {
      let e = super.generateExpression(resultSet);
      switch (fd.timeframe) {
        case "year":
        case "month":
        case "week":
          e = `DATE_TRUNC(DATE(${e}, 'UTC'), ${fd.timeframe})`;
          break;
        case "day_of_month":
        case "day_of_year":
        case "hour_of_day":
        case "month_of_year":
          e = `EXTRACT(${
            timeframeBQMap[fd.timeframe]
          } FROM ${e} AT TIME ZONE 'UTC')`;
          break;
        case "date":
          e = `DATE(${e},'UTC')`;
          break;
        case "hour":
        case "minute":
        case "second":
          e = `TIMESTAMP_TRUNC(${e}, ${fd.timeframe}, 'UTC')`;
          break;
      }
      return e;
    }
  }

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
    } else {
      return this.parent.getIdentifier() + "." + "__distinct_key";
    }
  }

  includeInWildcard(): boolean {
    return false;
  }
}

const NUMERIC_DECIMAL_PRECISION = 9;

function sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
  sqlDistinctKey = `CAST(${sqlDistinctKey} AS STRING)`;
  const upperPart = `cast(cast(concat('0x', substr(to_hex(md5(${sqlDistinctKey})), 1, 15)) as int64) as numeric) * 4294967296`;
  const lowerPart = `cast(cast(concat('0x', substr(to_hex(md5(${sqlDistinctKey})), 16, 8)) as int64) as numeric)`;
  // See the comment below on `sql_sum_distinct` for why we multiply by this decimal
  const precisionShiftMultiplier = "0.000000001";
  return `(${upperPart} + ${lowerPart}) * ${precisionShiftMultiplier}`;
}

// This is basically the same as the base `sql_sum_distinct`, but with the important difference that BigQuery's NUMERIC
// is essentially a DECIMAL(29, 9). This means, to use all the available precision, we have to treat 10**-9
// as the 'whole' numbers everything is rounded to.
function sqlSumDistinctMD5(sqlExp: string, sqlDistintKey: string) {
  const precision = 9;
  const uniqueInt = sqlSumDistinctHashedKey(sqlDistintKey);
  const multiplier = 10 ** (precision - NUMERIC_DECIMAL_PRECISION);
  const sumSql = `
  (
    SUM(DISTINCT
      (CAST(ROUND(COALESCE(${sqlExp},0)*(${multiplier}*1.0), ${NUMERIC_DECIMAL_PRECISION}) AS NUMERIC) +
      ${uniqueInt}
    ))
    -
     SUM(DISTINCT ${uniqueInt})
  )`;
  // sum_sql.gsub!(/[\s\n]+/, ' ')
  let ret = `(${sumSql}/(${multiplier}*1.0))`;
  ret = `CAST(${ret} as FLOAT64)`;
  // ret = sql_round(ret, precision)
  return ret;
}

function sqlSumDistinct(sqlExp: string, sqlDistinctKey: string) {
  return sqlSumDistinctMD5(sqlExp, sqlDistinctKey);
}

type FieldUsage =
  | {
      type: "result";
      resultIndex: number;
    }
  | { type: "where" }
  | { type: "dependant" };

interface FieldInstance {
  type: string;
  groupSet: number;
  root(): FieldInstanceResultRoot;
}

class FieldInstanceField implements FieldInstance {
  type = "field";
  f: QueryField;
  // the output index of this field (1 based)
  fieldUsage: FieldUsage;
  groupSet = 0;
  parent: FieldInstanceResult;
  constructor(
    f: QueryField,
    fieldUsage: FieldUsage,
    parent: FieldInstanceResult
  ) {
    this.f = f;
    this.fieldUsage = fieldUsage;
    this.parent = parent;
    if (parent) {
      this.groupSet = parent.groupSet;
    }
  }

  root(): FieldInstanceResultRoot {
    return this.parent.root();
  }
}

type RepeatedResultType = "nested" | "inline_all_numbers" | "inline";

class FieldInstanceResult implements FieldInstance {
  type = "struct";
  allFields = new Map<string, FieldInstance>();
  groupSet = 0;
  depth = 0;
  parent: FieldInstanceResult | undefined;
  childGroups: number[] = [];
  turtleDef: TurtleDef;
  firstSegment: PipeSegment;
  hasHaving = false;
  // query: QueryQuery;

  constructor(turtleDef: TurtleDef, parent: FieldInstanceResult | undefined) {
    this.parent = parent;
    this.turtleDef = turtleDef;
    this.firstSegment = turtleDef.pipeline[0];
  }

  addField(as: string, field: QueryField, usage: FieldUsage) {
    let fi;
    if ((fi = this.allFields.get(as))) {
      if (fi.type === "struct") {
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
    this.groupSet = nextGroupSetNumber++;
    this.depth = depth;
    let maxDepth = depth;
    let isComplex = false;
    let children: number[] = [this.groupSet];
    for (const [_name, fi] of this.allFields) {
      if (fi.type === "struct") {
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
      } else {
        fi.groupSet = this.groupSet;
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

  addStructToJoin(qs: QueryStruct, mayNeedUniqueKey: boolean): JoinInstance {
    let parent: JoinInstance | undefined;
    if (qs.parent && qs.parent.getJoinableParent()) {
      parent = this.addStructToJoin(qs.parent.getJoinableParent(), false);
    }
    const name = qs.getIdentifier();
    let join;
    if (!(join = this.root().joins.get(name))) {
      join = new JoinInstance(qs, name, parent);
      this.root().joins.set(name, join);
    }
    join.mayNeedUniqueKey ||= mayNeedUniqueKey;
    return join;
  }

  findJoins() {
    for (const dim of this.fields()) {
      this.addStructToJoin(dim.f.getJoinableParent(), dim.f.mayNeedUniqueKey());
    }
    for (const s of this.structs()) {
      s.findJoins();
    }
  }

  root(): FieldInstanceResultRoot {
    if (this.parent) {
      return this.parent.root();
    }
    throw new Error(`Internal Error, Null parent FieldInstanceResult`);
  }
}

/* Root Result as opposed to a turtled result */
class FieldInstanceResultRoot extends FieldInstanceResult {
  joins = new Map<string, JoinInstance>();
  havings = new AndChain();
  constructor(turtleDef: TurtleDef) {
    super(turtleDef, undefined);
  }

  root(): FieldInstanceResultRoot {
    return this;
  }

  // look at all the fields again in the structs in the query

  calculateSymmetricAggregates() {
    let leafiest;
    for (const [name, join] of this.joins) {
      // first join is by default the
      if (leafiest === undefined) {
        leafiest = name;
      } else if (
        join.parentRelationship() === "one_to_many" ||
        join.parentRelationship() === "many_to_many"
      ) {
        // check up the parent relationship until you find
        //  the current leafiest node.  If it isn't in the direct path
        //  we need symmetric aggregate for everything.
        //  if it is in the path, than this one becomes leafiest
        const s = join.queryStruct;
        if (s.parent && s.parent.getIdentifier() === leafiest) {
          leafiest = name;
        } else {
          // we have more than on one_to_many join chain, all bets are off.
          leafiest = "we'll never find this so everything will be symmetric";
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
    } else if (
      this.queryStruct.fieldDef.structRelationship.type === "foreignKey"
    ) {
      return "many_to_one";
    } else if (this.queryStruct.fieldDef.structRelationship.type === "nested") {
      return "one_to_many";
    } else if (this.queryStruct.fieldDef.structRelationship.type === "inline") {
      return "one_to_one";
    } else if (
      this.queryStruct.fieldDef.structRelationship.type === "condition"
    ) {
      return this.queryStruct.fieldDef.structRelationship.joinRelationship;
    }
    throw new Error(
      `Internal error unknown relationship type to parent for ${this.queryStruct.fieldDef.name}`
    );
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
  static nextStructDef(
    segmentInput: StructDef,
    segment: PipeSegment
  ): StructDef {
    const qs = new QueryStruct(segmentInput, {
      model: new QueryModel(undefined),
    });
    const turtleDef: TurtleDef = {
      type: "turtle",
      name: "ignoreme",
      pipeline: [segment],
    };
    const queryQueryQuery = QueryQuery.makeQuery(turtleDef, qs);
    return queryQueryQuery.getResultStructDef();
  }
}

type StageGroupMaping = { fromGroup: number; toGroup: number };

type StageOutputContext = {
  sql: string[]; // sql expressions
  dimensionIndexes: number[]; // which indexes are dimensions
  fieldIndex: number;
  groupsAggregated: StageGroupMaping[]; // which groups were aggregated
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
    parent: QueryStruct,
    stageWriter: StageWriter | undefined = undefined
  ): QueryQuery {
    const flatTurtleDef = parent.flattenTurtleDef(fieldDef);

    const firstStage = flatTurtleDef.pipeline[0];
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
      field = this.parent.getFieldByName(f);
    } else if ("type" in f) {
      field = this.parent.makeQueryField(f);
    }
    // or FilteredAliasedName or a hacked timestamp field.
    else if ("name" in f && "as" in f) {
      as = f.as;
      field = this.parent.getFieldByName(f.name);
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
    mayNeedUniqueKey: boolean
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
      .addStructToJoin(struct.getJoinableParent(), mayNeedUniqueKey);
  }

  addDependantExpr(
    resultStruct: FieldInstanceResult,
    context: QueryStruct,
    e: Expr
  ): void {
    for (const expr of e) {
      if (isFieldFragment(expr)) {
        const field = context.getDimensionOrMeasureByName(expr.path);
        if (hasExpression(field.fieldDef)) {
          this.addDependantExpr(resultStruct, field.parent, field.fieldDef.e);
        } else {
          resultStruct
            .root()
            .addStructToJoin(field.parent.getJoinableParent(), false);
          // this.addDependantPath(resultStruct, field.parent, expr.path, false);
        }
      } else if (isFilterFragment(expr)) {
        for (const filterCond of expr.filterList) {
          this.addDependantExpr(resultStruct, context, filterCond.expression);
        }
      } else if (isAsymmetricFragment(expr)) {
        if (expr.structPath) {
          this.addDependantPath(resultStruct, context, expr.structPath, true);
        } else {
          // we are doing a sum in the root.  It may need symetric aggregates
          resultStruct.addStructToJoin(context, true);
        }
        this.addDependantExpr(resultStruct, context, expr.e);
      }
    }
  }

  addDependancies(resultStruct: FieldInstanceResult, field: QueryField): void {
    if (hasExpression(field.fieldDef)) {
      this.addDependantExpr(resultStruct, field.parent, field.fieldDef.e);
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
        // LTNOTE: There is no common parent for FieldScalarDef and FieldAggregateDef
        this.addDependancies(resultStruct, field);

        if (isAggregateField(field)) {
          if (this.firstSegment.type === "project") {
            throw new Error(
              `Aggregate Fields cannot be used in PROJECT - '${field.fieldDef.name}'`
            );
          }
        }
      } else if (
        this.firstSegment.type === "project" &&
        field instanceof QueryStruct
      ) {
        // TODO lloyd refactor or comment why we do nothing here
      } else {
        throw new Error(`'${as}' cannot be used as in this way.`);
      }
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
      this.addDependantExpr(resultStruct, context, cond.expression);
    }
    for (const join of resultStruct.root().joins.values() || []) {
      for (const qf of join.joinFilterConditions || []) {
        if (qf.fieldDef.type === "boolean" && qf.fieldDef.e) {
          this.addDependantExpr(resultStruct, qf.parent, qf.fieldDef.e);
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
      this.rootResult.findJoins();
      this.rootResult.calculateSymmetricAggregates();
      this.prepared = true;
    }
  }

  // get the source fieldname and filters associated with the field (so we can drill later)
  getResultMetadata(fi: FieldInstance): ResultMetadataDef | undefined {
    if (fi instanceof FieldInstanceField) {
      if (fi.fieldUsage.type === "result") {
        const fieldDef = fi.f.fieldDef as FieldAtomicDef;
        let filterList;
        const sourceField =
          fi.f.parent.getFullOutputName() + (fieldDef.name || fieldDef.as);
        const sourceExpression: string | undefined = fieldDef.source;
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
      if (sourceField) {
        return { sourceField, filterList, sourceClasses, fieldKind: "struct" };
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
          new StageWriter()
        );

        // LTNOTE: This is probably broken now.  Need to look at the last stage
        //  to figure out the resulting nested/inline state...

        const resultType =
          fi.getRepeatedResultType() === "nested" ? "nested" : "inline";
        structDef.name = name;
        structDef.structRelationship = { field: name, type: resultType };
        structDef.structSource = { type: resultType };
        structDef.resultMetadata = resultMetadata;
        fields.push(structDef);
      } else if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === "result") {
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

          // build out the result fields...
          switch (fi.f.fieldDef.type) {
            case "boolean":
            case "string":
              fields.push({ name, type: fi.f.fieldDef.type, resultMetadata });
              break;
            case "timestamp": {
              const timeframe = fi.f.fieldDef.timeframe || "second";
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
                  });
                  break;
                case "second":
                case "minute":
                case "date":
                case "hour":
                  fields.push({
                    name,
                    type: "timestamp",
                    timeframe,
                    resultMetadata,
                  });
                  break;
                case "hour_of_day":
                case "day_of_month":
                case "day_of_year":
                case "month_of_year":
                  fields.push({
                    name,
                    type: "number",
                    numberType: "integer",
                    timeframe,
                    resultMetadata,
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
              });
              break;
            }
            case "number":
              fields.push({
                name,
                numberType: fi.f.fieldDef.numberType,
                type: "number",
                resultMetadata,
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
      primaryKey,
      structRelationship: { type: "basetable" },
      // structSource: {type: 'query', query: this.fieldDef}
      structSource: { type: "table" },
      resultMetadata: this.getResultMetadata(this.rootResult),
      type: "struct",
    };
  }

  generateSQLJoinBlock(stageWriter: StageWriter, ji: JoinInstance): string {
    let s = "";
    const qs = ji.queryStruct;
    const structRelationship = qs.fieldDef.structRelationship;
    const structSQL = qs.structSourceSQL(stageWriter);
    if (
      structRelationship.type === "foreignKey" ||
      structRelationship.type === "condition"
    ) {
      let onCondition = "";
      if (qs.parent === undefined) {
        throw new Error("Expected joined struct to have a parent.");
      }
      if (structRelationship.type === "foreignKey") {
        const fkDim = qs.parent.getOrMakeDimension(
          structRelationship.foreignKey
        );
        const pkDim = qs.primaryKey();
        if (!pkDim) {
          throw new Error(
            `Primary Key is not defined in Foreign Key relationship '${structRelationship.foreignKey}'`
          );
        }
        const fkSql = fkDim.generateExpression(this.rootResult);
        const pkSql = pkDim.generateExpression(this.rootResult);
        onCondition = `${fkSql} = ${pkSql}`;
      } else {
        // type == "conditionOn"
        onCondition = new QueryFieldBoolean(
          {
            type: "boolean",
            name: "ignoreme",
            e: structRelationship.onExpression.e,
          },
          qs.parent
        ).generateExpression(this.rootResult);
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
          filters = ` AND ${conditions.join(" AND ")}`;
        }
        s += `${upperCase(
          structRelationship.joinType || "left"
        )} JOIN ${structSQL} AS ${ji.alias} ON ${onCondition}${filters}\n`;
      } else {
        let select = `SELECT ${ji.alias}.*`;
        let joins = "";
        for (const childJoin of ji.children) {
          joins += this.generateSQLJoinBlock(stageWriter, childJoin);
          select += `, (SELECT AS STRUCT ${childJoin.alias}.*) AS ${childJoin.alias}`;
        }
        select += `\nFROM ${structSQL} AS ${
          ji.alias
        }\n${joins}\nWHERE ${conditions?.join(" AND ")}\n`;
        s += `LEFT JOIN (\n${indent(select)}) AS ${
          ji.alias
        } ON ${onCondition}\n`;
        return s;
      }
    } else if (structRelationship.type === "nested") {
      let prefix = "";
      if (qs.parent) {
        prefix = qs.parent.getIdentifier() + ".";
      }
      let sqlTableRef = `UNNEST(${prefix}${structRelationship.field})`;
      // we need to generate primary key.  If parent has a primary key combine
      const qsParent = qs.parent?.getJoinableParent();

      if (ji.makeUniqueKey && qsParent) {
        const pkDim = qsParent.primaryKey();
        let _parentPkSQL = qsParent.getIdentifier() + ".__distinct_key";
        if (pkDim) {
          _parentPkSQL = pkDim.generateExpression(this.rootResult);
        }
        // sqlTableRef = `UNNEST(ARRAY((SELECT AS STRUCT TO_HEX(MD5(CAST(${parentPkSQL} AS STRING) || 'x'|| CAST(row_number() OVER() AS STRING))) as __distinct_key, * FROM ${sqlTableRef})))`;
        sqlTableRef = `UNNEST(ARRAY(( SELECT AS STRUCT GENERATE_UUID() as __distinct_key, * FROM ${sqlTableRef})))`;
      }
      s += `LEFT JOIN ${sqlTableRef} as ${ji.alias}\n`;
      // s += `LEFT JOIN UNNEST(${structRelationship.field}) as ${ji.alias}\n`;
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
    const structRelationship = qs.fieldDef.structRelationship;
    if (structRelationship.type === "basetable") {
      if (ji.makeUniqueKey) {
        // structSQL = `(SELECT row_number() OVER() as __distinct_key, * FROM ${structSQL})`;
        structSQL = `(SELECT GENERATE_UUID() as __distinct_key, * FROM ${structSQL})`;
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
      s = `ORDER BY ${o.join(",")}\n`;
    }
    return s;
  }

  generateSimpleSQL(stageWriter: StageWriter): string {
    let s = "";
    s += "SELECT \n";
    const fields = [];

    for (const [name, field] of this.rootResult.allFields) {
      const fi = field as FieldInstanceField;
      const sqlName = Malloy.db.sqlMaybeQuoteIdentifier(name);
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
    this.resultStage = stageWriter.addStage("stage", s);
    return this.resultStage;
  }

  generateStage0Fields(
    resultSet: FieldInstanceResult,
    output: StageOutputContext,
    stageWriter: StageWriter
  ) {
    for (const [name, fi] of resultSet.allFields) {
      if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === "result") {
          if (isScalarField(fi.f)) {
            let exp = fi.f.generateExpression(resultSet);
            exp = this.caseGroup(
              resultSet.groupSet > 0 ? resultSet.childGroups : [],
              exp
            );
            output.sql.push(`${exp} as ${name}__${resultSet.groupSet}`);
            output.dimensionIndexes.push(output.fieldIndex++);
          } else if (isAggregateField(fi.f)) {
            let exp = fi.f.generateExpression(resultSet);
            exp = this.caseGroup([resultSet.groupSet], exp);
            output.sql.push(`${exp} as ${name}__${resultSet.groupSet}`);
            output.fieldIndex++;
          }
        }
      } else if (fi instanceof FieldInstanceResult) {
        if (fi.firstSegment.type === "reduce") {
          this.generateStage0Fields(fi, output, stageWriter);
        } else if (fi.firstSegment.type === "project") {
          const s = this.generateTurtleSQL(fi, stageWriter);
          output.sql.push(`${s} as ${name}__${resultSet.groupSet}`);
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
      if (field.type === "struct") {
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
            dimensions.push(`${name}__${r.groupSet}`);
          }
          r = r.parent;
        }
        fields.push(
          `MAX(CASE WHEN group_set IN (${result.childGroups.join(
            ","
          )}) THEN __delete__${
            result.groupSet
          } END) OVER(partition by ${dimensions.join(",")}) as __shaving__${
            result.groupSet
          }`
        );
      }
    }
    if (resultsWithHaving.length > 0) {
      lastStageName = stageWriter.addStage(
        "stage",
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
        "stage",
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
      groupsAggregated: [],
    };
    this.generateStage0Fields(this.rootResult, f, stageWriter);

    if (this.firstSegment.type === "project") {
      throw new Error("PROJECT cannot be used on queries with turtles");
    }
    const groupBy = "GROUP BY " + f.dimensionIndexes.join(",") + "\n";

    //
    // this code used to be:
    //
    //   from += `JOIN UNNEST(GENERATE_ARRAY(0,${this.maxGroupSet},1)) as group_set\n`;
    //
    // BigQuery will allocate more resources if we use a CROSS JOIN so we do that instead.
    //
    from += `CROSS JOIN (SELECT row_number() OVER() -1  group_set FROM UNNEST(GENERATE_ARRAY(0,${this.maxGroupSet},1)))\n`;

    s += indent(f.sql.join(",\n")) + "\n";
    s += from + wheres + groupBy + this.rootResult.havings.sql("having");

    // generate the stage
    const resultStage = stageWriter.addStage("stage", s);

    // generate stages for havings and limits
    this.resultStage = this.generateSQLHavingLimit(stageWriter, resultStage);
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
      const sqlFieldName = `${name}__${resultSet.groupSet}`;
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
            const exp = `ANY_VALUE(${this.caseGroup(
              [resultSet.groupSet],
              sqlFieldName
            )})`;
            output.sql.push(`${exp} as ${sqlFieldName}`);
            output.fieldIndex++;
          }
        }
      } else if (fi instanceof FieldInstanceResult) {
        if (fi.depth > depth) {
          // ignore it, we've already dealt with it.
        } else if (fi.depth === depth) {
          const s = this.generateTurtleSQL(fi, stageWriter);
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
      groupsAggregated: [],
    };
    this.generateDepthNFields(depth, this.rootResult, f, stageWriter);
    s += indent(f.sql.join(",\n")) + "\n";
    s += `FROM ${stageName}\n`;
    if (f.dimensionIndexes.length > 0) {
      s += `GROUP BY ${f.dimensionIndexes.join(",")}\n`;
    }
    this.resultStage = stageWriter.addStage("stage", s);
    return this.resultStage;
  }

  genereateSQLCombineTurtles(
    stageWriter: StageWriter,
    stage0Name: string
  ): string {
    let s = "SELECT\n";
    const fieldsSQL = [];
    let fieldIndex = 1;
    const dimensionIndexes = [];
    for (const [name, fi] of this.rootResult.allFields) {
      const sqlName = Malloy.db.sqlMaybeQuoteIdentifier(name);
      if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === "result") {
          if (isScalarField(fi.f)) {
            fieldsSQL.push(`${name}__0 as ${sqlName}`);
            dimensionIndexes.push(fieldIndex++);
          } else if (isAggregateField(fi.f)) {
            fieldsSQL.push(
              `ANY_VALUE(CASE WHEN group_set=0 THEN ${name}__0 END) as ${sqlName}`
            );
            fieldIndex++;
          }
        }
      } else if (fi instanceof FieldInstanceResult) {
        if (fi.firstSegment.type === "reduce") {
          fieldsSQL.push(
            `${this.generateTurtleSQL(fi, stageWriter)} as ${sqlName}`
          );
          fieldIndex++;
        } else if (fi.firstSegment.type === "project") {
          fieldsSQL.push(
            `ANY_VALUE(CASE WHEN group_set=0 THEN ${name}__0 END) as ${sqlName}`
          );
          fieldIndex++;
        }
      }
    }
    s += indent(fieldsSQL.join(",\n")) + `\nFROM ${stage0Name}\n`;

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

    this.resultStage = stageWriter.addStage("stage", s);
    return this.resultStage;
  }

  generateTurtleSQL(
    resultStruct: FieldInstanceResult,
    stageWriter: StageWriter
  ): string {
    const fieldsSQL: string[] = [];
    const outputFieldNames: string[] = [];
    let orderBy = "";
    let limit = "";
    if (resultStruct.firstSegment.limit) {
      limit = ` LIMIT ${resultStruct.firstSegment.limit}`;
    }

    // If the turtle is a pipeline, generate a UDF to compute it.
    const newStageWriter = new StageWriter();
    const { hasPipeline } = this.generateTurtlePipelineSQL(
      resultStruct,
      newStageWriter
    );
    let udfName;
    if (hasPipeline) {
      udfName = stageWriter.addUDF(newStageWriter);
    }

    // calculate the ordering.
    const obSql = [];
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
        obSql.push(
          ` ${orderingField.name}__${resultStruct.groupSet} ${
            ordering.dir || "ASC"
          }`
        );
      } else if (resultStruct.firstSegment.type === "project") {
        obSql.push(
          ` ${orderingField.fif.f.generateExpression(resultStruct)} ${
            ordering.dir || "ASC"
          }`
        );
      }
    }

    if (obSql.length > 0) {
      orderBy = ` ORDER BY ${obSql.join(",")}`;
    }

    for (const [name, field] of resultStruct.allFields) {
      const sqlName = Malloy.db.sqlMaybeQuoteIdentifier(name);
      //
      if (
        resultStruct.firstSegment.type === "reduce" &&
        (field instanceof FieldInstanceResult ||
          (field instanceof FieldInstanceField &&
            field.fieldUsage.type === "result"))
      ) {
        fieldsSQL.push(`${name}__${resultStruct.groupSet} as ${sqlName}`);
        outputFieldNames.push(name);
      } else if (
        resultStruct.firstSegment.type === "project" &&
        field instanceof FieldInstanceField &&
        field.fieldUsage.type === "result"
      ) {
        fieldsSQL.push(
          `${field.f.generateExpression(resultStruct)} as ${sqlName}`
        );
      }
    }

    let aggregateFunction = "ARRAY_AGG";
    let tailSQL = ` IGNORE NULLS${orderBy}${limit}`;
    if (udfName) {
      aggregateFunction = `${udfName}(${aggregateFunction}`;
      tailSQL += ")";
    }
    let resultType;
    if ((resultType = resultStruct.getRepeatedResultType()) !== "nested") {
      if (resultType === "inline_all_numbers") {
        aggregateFunction = "COALESCE(ANY_VALUE";
        const nullFields = outputFieldNames
          .map((s) => `NULL as ${s}`)
          .join(",");
        tailSQL = `), STRUCT(${nullFields})`;
      } else {
        // inline
        aggregateFunction = "ANY_VALUE";
        tailSQL = "";
      }
    }
    return `${aggregateFunction}(CASE WHEN group_set=${
      resultStruct.groupSet
    } THEN STRUCT(${fieldsSQL.join(",\n")}) END${tailSQL})`;
  }

  generateTurtlePipelineSQL(fi: FieldInstanceResult, stageWriter: StageWriter) {
    let structDef = this.getResultStructDef(fi, false);
    const hasPipeline = fi.turtleDef.pipeline.length > 1;
    if (hasPipeline) {
      const pipeline: PipeSegment[] = [...fi.turtleDef.pipeline];
      pipeline.shift();
      const newTurtle: TurtleDef = {
        type: "turtle",
        name: "starthere",
        pipeline,
      };
      structDef.name = "UNNEST(__param)";
      structDef.structSource.type = "sql";
      const qs = new QueryStruct(structDef, {
        model: this.parent.getModel(),
      });
      const q = QueryQuery.makeQuery(newTurtle, qs, stageWriter);
      const { outputStruct } = q.generateSQLFromPipeline(stageWriter);
      // console.log(stageWriter.generateSQLStages());
      structDef = outputStruct;
    }
    return { structDef, hasPipeline };
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
    if (this.maxDepth === 0 && !r.isComplex) {
      return this.generateSimpleSQL(stageWriter);
    } else {
      return this.generateComplexSQL(stageWriter);
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
      pipeline.shift();
      for (const transform of pipeline) {
        const s = new QueryStruct(outputStruct, {
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
      }
    }
    return { lastStageName, outputStruct };
  }
}

class QueryQueryReduce extends QueryQuery {}

class QueryQueryProject extends QueryQuery {}

class QueryQueryIndex extends QueryQuery {
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

    for (const f of fieldNames) {
      const { as, field } = this.expandField(f);

      resultStruct.addField(as, field as QueryField, {
        resultIndex,
        type: "result",
      });
      resultIndex++;
    }
    const measure = (this.firstSegment as IndexSegment).weightMeasure;
    if (measure !== undefined) {
      resultStruct.addField(
        measure,
        this.parent.getFieldByName(measure) as QueryField,
        {
          resultIndex,
          type: "result",
        }
      );
    }
    this.expandFilters(resultStruct);
  }

  generateSQL(stageWriter: StageWriter): string {
    let measureSQL = "COUNT(*)";
    const measureName = (this.firstSegment as IndexSegment).weightMeasure;
    if (measureName) {
      measureSQL = this.rootResult
        .getField(measureName)
        .f.generateExpression(this.rootResult);
    }
    let s = `SELECT
  __fv.field_name,
  __fv.field_type,
  CASE WHEN field_type = 'string' THEN __fv.field_value END field_value,
  ${measureSQL} as weight,
  CASE
    WHEN field_type = 'timestamp' or field_type = 'date'
      THEN MIN(field_value) || ' to ' || MAX(field_value)
    WHEN field_type = 'number'
      THEN CAST(MIN(SAFE_CAST(field_value AS FLOAT64)) AS STRING) || ' to ' || CAST(MAX(SAFE_CAST(field_value AS FLOAT64)) AS STRING)
  ELSE NULL
  END as field_range\n`;
    s += this.generateSQLJoins(stageWriter);

    const fields = [];
    for (const [name, field] of this.rootResult.allFields) {
      const fi = field as FieldInstanceField;
      if (fi.fieldUsage.type === "result" && isScalarField(fi.f)) {
        let expression = fi.f.generateExpression(this.rootResult);
        if (fi.f.fieldDef.type === "timestamp") {
          expression = `CAST(${expression} AS DATE)`;
        }
        if (fi.f.fieldDef.type !== "string") {
          expression = `CAST(${expression} AS STRING)`;
        }
        fields.push(
          `STRUCT('${name}' as field_name, '${fi.f.fieldDef.type}' as field_type, ${expression} as field_value)`
        );
      }
    }
    s += `JOIN UNNEST([${indent(fields.join(",\n"))}]) as __fv\n`;

    s += this.generateSQLFilters(this.rootResult, "where").sql("where");

    s += "GROUP BY 1,2,3\nORDER BY 4 DESC\n";

    // limit
    if (this.firstSegment.limit) {
      s += `LIMIT ${this.firstSegment.limit}\n`;
    }
    // console.log(s);
    const resultStage = stageWriter.addStage("stage", s);
    this.resultStage = stageWriter.addStage(
      "stage",
      `SELECT
  field_name,
  field_type,
  COALESCE(field_value, field_range) as field_value,
  weight
FROM ${resultStage}\n`
    );
    return this.resultStage;
  }

  /**  All Indexes have the same output schema */
  getResultStructDef(): StructDef {
    return {
      type: "struct",
      name: this.resultStage || "result",
      fields: [
        { type: "string", name: "field_name" },
        { type: "string", name: "field_value" },
        { type: "string", name: "field_type" },
        { type: "number", name: "weight", numberType: "integer" },
      ],
      structRelationship: { type: "basetable" },
      structSource: { type: "table" },
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
    } else {
      this.model = this.getModel();
      this.pathAliasMap = this.root().pathAliasMap;
    }

    this.fieldDef = fieldDef; // shouldn't have to do this, but
    // type script is missing a beat here.

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
      let name = base;
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
      return this.parent.getIdentifier() + "." + super.getIdentifier();
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
      case "table":
        // 'name' is always the source table, even if it has been renamed
        // through 'as'
        return quoteTableName(this.fieldDef.name);
      case "sql":
        return this.fieldDef.name;
      case "nested":
        // 'name' is always the source field even if has been renamed through
        // 'as'
        return `UNNEST(this.fieldDef.name)`;
      case "inline":
        return "";
      case "query":
        return this.model.loadQuery(
          this.fieldDef.structSource.query,
          stageWriter
        ).lastStageName;
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

    const addedFilters = (turtleDef as TurtleDefPlus).filterList;
    if (addedFilters) {
      pipeline = cloneDeep(pipeline);
      pipeline[0].filterList = addedFilters.concat(
        pipeline[0].filterList || [],
        this.fieldDef.filterList || []
      );
    }

    const flatTurtleDef: TurtleDef = {
      type: "turtle",
      name: turtleDef.name,
      pipeline,
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
}

const exploreSearchSQLMap = new Map<string, string>();

/** start here */
export class QueryModel {
  modelDef: ModelDef | undefined = undefined;
  structs = new Map<string, QueryStruct>();
  constructor(modelDef: ModelDef | undefined) {
    if (modelDef) {
      this.loadModelFromDef(modelDef);
    }
  }

  loadModelFromDef(modelDef: ModelDef): void {
    this.modelDef = modelDef;
    for (const s of Object.values(this.modelDef.structs)) {
      let qs;
      if (s.type === "struct") {
        qs = new QueryStruct(s, { model: this });
      } else {
        throw new Error("Internal Error: Unknown structure type");
      }
      this.structs.set(getIdentifier(s), qs);
      qs.resolveQueryFields();
    }
  }

  async parseModel(srcText: string): Promise<void> {
    const myDocumentParse = await translatorFor(srcText);
    const getDoc = myDocumentParse.translate();
    if (getDoc.translated) {
      const newModel = getDoc.translated.modelDef;
      this.loadModelFromDef({
        ...newModel,
        name: "parseModel Document",
      });
      return;
    }
    throw new Error(`parseDocument failed\n${myDocumentParse.prettyErrors()}`);
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

  getStructByName(name: string, makeNew = false): QueryStruct {
    let s;
    if ((s = this.structs.get(name))) {
      if (makeNew) {
        return new QueryStruct(s.fieldDef, { model: this });
      } else {
        return s;
      }
    } else {
      throw new Error(`Struct ${name} not found in model.`);
    }
  }

  getStructFromRef(structRef: StructRef, makeNew = false): QueryStruct {
    if (typeof structRef === "string") {
      return this.getStructByName(structRef, makeNew);
    } else if (structRef.type === "struct") {
      return new QueryStruct(structRef, { model: this });
    } else {
      throw new Error("Broken for now");
      // return new QueryStruct(
      //   this.getQueryFromDef(structRef, undefined).getResultStructDef(),
      //   { model: this }
      // );
    }
  }

  // getQueryByName(name: string, stageWriter: StageWriter): QueryQuery {
  //   const { struct, queryName } = this.parseQueryPath(name);
  //   const query = struct.getQueryByName(queryName, stageWriter);
  //   /** finds a named query in a and runs it */
  //   const d = { ...query.fieldDef, from: getIdentifier(struct.fieldDef) };
  //   // console.log(`\n-- == runQueryByName ==('${name}') `);
  //   return this.getQueryFromDef(d, struct);
  // }

  // getQueryFromDef(
  //   queryDef: AnonymousQueryDef,
  //   struct: QueryStruct
  // ): QueryQuery {
  //   // copy the object and add the required name property.
  //   const d = { ...queryDef, name: "ignoreme" };

  //   return QueryQuery.makeQuery(d, struct);
  // }

  loadQuery(query: Query, stageWriter: StageWriter | undefined): QueryResults {
    // const structs = [];
    // const malloy = ToMalloy.query(query);
    const malloy = "";

    if (!stageWriter) {
      stageWriter = new StageWriter();
    }

    const turtleDef: TurtleDefPlus = {
      type: "turtle",
      name: "ignoreme",
      pipeHead: query.pipeHead,
      pipeline: query.pipeline,
      filterList: query.filterList,
    };

    const struct = this.getStructFromRef(query.structRef);
    const q = QueryQuery.makeQuery(turtleDef, struct, stageWriter);
    const { lastStageName, outputStruct } =
      q.generateSQLFromPipeline(stageWriter);
    return { lastStageName, malloy, stageWriter, structs: [outputStruct] };
  }

  async malloyToQuery(queryString: string): Promise<Query> {
    const parse = await translatorFor(queryString);
    const gotQuery = parse.translate();
    if (gotQuery.translated) {
      return gotQuery.translated.queryList[0];
    }
    if (gotQuery.errors) {
      throw new Error(
        `Can't parse query: '${queryString}'\n${parse.prettyErrors()}`
      );
    }
    throw new Error(`Query '${queryString}' -- not complete`);
  }

  async compileQuery(query: Query | string): Promise<CompiledQuery> {
    let newModel: QueryModel | undefined;
    if (typeof query === "string") {
      const parse = await translatorFor(query);

      let modelsBefore = 0;
      if (this.modelDef) {
        modelsBefore = Object.keys(this.modelDef?.structs).length;
      }

      const getQuery = parse.translate(this.modelDef);
      if (getQuery.translated) {
        const newStructs = getQuery.translated.modelDef.structs;
        if (Object.keys(newStructs).length > modelsBefore) {
          newModel = new QueryModel({
            ...getQuery.translated.modelDef,
            name: query,
          });
        }
        query = getQuery.translated.queryList[0];
      } else {
        throw new Error(
          `Query string '${query}' did not compile\n${parse.prettyErrors()}`
        );
      }
    }
    const m = newModel || this;
    const ret = m.loadQuery(query, undefined);
    const sourceExplore =
      typeof query.structRef === "string"
        ? query.structRef
        : // LTNOTE: the parser needs to capture the query before the |.  This will work
        //  in most cases but isn't actually complete.
        query.structRef.type === "struct"
        ? query.structRef.as || query.structRef.name
        : "(need to figure this out)";
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
    };
  }

  /**
   * Run a Malloy query in the context of this model.
   *
   * @param query The query to run, as a {@link Query} or plaintext string.
   * @param pageSize Top-level row limit.
   * @param rowIndex Offset into results.
   */
  async runQuery(
    query: Query | string,
    pageSize?: number,
    rowIndex?: number
  ): Promise<QueryResult> {
    const ret = await this.compileQuery(query);
    return this.runCompiledQuery(ret, pageSize, rowIndex);
  }

  async runCompiledQuery(
    query: CompiledQuery,
    pageSize?: number,
    rowIndex?: number
  ): Promise<QueryResult> {
    const result = await Malloy.db.runMalloyQuery(
      query.sql,
      pageSize,
      rowIndex
    );

    return { ...query, result: result.rows, totalRows: result.totalRows };
  }

  async searchIndex(explore: string, searchValue: string): Promise<QueryData> {
    // make a search index if one isn't modelled.
    const struct = this.getStructByName(explore);
    let malloy;
    if (!struct.nameMap.get("search_index")) {
      malloy = `EXPLORE ${explore} | INDEX`;
    } else {
      malloy = `EXPLORE ${explore} | search_index`;
    }

    // if we've compiled the SQL before use it otherwise
    let sqlPDT = exploreSearchSQLMap.get(explore);
    if (sqlPDT === undefined) {
      sqlPDT = (await this.compileQuery(malloy)).sql;
      exploreSearchSQLMap.set(explore, sqlPDT);
    }
    const result = await Malloy.db.runQuery(
      `SELECT field_name, field_value, weight \n` +
        `FROM  \`${await Malloy.db.manifestTemporaryTable(sqlPDT)}\` \n` +
        `WHERE lower(field_name || '|' || field_value) LIKE lower(${generateSQLStringLiteral(
          "%" + searchValue + "%"
        )})\n ` +
        `ORDER BY 3 DESC\n` +
        `LIMIT 1000\n`
    );
    return result;
  }
}
