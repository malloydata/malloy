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

import {
  ExpressionType,
  Fragment,
  FunctionDef,
  FunctionOverloadDef,
  FunctionParameterDef,
  isExpressionTypeLEQ,
  maxOfExpressionTypes
} from "../../../model/malloy_types";
import { exprMap } from "../../../model/utils";

import { ExprValue } from "../types/expr-value";
import { ExpressionDef } from "../types/expression-def";
import { FieldSpace } from "../types/field-space";
import { compressExpr } from "./utils";

export class ExprFunc extends ExpressionDef {
  elementType = "function call()";
  constructor(readonly name: string, readonly args: ExpressionDef[]) {
    super({ "args": args });
  }

  getExpression(fs: FieldSpace): ExprValue {
    const func = this.modelEntry(this.name)?.entry;
    if (func === undefined) {
      this.log(`Unknown function '${this.name}'. Did you mean to import it?`);
      return {
        "dataType": "unknown",
        "expressionType": "scalar",
        "value": []
      };
    } else if (func.type !== "function") {
      this.log(`Cannot call '${this.name}', which is of type ${func.type}`);
      return {
        "dataType": "unknown",
        "expressionType": "scalar",
        "value": []
      };
    }
    const argExprs = this.args.map((arg) => arg.getExpression(fs));
    const result = find_overload(func, argExprs);
    if (result === undefined) {
      this.log(
        `No matching overload for function ${this.name}(${argExprs
          .map((e) => e.dataType)
          .join(", ")})`
      );
      return {
        "dataType": "unknown",
        "expressionType": "scalar",
        "value": []
      };
    }
    const { overload, paramMap } = result;
    // if (overload.returnType.expressionType === "aggregate") {
    //   const aggIndex = argExprs.findIndex(
    //     (arg) => arg.expressionType === "aggregate"
    //   );
    //   if (aggIndex !== -1) {
    //     this.args[aggIndex].log(
    //       `Cannot use aggregate expression to aggregate function ${}.`
    //     )
    //   }
    // }
    const funcCall: Fragment[] = exprMap(overload.e, (fragment) => {
      if (typeof fragment === "string") {
        return [fragment];
      } else if (fragment.type == "spread") {
        const param = fragment.e[0];
        if (
          fragment.e.length !== 1 ||
          typeof param === "string" ||
          param.type !== "function_parameter"
        ) {
          console.log(JSON.stringify(overload));
          this.log(
            `Invalid function definition. Argument to spread must be a function parameter.`
          );
          return [];
        }
        const entry = paramMap.get(param.name);
        if (entry === undefined) {
          return [fragment];
        } else {
          return joinWith(
            entry.argIndexes.map((argIndex) => argExprs[argIndex].value),
            ","
          );
        }
      } else if (fragment.type == "function_parameter") {
        const entry = paramMap.get(fragment.name);
        if (entry === undefined) {
          return [fragment];
        } else if (entry.param.isVariadic) {
          const spread = joinWith(
            entry.argIndexes.map((argIndex) => argExprs[argIndex].value),
            ","
          );
          return ["[", ...spread, "]"];
        } else {
          return argExprs[entry.argIndexes[0]].value;
        }
      }
      return [fragment];
    });

    const type = overload.returnType;
    const expressionType = maxOfExpressionTypes([
      type.expressionType,
      ...argExprs.map((e) => e.expressionType)
    ]);
    if (type.dataType == "any") {
      this.log(
        `Invalid return type ${type.dataType} for function '${this.name}'`
      );
      return {
        "dataType": "unknown",
        expressionType,
        "value": []
      };
    }
    return {
      "dataType": type.dataType,
      expressionType,
      "value": compressExpr(funcCall)
    };
  }
}

function find_overload(
  func: FunctionDef,
  args: ExprValue[]
):
  | {
      overload: FunctionOverloadDef;
      paramMap: Map<
        string,
        { argIndexes: number[]; param: FunctionParameterDef }
      >;
    }
  | undefined {
  for (const overload of func.overloads) {
    let paramIndex = 0;
    let ok = true;
    const paramMap = new Map();
    for (let argIndex = 0; argIndex < args.length; argIndex++) {
      const arg = args[argIndex];
      const param = overload.params[paramIndex];
      if (param === undefined) {
        ok = false;
        break;
      }
      const argOk = param.allowedTypes.some((param) => {
        const dataTypeMatch =
          param.dataType == arg.dataType || param.dataType == "any";
        const expressionTypeMatch = isExpressionTypeLEQ(
          arg.expressionType,
          param.expressionType
        );
        return dataTypeMatch && expressionTypeMatch;
      });
      if (!argOk) {
        ok = false;
        break;
      }
      const existing = paramMap.get(param.name);
      if (existing) {
        existing.argIndexes.push(argIndex);
      } else {
        paramMap.set(param.name, { "argIndexes": [argIndex], param });
      }
      if (param.isVariadic) {
        if (argIndex === args.length - 1) {
          paramIndex = args.length;
        }
      } else {
        paramIndex++;
      }
    }
    if (overload.params[paramIndex] && overload.params[paramIndex].isVariadic) {
      const param = overload.params[paramIndex];
      // Handle case where no arguments matched the variadic param
      if (!paramMap.has(param.name)) {
        paramMap.set(param.name, { "argIndexes": [], param });
      }
    }
    if (paramIndex !== args.length) {
      continue;
    }
    if (ok) {
      return { overload, paramMap };
    }
  }
}

function joinWith<T>(els: T[][], sep: T): T[] {
  const result: T[] = [];
  for (let i = 0; i < els.length; i++) {
    result.push(...els[i]);
    if (i < els.length - 1) {
      result.push(sep);
    }
  }
  return result;
}
