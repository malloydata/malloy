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
import { Segment } from "../model/malloy_query";
import { FieldSpace, TranslationFieldSpace } from "./field-space";
import {
  MalloyElement,
  FieldValueType,
  ExpressionFieldDef,
  Turtle,
} from "./ast";

// "Space Fields" are a field in a field space

interface FieldType {
  type: FieldValueType;
  aggregate?: boolean;
}

export abstract class SpaceField {
  // TODO Field should decide if they care about naming with an "implements"
  abstract rename(newName: string): void;

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

  abstract type(): FieldType;
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

  rename(_name: string): void {
    throw new Error("Can't rename wild things");
  }
}

export class StructSpaceField extends SpaceField {
  protected space?: FieldSpace;
  constructor(protected sourceDef: model.StructDef) {
    super();
  }

  get fieldSpace(): FieldSpace {
    if (!this.space) {
      this.space = new FieldSpace(this.sourceDef);
    }
    return this.space;
  }

  fieldDef(): model.FieldDef {
    return this.sourceDef;
  }

  rename(name: string): void {
    this.sourceDef = {
      ...this.sourceDef,
      as: name,
    };
    this.space = undefined;
  }

  type(): FieldType {
    return { type: "struct" };
  }
}

export class ColumnSpaceField extends SpaceField {
  constructor(protected def: model.FieldTypeDef) {
    super();
  }

  rename(name: string): void {
    this.def = {
      ...this.def,
      as: name,
    };
  }

  fieldDef(): model.FieldDef {
    return this.def;
  }

  type(): FieldType {
    return this.fieldTypeFromFieldDef(this.def);
  }
}

interface ResultPipeline {
  segments: model.PipeSegment[];
  lastSpace: FieldSpace;
}
function isResultPipeline(wr: WalkResult): wr is ResultPipeline {
  const rp = wr as ResultPipeline;
  return rp.segments !== undefined && rp.lastSpace !== undefined;
}
interface WalkError {
  error: true;
  message?: string;
}
type WalkResult = ResultPipeline | WalkError;

export abstract class TurtleField extends SpaceField {
  constructor(protected inSpace: FieldSpace) {
    super();
  }

  abstract walkSegments(_ignore: MalloyElement, fs: FieldSpace): WalkResult;

  static getTailSpace(
    logEl: MalloyElement,
    fs: FieldSpace,
    turtleName: string | undefined
  ): FieldSpace | undefined {
    if (turtleName === undefined) {
      return fs;
    }
    const turtle = fs.field(turtleName);
    if (turtle === undefined) {
      logEl.log(`Reference to undefined turtle '${turtleName}'`);
      return undefined;
    }
    if (!(turtle instanceof TurtleField)) {
      logEl.log(`Expected '${turtleName} to reference a turtle`);
      return undefined;
    }
    const turtleWalk = turtle.walkSegments(logEl, fs);
    if (!isResultPipeline(turtleWalk)) {
      return undefined;
    }
    return turtleWalk.lastSpace;
  }

  queryFieldDef(): model.QueryFieldDef | undefined {
    return this.fieldDef();
  }

  type(): FieldType {
    return { type: "turtle" };
  }
}

export class TurtleFieldAST extends TurtleField {
  constructor(fs: FieldSpace, readonly turtle: Turtle, protected name: string) {
    super(fs);
  }

  walkSegments(_logEl: MalloyElement, fs: FieldSpace): WalkResult {
    const [lastFs, segs] = this.turtle.pipe.translateSegments(fs);
    return {
      segments: segs,
      lastSpace: lastFs,
    };
  }

  rename(newName: string): void {
    this.name = newName;
  }

  fieldDef(): model.TurtleDef {
    const [_, modelPipe] = this.turtle.pipe.getPipeline(this.inSpace);
    return { type: "turtle", name: this.name, ...modelPipe };
  }
}

export class TurtleFieldStruct extends TurtleField {
  constructor(fs: FieldSpace, protected turtleDef: model.TurtleDef) {
    super(fs);
  }

  walkSegments(logEl: MalloyElement, fs: FieldSpace): WalkResult {
    const walked: WalkResult = {
      lastSpace: fs,
      segments: [],
    };
    const turtleName = this.turtleDef.pipeHead?.name;
    if (turtleName) {
      const nfs = TurtleField.getTailSpace(logEl, fs, turtleName);
      if (nfs === undefined) {
        return { error: true };
      }
      walked.lastSpace = nfs;
    }
    const pipe = this.turtleDef.pipeline;
    if (pipe.length > 0) {
      let inputStruct = walked.lastSpace.structDef();
      for (const seg of this.turtleDef.pipeline) {
        inputStruct = Segment.nextStructDef(inputStruct, seg);
      }
      walked.lastSpace = new FieldSpace(inputStruct);
    }
    return walked;
  }

  rename(name: string): void {
    this.turtleDef = {
      ...this.turtleDef,
      as: name,
    };
  }

  fieldDef(): model.FieldDef {
    return this.turtleDef;
  }
}

/**
 * FilteredAliasedName
 */
export class FANSPaceField extends SpaceField {
  as?: string;
  filterList?: model.FilterCondition[];
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

  rename(name: string): void {
    this.as = name;
  }

  private filtersPresent() {
    return this.filterList && this.filterList.length > 0;
  }

  fieldDef(): model.FieldDef | undefined {
    if (this.as === undefined) {
      return undefined;
    }
    const fromField = this.inSpace.field(this.ref);
    if (fromField === undefined) {
      // TODO should errror
      return undefined;
    }
    const fieldTypeInfo = fromField.type();
    const fieldType = fieldTypeInfo.type;
    if (model.isAtomicFieldType(fieldType)) {
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
    const field = this.inSpace.field(this.ref);
    return field?.type() || { type: "unknown" };
  }
}

// we do not know the type of an expression as we add it to the list,
// as it may need symbols we have not yet added to the symbol table.
//
// later when the output field def is request, then we can evaluate
// the expression and determine the return type
//
// TODO smart logic about naming this field based on the expression
export class ExpressionFieldFromAst extends SpaceField {
  fieldName: string;
  constructor(
    readonly space: TranslationFieldSpace,
    readonly exprDef: ExpressionFieldDef
  ) {
    super();
    const defName = exprDef.fieldName?.name;
    if (defName) {
      this.fieldName = defName;
    } else {
      const fieldProvided = exprDef.expr.defaultFieldName();
      this.fieldName = fieldProvided || space.nextAnonymousField();
    }
  }

  get name(): string {
    return this.fieldName;
  }

  rename(name: string): void {
    this.fieldName = name;
  }

  fieldDef(): model.FieldDef {
    return this.exprDef.fieldDef(this.space, this.name);
  }

  queryFieldDef(): model.QueryFieldDef {
    return this.fieldDef();
  }

  type(): FieldType {
    return this.fieldTypeFromFieldDef(this.fieldDef());
  }
}
