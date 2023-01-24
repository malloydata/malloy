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

import * as model from "../model/malloy_types";

import { SpaceParam } from "./ast/space-param";
import { FieldSpace } from "./ast/field-space";
import { FieldReference } from "./ast/field-references";
import { FieldType } from "./ast/ast-types";
import { SpaceField } from "./ast/space-field";
// "Space Fields" are a field in a field space

/**
 * FilteredAliasedName
 */
export class FANSPaceField extends SpaceField {
  as?: string;
  filterList?: model.FilterExpression[];
  constructor(
    readonly ref: FieldReference,
    readonly inSpace: FieldSpace,
    refInit?: Partial<model.FilteredAliasedName>
  ) {
    super();
    Object.assign(this, refInit);
  }

  name(): string {
    return this.as || this.ref.refString;
  }

  private filtersPresent() {
    return this.filterList && this.filterList.length > 0;
  }

  fieldDef(): model.FieldDef | undefined {
    if (this.as === undefined) {
      return undefined;
    }
    const fromField = this.ref.getField(this.inSpace).found;
    if (fromField === undefined) {
      // TODO should errror
      return undefined;
    }
    const fieldTypeInfo = fromField.type();
    const fieldType = fieldTypeInfo.type;
    // TODO starting to feel like this should be a method call on a spaceentry
    if (model.isAtomicFieldType(fieldType)) {
      if (fromField instanceof SpaceParam) {
        return {
          type: fieldType,
          name: this.as,
          e: [{ type: "parameter", path: this.ref.refString }],
          expressionType: "scalar",
        };
      }
      let fieldExpr: model.Expr = [{ type: "field", path: this.ref.refString }];
      if (this.filtersPresent() && this.filterList) {
        const newfieldExpr: model.Expr = [
          {
            type: "filterExpression",
            filterList: this.filterList,
            e: fieldExpr,
          },
        ];
        fieldExpr = newfieldExpr;
      }
      return {
        type: fieldType,
        name: this.as,
        e: fieldExpr,
        expressionType: fieldTypeInfo.expressionType,
      };
    }
    return undefined;
  }

  getQueryFieldDef(_fs: FieldSpace): model.QueryFieldDef {
    // TODO if this reference is to a field which does not exist
    // it needs to be an error SOMEWHERE
    const n: model.FilteredAliasedName = { name: this.ref.refString };
    if (this.filtersPresent()) {
      n.filterList = this.filterList;
    }
    if (this.as) {
      n.as = this.as;
    }
    return n.as || n.filterList ? n : this.ref.refString;
  }

  type(): FieldType {
    const field = this.ref.getField(this.inSpace).found;
    return field?.type() || { type: "unknown" };
  }
}
