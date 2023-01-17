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
import {
  FieldSpace,
  DynamicSpace,
  StaticSpace,
  QuerySpace,
} from "./field-space";
import {
  FieldValueType,
  FieldDeclaration,
  TurtleDecl,
  HasParameter,
  Join,
  FieldReference,
} from "./ast";

// "Space Fields" are a field in a field space

interface FieldType {
  type: FieldValueType;
  expressionType?: model.ExpressionType;
}

export abstract class SpaceEntry {
  abstract type(): FieldType;
  abstract refType: "field" | "parameter";
}

export abstract class SpaceParam extends SpaceEntry {
  abstract parameter(): model.Parameter;
  readonly refType = "parameter";
}

export class DefinedParameter extends SpaceParam {
  constructor(readonly paramDef: model.Parameter) {
    super();
  }

  parameter(): model.Parameter {
    return this.paramDef;
  }

  type(): FieldType {
    return { type: this.paramDef.type };
  }
}

export class AbstractParameter extends SpaceParam {
  constructor(readonly astParam: HasParameter) {
    super();
  }

  parameter(): model.Parameter {
    return this.astParam.parameter();
  }

  type(): FieldType {
    const type = this.astParam.type || "unknown";
    return { type };
  }
}

export abstract class SpaceField extends SpaceEntry {
  readonly refType = "field";

  protected fieldTypeFromFieldDef(def: model.FieldDef): FieldType {
    const ref: FieldType = { type: def.type };
    if (model.isFieldTypeDef(def) && def.expressionType) {
      ref.expressionType = def.expressionType;
    }
    return ref;
  }

  getQueryFieldDef(_fs: FieldSpace): model.QueryFieldDef | undefined {
    return undefined;
  }

  fieldDef(): model.FieldDef | undefined {
    return undefined;
  }
}

export class RenameSpaceField extends SpaceField {
  constructor(
    private readonly otherField: SpaceField,
    private readonly newName: string,
    private readonly location: model.DocumentLocation
  ) {
    super();
  }

  fieldDef(): model.FieldDef | undefined {
    const renamedFieldRaw = this.otherField.fieldDef();
    if (renamedFieldRaw === undefined) {
      return undefined;
    }
    return {
      ...renamedFieldRaw,
      as: this.newName,
      location: this.location,
    };
  }

  type(): FieldType {
    return this.otherField.type();
  }
}

export class WildSpaceField extends SpaceField {
  constructor(readonly wildText: string) {
    super();
  }

  type(): FieldType {
    throw new Error("should never ask a wild field for its type");
  }

  getQueryFieldDef(_fs: FieldSpace): model.QueryFieldDef {
    return this.wildText;
  }
}

export class StructSpaceField extends SpaceField {
  protected space?: FieldSpace;
  constructor(protected sourceDef: model.StructDef) {
    super();
  }

  get fieldSpace(): FieldSpace {
    if (!this.space) {
      this.space = new StaticSpace(this.sourceDef);
    }
    return this.space;
  }

  fieldDef(): model.FieldDef {
    return this.sourceDef;
  }

  type(): FieldType {
    return { type: "struct" };
  }
}

export class JoinSpaceField extends StructSpaceField {
  constructor(readonly intoFS: FieldSpace, readonly join: Join) {
    super(join.structDef());
  }
}

export class ColumnSpaceField extends SpaceField {
  constructor(protected def: model.FieldTypeDef) {
    super();
  }

  fieldDef(): model.FieldDef {
    return this.def;
  }

  type(): FieldType {
    return this.fieldTypeFromFieldDef(this.def);
  }
}

export abstract class QueryField extends SpaceField {
  constructor(protected inSpace: FieldSpace) {
    super();
  }

  abstract getQueryFieldDef(fs: FieldSpace): model.QueryFieldDef | undefined;
  abstract fieldDef(): model.FieldDef;

  type(): FieldType {
    return { type: "turtle" };
  }
}

export class QueryFieldAST extends QueryField {
  renameAs?: string;
  nestParent?: QuerySpace;
  constructor(
    fs: FieldSpace,
    readonly turtle: TurtleDecl,
    protected name: string
  ) {
    super(fs);
  }

  getQueryFieldDef(fs: FieldSpace): model.QueryFieldDef {
    const def = this.turtle.getFieldDef(fs, this.nestParent);
    if (this.renameAs) {
      def.as = this.renameAs;
    }
    return def;
  }

  fieldDef(): model.TurtleDef {
    const def = this.turtle.getFieldDef(this.inSpace, this.nestParent);
    if (this.renameAs) {
      def.as = this.renameAs;
    }
    return def;
  }
}

export class QueryFieldStruct extends QueryField {
  constructor(fs: FieldSpace, protected turtleDef: model.TurtleDef) {
    super(fs);
  }

  rename(name: string): void {
    this.turtleDef = {
      ...this.turtleDef,
      as: name,
    };
  }

  fieldDef(): model.TurtleDef {
    return this.turtleDef;
  }

  getQueryFieldDef(_fs: FieldSpace): model.QueryFieldDef | undefined {
    return this.fieldDef();
  }
}

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

export class ReferenceField extends SpaceField {
  constructor(readonly fieldRef: FieldReference) {
    super();
  }

  getQueryFieldDef(fs: FieldSpace): model.QueryFieldDef | undefined {
    // Lookup string and generate error if it isn't defined.
    const check = this.fieldRef.getField(fs);
    if (check.error) {
      this.fieldRef.log(check.error);
    }
    return this.fieldRef.refString;
  }

  type(): FieldType {
    return { type: "unknown" };
  }
}

export class ExpressionFieldFromAst extends SpaceField {
  fieldName: string;
  defType?: FieldType;
  constructor(
    readonly space: DynamicSpace,
    readonly exprDef: FieldDeclaration
  ) {
    super();
    this.fieldName = exprDef.defineName;
  }

  get name(): string {
    return this.fieldName;
  }

  fieldDef(): model.FieldDef {
    const def = this.exprDef.fieldDef(this.space, this.name);
    this.defType = this.fieldTypeFromFieldDef(def);
    return def;
  }

  getQueryFieldDef(fs: FieldSpace): model.QueryFieldDef {
    const def = this.exprDef.queryFieldDef(fs, this.name);
    this.defType = this.fieldTypeFromFieldDef(def);
    return def;
  }

  type(): FieldType {
    if (this.defType) {
      return this.defType;
    }
    return this.fieldTypeFromFieldDef(this.fieldDef());
  }
}
