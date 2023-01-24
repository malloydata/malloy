/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/*
 ** This file is the general framework for expression nodes and expression
 ** evaluation.
 */

import {
  By,
  AggregateFragment,
  Fragment,
  isAtomicFieldType,
  isConditionParameter,
  UngroupFragment,
  ExpressionType,
  Expr,
  expressionIsAggregate,
  maxExpressionType,
  expressionIsCalculation,
} from "../../model/malloy_types";
import {
  BinaryBoolean,
  DefSpace,
  ExprCompare,
  FieldReference,
  Filter,
  QuerySpace,
  SpaceParam,
  StructSpaceField,
} from "./ast-main";
import { FieldName, FieldSpace } from "./field-space";
import { ExpressionDef } from "./expression-def";
import { MalloyElement } from "./malloy-element";
import {
  Comparison,
  ExprValue,
  FieldValueType,
  FragType,
  FT,
} from "./ast-types";
import { compose, compressExpr, errorFor } from "./ast-utils";
import { nullsafeNot } from "./apply-expr";
import { castTo } from "./time-utils";

export class ExprString extends ExpressionDef {
  elementType = "string literal";
  value: string;
  constructor(src: string) {
    super();
    const bareStr = src.slice(1, -1);
    const val = bareStr.replace(/\\(.)/g, "$1");
    this.value = val;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return {
      ...FT.stringT,
      value: [
        {
          type: "dialect",
          function: "stringLiteral",
          literal: this.value,
        },
      ],
    };
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
      expressionType: "scalar",
      value: [`r'${this.regex}'`],
    };
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

  getExpression(fs: FieldSpace): ExprValue {
    const notThis = this.expr.getExpression(fs);
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
      const expressionType = typeMixin.expressionType || "scalar";
      const value = [{ type: def.found.refType, path: this.refString }];
      return { dataType, expressionType, value };
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
          expressionType: lval.expressionType,
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
      expressionType: "scalar",
    };
  }
}

export class ExprParens extends ExpressionDef {
  elementType = "(expression)";
  constructor(readonly expr: ExpressionDef) {
    super({ expr });
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

export class ExprMulDiv extends BinaryNumeric<"*" | "/" | "%"> {
  elementType = "*/%";
}

export class ExprAlternationTree extends BinaryBoolean<"|" | "&"> {
  elementType = "alternation";
  constructor(left: ExpressionDef, op: "|" | "&", right: ExpressionDef) {
    super(left, op, right);
    this.elementType = `${op}alternation${op}`;
  }

  apply(fs: FieldSpace, applyOp: string, expr: ExpressionDef): ExprValue {
    const choice1 = this.left.apply(fs, applyOp, expr);
    const choice2 = this.right.apply(fs, applyOp, expr);
    return {
      dataType: "boolean",
      expressionType: maxExpressionType(
        choice1.expressionType,
        choice2.expressionType
      ),
      value: compose(
        choice1.value,
        this.op === "&" ? "and" : "or",
        choice2.value
      ),
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
            expressionType: footType.expressionType || "scalar",
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
    if (
      this.typeCheck(this.expr || this, {
        ...exprVal,
        expressionType: "scalar",
      })
    ) {
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
        expressionType: "aggregate",
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
      expressionType: "aggregate",
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

export class ExprUngroup extends ExpressionDef {
  legalChildTypes = FT.anyAtomicT;
  elementType = "ungroup";
  constructor(
    readonly control: "all" | "exclude",
    readonly expr: ExpressionDef,
    readonly fields: FieldName[]
  ) {
    super({ expr, fields });
  }

  returns(_forExpression: ExprValue): FieldValueType {
    return "number";
  }

  getExpression(fs: FieldSpace): ExprValue {
    const exprVal = this.expr.getExpression(fs);
    if (!expressionIsAggregate(exprVal.expressionType)) {
      this.expr.log(`${this.control}() expression must be an aggregate`);
      return errorFor("ungrouped scalar");
    }
    const ungroup: UngroupFragment = { type: this.control, e: exprVal.value };
    if (this.typeCheck(this.expr, { ...exprVal, expressionType: "scalar" })) {
      if (this.fields.length > 0) {
        let qs = fs;
        if (fs instanceof DefSpace) {
          qs = fs.realFS;
        }
        if (!(qs instanceof QuerySpace)) {
          this.log(
            `${this.control}() must be in a query -- weird internal error`
          );
          return errorFor("ungroup query check");
        }
        const output = qs.result;
        const dstFields: string[] = [];
        const isExclude = this.control == "exclude";
        for (const mustBeInOutput of this.fields) {
          output.whenComplete(() => {
            output.checkUngroup(mustBeInOutput, isExclude);
          });
          dstFields.push(mustBeInOutput.refString);
        }
        ungroup.fields = dstFields;
      }
      return {
        dataType: this.returns(exprVal),
        expressionType: "analytic",
        value: [ungroup],
      };
    }
    this.log(`${this.control}() incompatible type`);
    return errorFor("ungrouped type check");
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
    let expressionType: ExpressionType = "scalar";
    const caseExpr: Fragment[] = ["CASE "];
    for (const clause of this.when) {
      const whenExpr = clause.whenThis.getExpression(fs);
      const thenExpr = clause.thenThis.getExpression(fs);
      expressionType = maxExpressionType(
        expressionType,
        maxExpressionType(whenExpr.expressionType, thenExpr.expressionType)
      );
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
      expressionType = maxExpressionType(
        expressionType,
        elseExpr.expressionType
      );
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
      expressionType,
      value: caseExpr,
    };
  }
}

export class ExprFilter extends ExpressionDef {
  elementType = "filtered expression";
  legalChildTypes = FT.anyAtomicT;
  constructor(readonly expr: ExpressionDef, readonly filter: Filter) {
    super({ expr, filter });
  }

  getExpression(fs: FieldSpace): ExprValue {
    const testList = this.filter.getFilterList(fs);
    const resultExpr = this.expr.getExpression(fs);
    for (const cond of testList) {
      if (expressionIsCalculation(cond.expressionType)) {
        this.filter.log(
          "Cannot filter a field with an aggregate or analytical computation"
        );
        return errorFor("no filter on aggregate");
      }
    }
    if (resultExpr.expressionType === "scalar") {
      // TODO could log a warning, but I have a problem with the
      // idea of warnings, so for now ...
      return resultExpr;
    }
    if (
      this.typeCheck(this.expr, { ...resultExpr, expressionType: "scalar" })
    ) {
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
      expressionType: expr.expressionType,
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
      if (!expressionIsAggregate(byExpr.expressionType)) {
        this.log("top by expression must be an aggregate");
      }
      return { by: "expression", e: compressExpr(byExpr.value) };
    }
    return { by: "name", name: this.by };
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
    let anyExpressionType: ExpressionType = "scalar";
    for (const choice of this.choices) {
      const whenExpr = choice.when.apply(fs, "=", expr);
      const thenExpr = choice.pick
        ? choice.pick.getExpression(fs)
        : expr.getExpression(fs);
      anyExpressionType = maxExpressionType(
        anyExpressionType,
        maxExpressionType(whenExpr.expressionType, thenExpr.expressionType)
      );
      if (returnType) {
        if (!FT.typeEq(returnType, thenExpr, true)) {
          const whenType = FT.inspect(thenExpr);
          this.log(
            `pick type '${whenType}', expected '${returnType.dataType}'`
          );
          return errorFor("pick when type");
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
      const errSrc = this.elsePick ? "else" : "pick default";
      this.log(
        `${errSrc} type '${FT.inspect(elseVal)}', expected '${
          returnType.dataType
        }'`
      );
      return errorFor("pick else type");
    }
    return {
      dataType: returnType.dataType,
      expressionType: maxExpressionType(
        anyExpressionType,
        elseVal.expressionType
      ),
      value: compressExpr([...caseValue, " ELSE ", ...elseVal.value, " END"]),
    };
  }

  getExpression(fs: FieldSpace): ExprValue {
    if (this.elsePick === undefined) {
      this.log("pick incomplete, missing 'else'");
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
    let anyExpressionType: ExpressionType = returnType.expressionType;
    for (const aChoice of choiceValues) {
      if (!FT.typeEq(aChoice.when, FT.boolT)) {
        this.log(
          `when expression must be boolean, not '${FT.inspect(aChoice.when)}`
        );
        return errorFor("pick when type");
      }
      if (!FT.typeEq(returnType, aChoice.pick, true)) {
        const whenType = FT.inspect(aChoice.pick);
        this.log(`pick type '${whenType}', expected '${returnType.dataType}'`);
        return errorFor("pick value type");
      }
      anyExpressionType = maxExpressionType(
        anyExpressionType,
        maxExpressionType(
          aChoice.pick.expressionType,
          aChoice.when.expressionType
        )
      );
      caseValue.push(
        " WHEN ",
        ...aChoice.when.value,
        " THEN ",
        ...aChoice.pick.value
      );
    }
    const defVal = this.elsePick.getExpression(fs);
    anyExpressionType = maxExpressionType(
      anyExpressionType,
      defVal.expressionType
    );
    if (!FT.typeEq(returnType, defVal, true)) {
      this.elsePick.log(
        `else type '${FT.inspect(defVal)}', expected '${returnType.dataType}'`
      );
      return errorFor("pick value type mismatch");
    }
    caseValue.push(" ELSE ", ...defVal.value, " END");
    return {
      dataType: returnType.dataType,
      expressionType: anyExpressionType,
      value: compressExpr(caseValue),
    };
  }
}

function nullCompare(
  left: ExprValue,
  op: string,
  right: ExprValue
): Expr | undefined {
  const not = op === "!=" || op === "!~";
  if (left.dataType === "null" || right.dataType === "null") {
    const maybeNot = not ? " NOT" : "";
    if (left.dataType !== "null") {
      return [...left.value, ` IS${maybeNot} NULL`];
    }
    if (right.dataType !== "null") {
      return [...right.value, `IS${maybeNot} NULL`];
    }
    return [not ? "false" : "true"];
  }
  return undefined;
}

export class Apply extends ExprCompare {
  elementType = "apply";
  constructor(readonly left: ExpressionDef, readonly right: ExpressionDef) {
    super(left, Comparison.EqualTo, right);
  }
}
