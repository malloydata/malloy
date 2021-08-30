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

/* eslint-disable no-useless-constructor */
import { cloneDeep } from "lodash";
import * as model from "../model/malloy_types";
import {
  NameOnly,
  CollectionMember,
  FieldDefinition,
  FieldListEdit,
  ExpressionFieldDef,
  RenameField,
  Wildcard,
  Join,
  FieldName,
  FieldReferences,
  MalloyElement,
  Turtle,
} from "./ast";
import * as FieldPath from "./field-path";
import {
  SpaceField,
  StructSpaceField,
  ExpressionFieldFromAst,
  TurtleFieldAST,
  TurtleFieldStruct,
  ColumnSpaceField,
  FANSPaceField,
  WildSpaceField,
  TurtleField,
  SpaceParam,
  SpaceEntry,
} from "./space-field";

type FieldMap = Record<string, SpaceEntry>;

/**
 * The grand daddy of all FieldSpace(s) is JUST a wrapper for a StructDef
 *
 * A FieldSpace is a hierarchy of namespaces, where the leaf nodes
 * are fields. A FieldSpace can lookup fields, and generate a StructDef
 */
export class FieldSpace {
  private memoMap?: FieldMap;
  protected fromStruct: model.StructDef;

  constructor(sourceStructDef: model.StructDef) {
    this.fromStruct = sourceStructDef;
  }

  fromFieldDef(from: model.FieldDef): SpaceField {
    if (from.type === "struct") {
      return new StructSpaceField(from);
    } else if (model.isTurtleDef(from)) {
      return new TurtleFieldStruct(this, from);
    }
    // TODO field has an "e" and needs to be an expression
    // TODO field has a filter and needs to be a filteredalias
    return new ColumnSpaceField(from);
  }

  private get map(): FieldMap {
    if (this.memoMap === undefined) {
      this.memoMap = {};
      for (const f of this.fromStruct.fields) {
        const name = f.as || f.name;
        this.memoMap[name] = this.fromFieldDef(f);
      }
      if (this.fromStruct.parameters) {
        for (const [paramName, paramDef] of Object.entries(
          this.fromStruct.parameters
        )) {
          if (this.memoMap[paramName]) {
            throw new Error(
              `In struct '${this.fromStruct.as || this.fromStruct.name}': ` +
                ` : Field and parameter name conflict '${paramName}`
            );
          }
          this.memoMap[paramName] = new SpaceParam(paramDef);
        }
      }
    }
    return this.memoMap;
  }

  protected dropEntries(): void {
    this.memoMap = {};
  }

  protected dropEntry(name: string): void {
    delete this.map[name];
  }

  protected entry(name: string): SpaceEntry | undefined {
    return this.map[name];
  }

  protected setEntry(name: string, value: SpaceEntry): void {
    this.map[name] = value;
  }

  protected entries(): [string, SpaceEntry][] {
    return Object.entries(this.map);
  }

  structDef(): model.StructDef {
    return this.fromStruct;
  }

  emptyStructDef(): model.StructDef {
    const copyStructDef = { ...this.fromStruct };
    copyStructDef.fields = [];
    return copyStructDef;
  }

  outerName(): string {
    return this.fromStruct.as || this.fromStruct.name;
  }

  field(fieldPath: string): SpaceEntry | undefined {
    const split = FieldPath.of(fieldPath);
    const ref = this.entry(split.head);
    if (ref) {
      if (ref instanceof StructSpaceField) {
        return ref.fieldSpace.field(split.tail);
      }
      if (split.tail === "") {
        return ref;
      }
      throw new Error(`'${split.head}' cannot contain a '${split.tail}'`);
    } else {
      return undefined;
    }
  }

  /**
   * Field space is asked "what is the first field space for a pipeline". For
   * a StructDef FieldSpace, the StructDef is the head.
   */
  headSpace(): FieldSpace {
    return this;
  }
}

/**
 * Used by an AST element to build up a struct def from fields and joins.
 */
export class TranslationFieldSpace extends FieldSpace {
  final: model.StructDef | undefined;
  constructor(inputStruct: model.StructDef) {
    super(cloneDeep(inputStruct));
    this.final = undefined;
  }

  /**
   * Factory for TranslationFieldSpace
   * @param from A structdef which seeds this space
   * @param choose A accept/except edit of the "from" fields
   */
  static filteredFrom(
    from: model.StructDef,
    choose?: FieldListEdit
  ): TranslationFieldSpace {
    const edited = new TranslationFieldSpace(from);
    if (choose) {
      const names = choose.refs.members.filter((f) => f instanceof FieldName);
      const stars = choose.refs.members.filter((f) => f instanceof Wildcard);
      if (stars.length > 0) {
        throw new Error("Wildcards not allowed in accept/except");
      }
      const oldMap = edited.entries();
      edited.dropEntries();
      for (const [symbol, value] of oldMap) {
        const included = !!names.find((f) => f.text === symbol);
        const accepting = choose.edit === "accept";
        if (included === accepting) {
          edited.setEntry(symbol, value);
        }
      }
    }
    return edited;
  }

  private anonymousFieldIndex = 0;

  protected setEntry(name: string, value: SpaceEntry): void {
    if (this.final) {
      throw new Error("Space already final");
    }
    super.setEntry(name, value);
  }

  nextAnonymousField(): string {
    // outername can be a long dotted table path
    const namePath = this.outerName().split(".");
    const nextName =
      namePath.pop() + "_anon_" + this.anonymousFieldIndex.toString();
    this.anonymousFieldIndex += 1;
    return nextName;
  }

  addFields(defs: FieldDefinition[]): TranslationFieldSpace {
    for (const def of defs) {
      this.addField(def);
    }
    return this;
  }

  addField(def: FieldDefinition): void {
    // TODO express the "three fields kinds" in a typesafe way
    // one of three kinds of fields are legal in an explore: expressions ...
    if (def instanceof ExpressionFieldDef) {
      const exprField = new ExpressionFieldFromAst(this, def);
      this.setEntry(exprField.name, exprField);
      // querry (turtle) fields
    } else if (def instanceof Turtle) {
      const name = def.name?.name || this.nextAnonymousField();
      this.setEntry(name, new TurtleFieldAST(this, def, name));
      // or a newName RENAMES oldName statement
    } else if (def instanceof RenameField) {
      const oldValue = this.entry(def.oldName);
      if (oldValue instanceof SpaceField) {
        oldValue.rename(def.newName);
        this.setEntry(def.newName, oldValue);
        this.dropEntry(def.oldName);
      } else {
        throw new Error(`Can't rename '${def.oldName}', no such field`);
      }
    } else if (def instanceof NameOnly) {
      const ref = new FANSPaceField(def.oldName.name, this, {
        as: def.newName,
        filterList: def.filter.getFilterList(this),
      });
      this.setEntry(ref.name(), ref);
    } else if (def instanceof Join) {
      const joining = def.getStructDef();
      this.setEntry(def.name.name, new StructSpaceField(joining));
    } else if (def instanceof MalloyElement) {
      def.log(
        `Error translating fields for '${this.outerName()}': Expected expression, query, or rename, got '${
          def.elementType
        }'`
      );
    } else {
      throw new Error(
        `Error translating fields for '${this.outerName()}'` +
          `: Expected and expression, query, or rename, got something else`
      );
    }
  }

  structDef(): model.StructDef {
    if (this.final === undefined) {
      this.final = {
        ...this.fromStruct,
        fields: [],
      };
      // Need to process the entities in specific order
      const fields: [string, SpaceField][] = [];
      const joins: [string, SpaceField][] = [];
      const turtles: [string, SpaceField][] = [];
      for (const [name, spaceField] of this.entries()) {
        if (spaceField instanceof StructSpaceField) {
          joins.push([name, spaceField]);
        } else if (spaceField instanceof TurtleField) {
          turtles.push([name, spaceField]);
        } else if (spaceField instanceof SpaceField) {
          fields.push([name, spaceField]);
        } else if (spaceField instanceof SpaceParam) {
          throw new Error("Can't write structdefs with params yet");
        }
      }
      const reorderFields = [...fields, ...joins, ...turtles];
      for (const [fieldName, field] of reorderFields) {
        const fieldDef = field.fieldDef();
        if (fieldDef) {
          this.final.fields.push(fieldDef);
        } else {
          throw new Error(`'${fieldName}' doesnt' have a FieldDef`);
        }
      }
    }
    return this.final;
  }
}

/**
 * Maintains the two namespaces (computation space and output space)
 * of a stage in a query pipeline.
 */
export abstract class PipeFieldSpace extends TranslationFieldSpace {
  pipeHeadSpace: FieldSpace;

  constructor(readonly inputSpace: FieldSpace) {
    super(inputSpace.emptyStructDef());
    this.pipeHeadSpace = inputSpace.headSpace();
  }

  /**
   * For a pipeline in an explore, the "headSpace" of the first
   * segment is the headSpace of the explore space, which is the
   * explore space.
   *
   * For a pipeline in a turtle, inside an explore, the headSpace
   * of the turtle is the headSpace of the explore, which
   * is the explore space.
   *
   * For a pipeline in a turtle which is in a turtle, the headSpace
   * ALSO bubbles up and is the headspace of the explore.
   * @returns FieldSpace -- The space to use to start pipelines in this space
   */
  headSpace(): FieldSpace {
    return this.pipeHeadSpace;
  }

  /*
   ** TODO -- Clean this up someday
   **
   ** The unclarity is that a PipeFieldSpace "has a" field space as input
   ** the input, and "is a field space" for the pipe stage being
   ** constructed. Expressions inside the space will be evaluated
   ** in the inputspace.
   **
   ** What would be ideal is that the expressions inside the space
   ** somehow evaluated correctly without this hack to field()
   ** and structDef() which feel like signs I don't have the right abstractions
   */
  field(fieldPath: string): SpaceEntry | undefined {
    return this.inputSpace.field(fieldPath);
  }

  structDef(): model.StructDef {
    // Only really know the structdef when we are in a pipe, and then
    // that would be computed based on the input. ast.Query knows
    // how to do that, and PipeFieldSpace provides queryFieldDefs()
    // to make that possible. It is always an error to ask for this,
    throw new Error("Can't get StructDef for pipe member");
  }

  addMembers(members: CollectionMember[]): void {
    for (const member of members) {
      if (member instanceof FieldName) {
        this.setEntry(member.name, new FANSPaceField(member.name, this));
      }
      if (member instanceof Wildcard) {
        this.setEntry(member.text, new WildSpaceField(member.text));
      }
    }
  }

  addField(def: FieldDefinition): void {
    if (
      def instanceof ExpressionFieldDef ||
      def instanceof Turtle ||
      def instanceof NameOnly
    ) {
      super.addField(def);
    } else if (def instanceof FieldReferences) {
      this.addMembers(def.members);
    } else {
      def.log("Field type not allowed in a pipe segment");
    }
  }

  queryFieldDefs(): model.QueryFieldDef[] {
    const fields: model.QueryFieldDef[] = [];
    for (const [name, field] of this.entries()) {
      if (field instanceof SpaceField) {
        const fieldQueryDef = field.queryFieldDef();
        if (fieldQueryDef) {
          fields.push(fieldQueryDef);
        } else {
          throw new Error(`'${name}' does not have a QueryFieldDef`);
        }
      } else {
        throw new Error("Params lost in outputting queryFieldDefs");
      }
    }
    return fields;
  }
}

export class ReduceFieldSpace extends PipeFieldSpace {}

export class ProjectFieldSpace extends PipeFieldSpace {
  addField(def: FieldDefinition): void {
    if (def instanceof Wildcard) {
      this.setEntry(def.text, new WildSpaceField(def.text));
    } else {
      super.addField(def);
    }
  }
}
