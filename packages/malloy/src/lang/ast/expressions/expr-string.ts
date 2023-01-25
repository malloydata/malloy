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

import { ExpressionDef } from "./expression-def";
import { FieldSpace } from "../field-space";
import { ExprValue } from "../compound-types/expr-value";
import { FT } from "../fragtype-utils";

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
