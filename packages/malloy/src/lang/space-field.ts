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

import * as model from "../model/malloy_types";
import { FieldSpace, StructSpace, NewFieldSpace } from "./field-space";
import {
  FieldValueType,
  ExprFieldDecl,
  TurtleDecl,
  HasParameter,
  Join,
} from "./ast";

// "Space Fields" are a field in a field space

interface FieldType {
  type: FieldValueType;
  aggregate?: boolean;
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
    if (model.isFieldTypeDef(def) && def.aggregate) {
      ref.aggregate = true;
    }
    return ref;
  }

  queryFieldDef(): model.QueryFieldDef | undefined {
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

  queryFieldDef(): model.QueryFieldDef {
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
      this.space = new StructSpace(this.sourceDef);
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

  queryFieldDef(): model.QueryFieldDef | undefined {
    return this.fieldDef();
  }

  type(): FieldType {
    return { type: "turtle" };
  }
}

export class QueryFieldAST extends QueryField {
  renameAs?: string;
  constructor(
    fs: FieldSpace,
    readonly turtle: TurtleDecl,
    protected name: string
  ) {
    super(fs);
  }

  fieldDef(): model.TurtleDef {
    const def = this.turtle.getFieldDef(this.inSpace);
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
}

/**
 * FilteredAliasedName
 */
export class FANSPaceField extends SpaceField {
  as?: string;
  filterList?: model.FilterExpression[];
  constructor(
    readonly ref: string,
    readonly inSpace: FieldSpace,
    refInit?: Partial<model.FilteredAliasedName>
  ) {
    super();
    Object.assign(this, refInit);
  }

  name(): string {
    return this.as || this.ref;
  }

  private filtersPresent() {
    return this.filterList && this.filterList.length > 0;
  }

  fieldDef(): model.FieldDef | undefined {
    if (this.as === undefined) {
      return undefined;
    }
    const fromField = this.inSpace.findEntry(this.ref);
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
          e: [{ type: "parameter", path: this.ref }],
          aggregate: false,
        };
      }
      let fieldExpr: model.Expr = [{ type: "field", path: this.ref }];
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
        aggregate: fieldTypeInfo.aggregate,
      };
    }
    return undefined;
  }

  queryFieldDef(): model.QueryFieldDef {
    // TODO if this reference is to a field which does not exist
    // it needs to be an error SOMEWHERE
    const n: model.FilteredAliasedName = { name: this.ref };
    if (this.filtersPresent()) {
      n.filterList = this.filterList;
    }
    if (this.as) {
      n.as = this.as;
    }
    return n.as || n.filterList ? n : this.ref;
  }

  type(): FieldType {
    const field = this.inSpace.findEntry(this.ref);
    return field?.type() || { type: "unknown" };
  }
}

export class ExpressionFieldFromAst extends SpaceField {
  fieldName: string;
  constructor(readonly space: NewFieldSpace, readonly exprDef: ExprFieldDecl) {
    super();
    this.fieldName = exprDef.defineName;
    // left over from anonymous expression days
    // we may not know the type of an expression as we add it to the list,
    //
    // TODO smart logic about naming this field based on the expression
    // const defName = exprDef.defineName;
    // if (defName) {
    //   this.fieldName = defName;
    // }
    // else {
    //   const fieldProvided = exprDef.expr.defaultFieldName();
    //   this.fieldName = fieldProvided || space.nextAnonymousField();
    // }
  }

  get name(): string {
    return this.fieldName;
  }

  fieldDef(): model.FieldDef {
    return this.exprDef.fieldDef(this.space, this.name);
  }

  queryFieldDef(): model.QueryFieldDef {
    return this.exprDef.queryFieldDef(this.space, this.name);
  }

  type(): FieldType {
    return this.fieldTypeFromFieldDef(this.fieldDef());
  }
}
