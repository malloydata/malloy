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

/*
 ** This file is the general framework for expression nodes and expression
 ** evaluation.
 */

import {
  By,
  AggregateFragment,
  AtomicFieldType,
  FieldTypeDef,
  Fragment,
  isAtomicFieldType,
  isTimeFieldType,
  isConditionParameter,
  StructDef,
  TimeFieldType,
  mkExpr,
} from "../../model/malloy_types";
import { DefSpace, FieldSpace, LookupResult } from "../field-space";
import {
  Filter,
  MalloyElement,
  compose,
  errorFor,
  ExprValue,
  FieldValueType,
  FragType,
  FT,
  isGranularResult,
  compressExpr,
  ExprCompare,
} from "./index";
import { applyBinary, nullsafeNot } from "./apply-expr";
import { SpaceParam, StructSpaceField } from "../space-field";
import { Dialect } from "../../dialect";
import { FieldReference } from "./ast-main";
import { castTo } from "./time-utils";

/**
 * Root node for any element in an expression. These essentially
 * create a sub-tree in the larger AST. Expression nodes know
 * how to write themselves as SQL (or rather, generate the
 * template for SQL required by the query writer)
 */
export abstract class ExpressionDef extends MalloyElement {
  abstract elementType: string;
  granular(): boolean {
    return false;
  }

  /**
   * Returns the "translation" or template for SQL generation. When asking
   * for a tranlsation you may pass the types you can accept, allowing
   * the translation code a chance to convert to match your expectations
   * @param space Namespace for looking up field references
   */
  abstract getExpression(space: FieldSpace, toTypes?: FragType[]): ExprValue;
  legalChildTypes = FT.anyAtomicT;

  /**
   * Some operators want to give the right hand value a chance to
   * rewrite itself. This requests a translation for a rewrite,
   * or returns undefined if that request should be denied.
   * @param fs FieldSpace
   * @returns Translated expression or undefined
   */
  requestExpression(fs: FieldSpace): ExprValue | undefined {
    return this.getExpression(fs);
  }

  defaultFieldName(): string | undefined {
    return undefined;
  }

  /**
   * Check an expression for type compatibility
   * @param _eNode currently unused, will be used to get error location
   * @param eVal ...list of expressions that must match legalChildTypes
   */
  typeCheck(eNode: ExpressionDef, eVal: ExprValue): boolean {
    if (!FT.in(eVal, this.legalChildTypes)) {
      eNode.log(`'${this.elementType}' Can't use type ${FT.inspect(eVal)}`);
      return false;
    }
    return true;
  }

  /**
   * This is the operation which makes partial comparison and value trees work
   * The default implemention merely constructs LEFT OP RIGHT, but specialized
   * nodes like alternation trees or or partial comparison can control how
   * the appplication gets generated
   * @param fs The symbol table
   * @param op The operator being applied
   * @param expr The "other" (besides 'this') value
   * @returns The translated expression
   */
  apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
    return applyBinary(fs, left, op, this);
  }
}

class DollarReference extends ExpressionDef {
  elementType = "$";
  constructor(readonly refType: FieldValueType) {
    super();
  }
  getExpression(_fs: FieldSpace): ExprValue {
    return {
      dataType: this.refType,
      value: [{ type: "applyVal" }],
      aggregate: false,
    };
  }
}

class ConstantFieldSpace implements FieldSpace {
  readonly type = "fieldSpace";
  structDef(): StructDef {
    return {
      type: "struct",
      name: "empty structdef",
      structSource: { type: "table" },
      structRelationship: {
        type: "basetable",
        connectionName: "noConnection",
      },
      fields: [],
      dialect: "noDialect",
    };
  }
  emptyStructDef(): StructDef {
    return { ...this.structDef(), fields: [] };
  }
  lookup(_name: unknown): LookupResult {
    return {
      error: "Only constants allowed in parameter expressions",
      found: undefined,
    };
  }
  getDialect(): Dialect {
    // well dialects totally make this wrong and broken and stupid and useless
    // but since this is only used for parameters which are also wrong and
    // broken and stupid and useless, this will do for now
    throw new Error("I just put this line of code here to make things compile");
  }
}

export class ConstantSubExpression extends ExpressionDef {
  elementType = "constantExpression";
  private cfs?: ConstantFieldSpace;
  constructor(readonly expr: ExpressionDef) {
    super({ expr });
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.constantValue();
  }

  private get constantFs(): ConstantFieldSpace {
    if (!this.cfs) {
      this.cfs = new ConstantFieldSpace();
    }
    return this.cfs;
  }

  constantValue(): ExprValue {
    return this.expr.getExpression(this.constantFs);
  }

  constantCondition(type: AtomicFieldType): ExprValue {
    const compareAndContrast = new ExprCompare(
      new DollarReference(type),
      "=",
      this.expr
    );
    const application = compareAndContrast.getExpression(this.constantFs);
    return { ...application, value: compressExpr(application.value) };
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    return this.expr.apply(fs, op, expr);
  }

  requestExpression(fs: FieldSpace): ExprValue | undefined {
    return this.expr.requestExpression(fs);
  }
}

export class FieldDeclaration extends MalloyElement {
  elementType = "fieldDeclaration";
  isMeasure?: boolean;

  constructor(
    readonly expr: ExpressionDef,
    readonly defineName: string,
    readonly exprSrc?: string
  ) {
    super({ expr });
  }

  fieldDef(fs: FieldSpace, exprName: string): FieldTypeDef {
    /*
     * In an explore we cannot reference the thing we are defining, you need
     * to use rename. In a query, the output space is a new thing, and expressions
     * can reference the outer value in order to make a value with the new name,
     * and it feels wrong that this is HERE and not somehow in the QueryOperation.
     * For now, this stops the stack overflow, and passes all tests, but I think
     * a refactor of QueryFieldSpace might someday be the place where this should
     * happen.
     */
    return this.queryFieldDef(new DefSpace(fs, this), exprName);
  }

  queryFieldDef(exprFS: FieldSpace, exprName: string): FieldTypeDef {
    const exprValue = this.expr.getExpression(exprFS);
    const compressValue = compressExpr(exprValue.value);
    const retType = exprValue.dataType;
    if (isAtomicFieldType(retType)) {
      const template: FieldTypeDef = {
        name: exprName,
        type: retType,
        location: this.location,
      };
      if (compressValue.length > 0) {
        template.e = compressValue;
      }
      if (exprValue.aggregate) {
        template.aggregate = true;
      }
      if (this.exprSrc) {
        template.code = this.exprSrc;
      }
      // TODO this should work for dates too
      if (isGranularResult(exprValue) && template.type === "timestamp") {
        template.timeframe = exprValue.timeframe;
      }
      return template;
    }
    const circularDef = exprFS instanceof DefSpace && exprFS.foundCircle;
    if (!circularDef) {
      const badType = FT.inspect(exprValue);
      this.log(`Cannot define '${exprName}', unexpected type ${badType}`);
    }
    return {
      name: `error_defining_${exprName}`,
      type: "string",
    };
  }
}

export class TypeMistmatch extends Error {}

export class ExprString extends ExpressionDef {
  elementType = "string literal";
  constructor(readonly value: string) {
    super();
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return { ...FT.stringT, value: [this.value] };
  }
}

export class ExprNumber extends ExpressionDef {
  elementType = "numeric literal";
  constructor(readonly n: string) {
    super();
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.constantExpression();
  }

  constantExpression(): ExprValue {
    return { ...FT.numberT, value: [this.n] };
  }
}

export class ExprRegEx extends ExpressionDef {
  elementType = "regular expression literal";
  constructor(readonly regex: string) {
    super();
  }

  getExpression(): ExprValue {
    return {
      dataType: "regular expression",
      aggregate: false,
      value: [`r'${this.regex}'`],
    };
  }
}

export class ExprTime extends ExpressionDef {
  elementType = "timestampOrDate";
  readonly translationValue: ExprValue;
  constructor(
    timeType: TimeFieldType,
    value: Fragment[] | string,
    aggregate = false
  ) {
    super();
    this.elementType = timeType;
    this.translationValue = {
      dataType: timeType,
      aggregate: aggregate,
      value: typeof value === "string" ? [value] : value,
    };
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.translationValue;
  }

  static fromValue(timeType: TimeFieldType, expr: ExprValue): ExprTime {
    let value = expr.value;
    if (timeType != expr.dataType) {
      const toTs: Fragment = {
        type: "dialect",
        function: "cast",
        safe: false,
        dstType: timeType,
        expr: expr.value,
      };
      if (isTimeFieldType(expr.dataType)) {
        toTs.srcType = expr.dataType;
      }
      value = compressExpr([toTs]);
    }
    return new ExprTime(timeType, value, expr.aggregate);
  }
}

abstract class Unary extends ExpressionDef {
  constructor(readonly expr: ExpressionDef) {
    super({ expr });
  }
}

export class ExprNot extends Unary {
  elementType = "not";
  legalChildTypes = [FT.boolT, FT.nullT];
  constructor(expr: ExpressionDef) {
    super(expr);
  }

  getExpression(space: FieldSpace): ExprValue {
    const notThis = this.expr.getExpression(space);
    if (this.typeCheck(this.expr, notThis)) {
      return {
        ...notThis,
        dataType: "boolean",
        value: nullsafeNot(notThis.value),
      };
    }
    return errorFor("not requires boolean");
  }
}

export class Boolean extends ExpressionDef {
  elementType = "boolean literal";
  constructor(readonly value: "true" | "false") {
    super();
  }

  getExpression(): ExprValue {
    return { ...FT.boolT, value: [this.value] };
  }
}

export abstract class BinaryBoolean<
  opType extends string
> extends ExpressionDef {
  elementType = "abstract boolean binary";
  legalChildTypes = [FT.boolT];
  constructor(
    readonly left: ExpressionDef,
    readonly op: opType,
    readonly right: ExpressionDef
  ) {
    super({ left, right });
  }

  getExpression(space: FieldSpace): ExprValue {
    const left = this.left.getExpression(space);
    const right = this.right.getExpression(space);
    if (this.typeCheck(this.left, left) && this.typeCheck(this.right, right)) {
      return {
        dataType: "boolean",
        aggregate: left.aggregate || right.aggregate,
        value: compose(left.value, this.op, right.value),
      };
    }
    return errorFor("logial required boolean");
  }
}

export class ExprLogicalOp extends BinaryBoolean<"and" | "or"> {
  elementType = "logical operator";
  legalChildTypes = [FT.boolT, { ...FT.boolT, aggregate: true }];
}

export class ExprIdReference extends ExpressionDef {
  elementType = "ExpressionIdReference";
  constructor(readonly fieldReference: FieldReference) {
    super();
    this.has({ fieldPath: fieldReference });
  }

  get refString(): string {
    return this.fieldReference.refString;
  }

  getExpression(fs: FieldSpace): ExprValue {
    const def = this.fieldReference.getField(fs);
    if (def.found) {
      // TODO if type is a query or a struct this should fail nicely
      const typeMixin = def.found.type();
      const dataType = typeMixin.type;
      const aggregate = !!typeMixin.aggregate;
      const value = [{ type: def.found.refType, path: this.refString }];
      return { dataType, aggregate, value };
    }
    this.log(def.error);
    return errorFor(def.error);
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    const entry = this.fieldReference.getField(fs).found;
    if (entry instanceof SpaceParam) {
      const cParam = entry.parameter();
      if (isConditionParameter(cParam)) {
        const lval = expr.getExpression(fs);
        return {
          dataType: "boolean",
          aggregate: lval.aggregate,
          value: [
            {
              type: "apply",
              value: lval.value,
              to: [{ type: "parameter", path: this.refString }],
            },
          ],
        };
      }
    }
    return super.apply(fs, op, expr);
  }
}

export class ExprNULL extends ExpressionDef {
  elementType = "NULL";
  getExpression(): ExprValue {
    return {
      dataType: "null",
      value: ["NULL"],
      aggregate: false,
    };
  }
}

export class ExprParens extends ExpressionDef {
  elementType = "(expression)";
  constructor(readonly expr: ExpressionDef) {
    super({ expr });
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    return this.expr.apply(fs, op, expr);
  }

  requestExpression(fs: FieldSpace): ExprValue | undefined {
    return this.expr.requestExpression(fs);
  }

  getExpression(fs: FieldSpace): ExprValue {
    const subExpr = this.expr.getExpression(fs);
    return { ...subExpr, value: ["(", ...subExpr.value, ")"] };
  }
}

export class ExprMinus extends ExpressionDef {
  elementType = "unary minus";
  constructor(readonly expr: ExpressionDef) {
    super({ expr });
    this.legalChildTypes = [FT.numberT];
  }

  getExpression(fs: FieldSpace): ExprValue {
    const expr = this.expr.getExpression(fs);
    if (this.typeCheck(this.expr, expr)) {
      if (expr.value.length > 1) {
        return { ...expr, value: ["-(", ...expr.value, ")"] };
      }
      return { ...expr, value: ["-", ...expr.value] };
    }
    return errorFor("negate requires number");
  }
}

export abstract class BinaryNumeric<
  opType extends string
> extends ExpressionDef {
  elementType = "numeric binary abstract";
  constructor(
    readonly left: ExpressionDef,
    readonly op: opType,
    readonly right: ExpressionDef
  ) {
    super({ left, right });
    this.legalChildTypes = [FT.numberT];
  }

  getExpression(fs: FieldSpace): ExprValue {
    return this.right.apply(fs, this.op, this.left);
  }
}

export class ExprAddSub extends BinaryNumeric<"+" | "-"> {
  elementType = "+-";
}

export class ExprMulDiv extends BinaryNumeric<"*" | "/"> {
  elementType = "*/";
}

export class ExprAlternationTree extends BinaryBoolean<"|" | "&"> {
  elementType = "alternation";
  constructor(left: ExpressionDef, op: "|" | "&", right: ExpressionDef) {
    super(left, op, right);
    this.elementType = `${op}alternation${op}`;
  }

  apply(fs: FieldSpace, applyOp: string, expr: ExpressionDef): ExprValue {
    /**
     * When applying a tree with !=, we apply it with equal, and then
     * NOT the result
     */
    const notEq = applyOp == "!=";
    const useOp = notEq ? "=" : applyOp;
    const choice1 = this.left.apply(fs, useOp, expr);
    const choice2 = this.right.apply(fs, useOp, expr);
    let value = compose(
      choice1.value,
      this.op === "&" ? "and" : "or",
      choice2.value
    );
    if (notEq) {
      value = mkExpr`(NOT(${value}))`;
    }
    return {
      dataType: "boolean",
      aggregate: choice1.aggregate || choice2.aggregate,
      value,
    };
  }

  requestExpression(_fs: FieldSpace): ExprValue | undefined {
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    this.log(`Alternation tree has no value`);
    return errorFor("no value from alternation tree");
  }
}

abstract class ExprAggregateFunction extends ExpressionDef {
  elementType: string;
  source?: FieldReference;
  expr?: ExpressionDef;
  legalChildTypes = [FT.numberT];
  constructor(readonly func: string, expr?: ExpressionDef) {
    super();
    this.elementType = func;
    if (expr) {
      this.expr = expr;
      this.has({ expr });
    }
  }

  returns(_forExpression: ExprValue): FieldValueType {
    return "number";
  }

  getExpression(fs: FieldSpace): ExprValue {
    let exprVal = this.expr?.getExpression(fs);
    let structPath = this.source?.refString;
    if (this.source) {
      const sourceFoot = this.source.getField(fs).found;
      if (sourceFoot) {
        const footType = sourceFoot.type();
        if (isAtomicFieldType(footType.type)) {
          exprVal = {
            dataType: footType.type,
            aggregate: !!footType.aggregate,
            value: [{ type: "field", path: this.source.refString }],
          };
          structPath = this.source.sourceString;
        } else {
          if (!(sourceFoot instanceof StructSpaceField)) {
            this.log(`Aggregate source cannot be a ${footType.type}`);
            return errorFor(`Aggregate source cannot be a ${footType.type}`);
          }
        }
      } else {
        this.log(`Reference to undefined value ${this.source.refString}`);
        return errorFor(
          `Reference to undefined value ${this.source.refString}`
        );
      }
    }
    if (exprVal === undefined) {
      this.log("Missing expression for aggregate function");
      return errorFor("agggregate without expression");
    }
    if (this.typeCheck(this.expr || this, { ...exprVal, aggregate: false })) {
      const f: AggregateFragment = {
        type: "aggregate",
        function: this.func,
        e: exprVal.value,
      };
      if (structPath) {
        f.structPath = structPath;
      }
      return {
        dataType: this.returns(exprVal),
        aggregate: true,
        value: [f],
      };
    }
    return errorFor("aggregate type check");
  }
}

export class ExprMin extends ExprAggregateFunction {
  legalChildTypes = [FT.numberT, FT.stringT, FT.dateT, FT.timestampT];
  constructor(expr: ExpressionDef) {
    super("min", expr);
  }

  returns(forExpression: ExprValue): FieldValueType {
    return forExpression.dataType;
  }
}

export class ExprMax extends ExprAggregateFunction {
  legalChildTypes = [FT.numberT, FT.stringT, FT.dateT, FT.timestampT];
  constructor(expr: ExpressionDef) {
    super("max", expr);
  }

  returns(forExpression: ExprValue): FieldValueType {
    return forExpression.dataType;
  }
}

export class ExprCountDistinct extends ExprAggregateFunction {
  legalChildTypes = [FT.numberT, FT.stringT, FT.dateT, FT.timestampT];
  constructor(expr: ExpressionDef) {
    super("count_distinct", expr);
  }
}

abstract class ExprAsymmetric extends ExprAggregateFunction {
  constructor(
    readonly func: "sum" | "avg",
    readonly expr: ExpressionDef | undefined,
    readonly source?: FieldReference
  ) {
    super(func, expr);
    this.has({ source });
  }

  defaultFieldName(): undefined | string {
    if (this.source && this.expr === undefined) {
      const tag = this.source.nameString;
      switch (this.func) {
        case "sum":
          return `total_${tag}`;
        case "avg":
          return `avg_${tag}`;
      }
    }
    return undefined;
  }
}

export class ExprCount extends ExprAggregateFunction {
  elementType = "count";
  constructor(readonly source?: FieldReference) {
    super("count");
    this.has({ source });
  }

  defaultFieldName(): string | undefined {
    if (this.source) {
      return "count_" + this.source.nameString;
    }
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    const ret: AggregateFragment = {
      type: "aggregate",
      function: "count",
      e: [],
    };
    if (this.source) {
      ret.structPath = this.source.refString;
    }
    return {
      dataType: "number",
      aggregate: true,
      value: [ret],
    };
  }
}

export class ExprAvg extends ExprAsymmetric {
  constructor(expr: ExpressionDef | undefined, source?: FieldReference) {
    super("avg", expr, source);
    this.has({ source });
  }
}

export class ExprSum extends ExprAsymmetric {
  constructor(expr: ExpressionDef | undefined, source?: FieldReference) {
    super("sum", expr, source);
    this.has({ source });
  }
}

export class WhenClause extends ExpressionDef {
  elementType = "when clause";
  constructor(
    readonly whenThis: ExpressionDef,
    readonly thenThis: ExpressionDef
  ) {
    super({ whenThis, thenThis });
  }

  getExpression(_fs: FieldSpace): ExprValue {
    throw new Error("expression did something unxpected with 'WHEN'");
  }
}

export class ExprCase extends ExpressionDef {
  elementType = "case statement";
  constructor(
    readonly when: WhenClause[],
    readonly elseClause?: ExpressionDef
  ) {
    super({ when });
    this.has({ elseClause });
  }

  getExpression(fs: FieldSpace): ExprValue {
    let retType: FragType | undefined;
    let aggregate = false;
    const caseExpr: Fragment[] = ["CASE "];
    for (const clause of this.when) {
      const whenExpr = clause.whenThis.getExpression(fs);
      const thenExpr = clause.thenThis.getExpression(fs);
      aggregate ||= whenExpr.aggregate || thenExpr.aggregate;
      if (thenExpr.dataType !== "null") {
        if (retType && !FT.typeEq(retType, thenExpr)) {
          this.log(
            `Mismatched THEN clause types, ${FT.inspect(retType, thenExpr)}`
          );
          return errorFor("then typecheck");
        } else {
          retType = thenExpr;
        }
      }
      caseExpr.push("WHEN ", ...whenExpr.value, " THEN ", ...thenExpr.value);
    }
    if (this.elseClause) {
      const elseExpr = this.elseClause.getExpression(fs);
      aggregate ||= elseExpr.aggregate;
      caseExpr.push(" ELSE ", ...elseExpr.value);
      if (elseExpr.dataType !== "null") {
        if (retType && !FT.typeEq(retType, elseExpr)) {
          this.log(
            `Mismatched ELSE clause type, ${FT.inspect(retType, elseExpr)}`
          );
          return errorFor("else typecheck");
        } else {
          retType = elseExpr;
        }
      }
    }
    if (retType === undefined) {
      this.log("case statement type not computable");
      return errorFor("typeless case");
    }
    caseExpr.push(" END");
    return {
      dataType: retType.dataType,
      aggregate: aggregate,
      value: caseExpr,
    };
  }
}

export class ExprFilter extends ExpressionDef {
  elementType = "filtered expression";
  legalChildTypes = [FT.stringT, FT.numberT, FT.dateT, FT.timestampT];
  constructor(readonly expr: ExpressionDef, readonly filter: Filter) {
    super({ expr, filter });
  }

  getExpression(fs: FieldSpace): ExprValue {
    const testList = this.filter.getFilterList(fs);
    const resultExpr = this.expr.getExpression(fs);
    for (const cond of testList) {
      if (cond.aggregate) {
        this.filter.log("Cannot filter a field with an aggregate computation");
        return errorFor("no filter on aggregate");
      }
    }
    if (!resultExpr.aggregate) {
      // TODO could log a warning, but I have a problem with the
      // idea of warnings, so for now ...
      return resultExpr;
    }
    if (this.typeCheck(this.expr, { ...resultExpr, aggregate: false })) {
      return {
        ...resultExpr,
        value: [
          {
            type: "filterExpression",
            e: resultExpr.value,
            filterList: testList,
          },
        ],
      };
    }
    this.expr.log(`Cannot filter '${resultExpr.dataType}' data`);
    return errorFor("cannot filter type");
  }
}

type CastType = "string" | "number" | "boolean" | "date" | "timestamp";
export function isCastType(t: string): t is CastType {
  return ["string", "number", "boolean", "date", "timestamp"].includes(t);
}

export class ExprCast extends ExpressionDef {
  elementType = "cast";
  constructor(
    readonly expr: ExpressionDef,
    readonly castType: CastType,
    readonly safe = false
  ) {
    super({ expr });
  }

  getExpression(fs: FieldSpace): ExprValue {
    const expr = this.expr.getExpression(fs);
    return {
      dataType: this.castType,
      aggregate: expr.aggregate,
      value: compressExpr(castTo(this.castType, expr.value, this.safe)),
    };
  }
}

export class TopBy extends MalloyElement {
  elementType = "topBy";
  constructor(readonly by: string | ExpressionDef) {
    super();
    if (by instanceof ExpressionDef) {
      this.has({ by });
    }
  }

  getBy(fs: FieldSpace): By {
    if (this.by instanceof ExpressionDef) {
      const byExpr = this.by.getExpression(fs);
      if (!byExpr.aggregate) {
        this.log("top by expression must be an aggregate");
      }
      return { by: "expression", e: compressExpr(byExpr.value) };
    }
    return { by: "name", name: this.by };
  }
}

export class Range extends ExpressionDef {
  elementType = "range";
  constructor(readonly first: ExpressionDef, readonly last: ExpressionDef) {
    super({ first, last });
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    switch (op) {
      case "=":
      case "!=": {
        const op1 = op === "=" ? ">=" : "<";
        const op2 = op === "=" ? "and" : "or";
        const op3 = op === "=" ? "<" : ">=";
        const fromValue = this.first.apply(fs, op1, expr);
        const toValue = this.last.apply(fs, op3, expr);
        return {
          dataType: "boolean",
          aggregate: fromValue.aggregate || toValue.aggregate,
          value: compose(fromValue.value, op2, toValue.value),
        };
      }

      /**
       * This is a little surprising, but is actually how you comapre a
       * value to a range ...
       *
       * val > begin to end     val >= end
       * val >= begin to end    val >= begin
       * val < begin to end     val < begin
       * val <= begin to end    val < end
       */
      case ">":
        return this.last.apply(fs, ">=", expr);
      case ">=":
        return this.first.apply(fs, ">=", expr);
      case "<":
        return this.first.apply(fs, "<", expr);
      case "<=":
        return this.last.apply(fs, "<", expr);
    }
    throw new Error("mysterious error in range computation");
  }

  requestExpression(_fs: FieldSpace): ExprValue | undefined {
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return errorFor("a range is not a value");
  }
}

export class PickWhen extends MalloyElement {
  elementType = "pickWhen";
  constructor(
    readonly pick: ExpressionDef | undefined,
    readonly when: ExpressionDef
  ) {
    super({ when });
    this.has({ pick });
  }
}

interface Choice {
  pick: ExprValue;
  when: ExprValue;
}

export class Pick extends ExpressionDef {
  elementType = "pick";
  constructor(readonly choices: PickWhen[], readonly elsePick?: ExpressionDef) {
    super({ choices });
    this.has({ elsePick });
  }

  requestExpression(fs: FieldSpace): ExprValue | undefined {
    // pick statements are sometimes partials which must be applied
    // and sometimes have a value.
    if (this.elsePick === undefined) {
      return undefined;
    }
    for (const c of this.choices) {
      if (c.pick == undefined) {
        return undefined;
      }
      const whenResp = c.when.requestExpression(fs);
      if (whenResp == undefined || whenResp.dataType != "boolean") {
        // If when is not a boolean, we'll treat it like a partial compare
        return undefined;
      }
    }
    return this.getExpression(fs);
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    const caseValue: Fragment[] = ["CASE"];
    let returnType: ExprValue | undefined;
    let anyAggregate = false;
    for (const choice of this.choices) {
      const whenExpr = choice.when.apply(fs, "=", expr);
      const thenExpr = choice.pick
        ? choice.pick.getExpression(fs)
        : expr.getExpression(fs);
      anyAggregate ||= whenExpr.aggregate || thenExpr.aggregate;
      if (returnType) {
        if (!FT.typeEq(returnType, thenExpr, true)) {
          this.log(
            `pick value types do not match ${FT.inspect(returnType, thenExpr)}`
          );
          return errorFor("pick value type");
        }
      } else {
        returnType = thenExpr;
      }
      caseValue.push(" WHEN ", ...whenExpr.value, " THEN ", ...thenExpr.value);
    }
    const elsePart = this.elsePick || expr;
    const elseVal = elsePart.getExpression(fs);
    returnType ||= elseVal;
    if (!FT.typeEq(returnType, elseVal, true)) {
      this.log(
        `else value types do not match ${FT.inspect(returnType, elseVal)}`
      );
      return errorFor("pick else type");
    }
    return {
      dataType: returnType.dataType,
      aggregate: anyAggregate || elseVal.aggregate,
      value: compressExpr([...caseValue, " ELSE ", ...elseVal.value, " END"]),
    };
  }

  getExpression(fs: FieldSpace): ExprValue {
    if (this.elsePick === undefined) {
      this.log("'pick' has no value, must specify 'else' or use ':'");
      return errorFor("no value for partial pick");
    }

    const choiceValues: Choice[] = [];
    for (const c of this.choices) {
      if (c.pick === undefined) {
        this.log("pick with no value can only be used with apply");
        return errorFor("no value for partial pick");
      }
      const pickWhen = c.when.requestExpression(fs);
      if (pickWhen === undefined) {
        this.log("pick with partial when can only be used with apply");
        return errorFor("partial when");
      }
      choiceValues.push({
        pick: c.pick.getExpression(fs),
        when: c.when.getExpression(fs),
      });
    }
    const returnType = choiceValues[0].pick;

    const caseValue: Fragment[] = ["CASE"];
    let anyAggregate = returnType.aggregate;
    for (const aChoice of choiceValues) {
      if (!FT.typeEq(aChoice.when, FT.boolT)) {
        this.log(
          `Cannot generate value from pick. WHEN value of type ${FT.inspect(
            aChoice.when
          )}`
        );
        return errorFor("pick when type");
      }
      if (!FT.typeEq(returnType, aChoice.pick, true)) {
        this.log(
          `pick value types do not match ${FT.inspect(
            returnType,
            aChoice.pick
          )}`
        );
        return errorFor("pick value type");
      }
      anyAggregate ||= aChoice.pick.aggregate || aChoice.when.aggregate;
      caseValue.push(
        " WHEN ",
        ...aChoice.when.value,
        " THEN ",
        ...aChoice.pick.value
      );
    }
    const elseValue = this.elsePick.getExpression(fs);
    anyAggregate ||= elseValue.aggregate;
    if (!FT.typeEq(returnType, elseValue, true)) {
      this.elsePick.log(
        `pick value types do not match ${FT.inspect(returnType, elseValue)}`
      );
      return errorFor("pick vlaue type mismatch");
    }
    caseValue.push(" ELSE ", ...elseValue.value, " END");
    return {
      dataType: returnType.dataType,
      aggregate: !!anyAggregate,
      value: compressExpr(caseValue),
    };
  }
}
