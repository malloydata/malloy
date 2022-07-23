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
import { FieldSpace, DynamicSpace, StaticSpace } from "./field-space";
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

  getQueryFieldDef(_fs: FieldSpace): model.QueryFieldDef | undefined {
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

// TODO delete instead of uncomment
// /**
//  * FilteredAliasedName
//  */
// export class FANSPaceField extends SpaceField {
//   as?: string;
//   filterList?: model.FilterExpression[];
//   constructor(
//     readonly ref: FieldReference,
//     readonly inSpace: FieldSpace,
//     refInit?: Partial<model.FilteredAliasedName>
//   ) {
//     super();
//     Object.assign(this, refInit);
//   }

//   name(): string {
//     const oldName = this.ref.list[this.ref.list.length-1];
//     return this.as || oldName.refString;
//   }

//   private filtersPresent() {
//     return this.filterList && this.filterList.length > 0;
//   }

//   fieldDef(): model.FieldDef | undefined {
//     if (this.as === undefined) {
//       return undefined;
//     }
//     const fromField = this.ref.getField(this.inSpace).found;
//     if (fromField === undefined) {
//       // TODO should errror
//       return undefined;
//     }
//     const fieldTypeInfo = fromField.type();
//     const fieldType = fieldTypeInfo.type;
//     // TODO starting to feel like this should be a method call on a spaceentry
//     if (model.isAtomicFieldType(fieldType)) {
//       if (fromField instanceof SpaceParam) {
//         return {
//           type: fieldType,
//           name: this.as,
//           e: [ fromField.parameterExpression()
//           aggregate: false,
//         };
//       }
//       let fieldExpr: model.Expr = [{ type: "field", path: this.ref.refString }];
//       if (this.filtersPresent() && this.filterList) {
//         const newfieldExpr: model.Expr = [
//           {
//             type: "filterExpression",
//             filterList: this.filterList,
//             e: fieldExpr,
//           },
//         ];
//         fieldExpr = newfieldExpr;
//       }
//       return {
//         type: fieldType,
//         name: this.as,
//         e: fieldExpr,
//         aggregate: fieldTypeInfo.aggregate,
//       };
//     }
//     return undefined;
//   }
//
//   getQueryFieldDef(_fs: FieldSpace): model.QueryFieldDef {
//     // TODO if this reference is to a field which does not exist
//     // it needs to be an error SOMEWHERE
//     const n: model.FilteredAliasedName = { name: this.ref.refString };
//     if (this.filtersPresent()) {
//       n.filterList = this.filterList;
//     }
//     if (this.as) {
//       n.as = this.as;
//     }
//     return n.as || n.filterList ? n : this.ref.refString;
//   }
//
//   type(): FieldType {
//     const field = this.ref.getField(this.inSpace).found;
//     return field?.type() || { type: "unknown" };
//   }
// }

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
    // TODO return a FieldReference
    return this.fieldRef.toString();
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

  getQueryFieldDef(queryInputFS: FieldSpace): model.QueryFieldDef {
    const def = this.exprDef.queryFieldDef(queryInputFS, this.name);
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
