/*
 * Copyright 2022 Google LLC
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
import { Dialect, getDialect } from "../dialect";
import * as model from "../model/malloy_types";
import {
  ExploreField,
  FieldListEdit,
  ExprFieldDecl,
  RenameField,
  Wildcard,
  Join,
  FieldName,
  TurtleDecl,
  HasParameter,
  FieldCollectionMember,
  QueryItem,
  NestDefinition,
  NestReference,
  MalloyElement,
} from "./ast";
import * as FieldPath from "./field-path";
import {
  SpaceField,
  StructSpaceField,
  JoinSpaceField,
  ExpressionFieldFromAst,
  QueryField,
  QueryFieldAST,
  QueryFieldStruct,
  ColumnSpaceField,
  FANSPaceField,
  WildSpaceField,
  DefinedParameter,
  SpaceEntry,
  AbstractParameter,
  SpaceParam,
} from "./space-field";

type FieldMap = Record<string, SpaceEntry>;

/**
 * A FieldSpace is a hierarchy of namespaces, where the leaf nodes
 * are fields. A FieldSpace can lookup fields, and generate a StructDef
 */
export interface FieldSpace {
  structDef(): model.StructDef;
  emptyStructDef(): model.StructDef;
  findEntry(symbol: string): SpaceEntry | undefined;
  getDialect(): Dialect;
}

/**
 * The father of all FieldSpaces is a wrapper for a StructDef
 */

export class StructSpace implements FieldSpace {
  private memoMap?: FieldMap;
  protected fromStruct: model.StructDef;

  constructor(sourceStructDef: model.StructDef) {
    this.fromStruct = sourceStructDef;
  }

  getDialect(): Dialect {
    return getDialect(this.fromStruct.dialect);
  }

  fromFieldDef(from: model.FieldDef): SpaceField {
    if (from.type === "struct") {
      return new StructSpaceField(from);
    } else if (model.isTurtleDef(from)) {
      return new QueryFieldStruct(this, from);
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
          this.memoMap[paramName] = new DefinedParameter(paramDef);
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
    return { ...this.fromStruct, fields: [] };
  }

  outerName(): string {
    return this.fromStruct.as || this.fromStruct.name;
  }

  findEntry(fieldPath: string): SpaceEntry | undefined {
    const split = FieldPath.of(fieldPath);
    const ref = this.entry(split.head);
    if (ref) {
      if (ref instanceof StructSpaceField) {
        return ref.fieldSpace.findEntry(split.tail);
      }
      if (split.tail === "") {
        return ref;
      }
      throw new Error(`'${split.head}' cannot contain a '${split.tail}'`);
    } else {
      return undefined;
    }
  }
}

/**
 * A FieldSpace which is coming from source code
 */
export class NewFieldSpace extends StructSpace {
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
  ): NewFieldSpace {
    const edited = new NewFieldSpace(from);
    if (choose) {
      const names = choose.refs.list.filter((f) => f instanceof FieldName);
      for (const s of choose.refs.list.filter((f) => f instanceof Wildcard)) {
        s.log("Wildcards not allowed in accept/except");
      }
      const oldMap = edited.entries();
      edited.dropEntries();
      for (const [symbol, value] of oldMap) {
        const included = !!names.find((f) => f.refString === symbol);
        const accepting = choose.edit === "accept";
        if (included === accepting) {
          edited.setEntry(symbol, value);
        }
      }
    }
    return edited;
  }

  // private anonymousFieldIndex = 0;

  protected setEntry(name: string, value: SpaceEntry): void {
    if (this.final) {
      throw new Error("Space already final");
    }
    super.setEntry(name, value);
  }

  // nextAnonymousField(): string {
  //   // outername can be a long dotted table path
  //   const namePath = this.outerName().split(".");
  //   const nextName =
  //     namePath.pop() + "_anon_" + this.anonymousFieldIndex.toString();
  //   this.anonymousFieldIndex += 1;
  //   return nextName;
  // }

  addParameters(params: HasParameter[]): NewFieldSpace {
    for (const oneP of params) {
      this.setEntry(oneP.name, new AbstractParameter(oneP));
    }
    return this;
  }

  addField(...defs: ExploreField[]): void {
    for (const def of defs) {
      // TODO express the "three fields kinds" in a typesafe way
      // one of three kinds of fields are legal in an explore: expressions ...
      const elseLog = def.log;
      const elseType = def.elementType;
      if (def instanceof ExprFieldDecl) {
        const exprField = new ExpressionFieldFromAst(this, def);
        this.setEntry(exprField.name, exprField);
        // querry (turtle) fields
      } else if (def instanceof TurtleDecl) {
        const name = def.name;
        this.setEntry(name, new QueryFieldAST(this, def, name));
      } else if (def instanceof RenameField) {
        if (def.oldName === def.newName) {
          def.log("Can't rename field to itself");
          continue;
        }
        const oldValue = this.entry(def.oldName);
        if (oldValue instanceof SpaceField) {
          oldValue.rename(def.newName);
          this.setEntry(def.newName, oldValue);
          this.dropEntry(def.oldName);
        } else {
          def.log(`Can't rename '${def.oldName}', no such field`);
        }
      } else if (def instanceof Join) {
        this.setEntry(def.name, new JoinSpaceField(this, def));
      } else {
        elseLog(
          `Error translating fields for '${this.outerName()}': Expected expression, query, or rename, got '${elseType}'`
        );
      }
    }
  }

  structDef(): model.StructDef {
    const parameters = this.fromStruct.parameters || {};
    if (this.final === undefined) {
      this.final = {
        ...this.fromStruct,
        fields: [],
      };
      // Need to process the entities in specific order
      const fields: [string, SpaceField][] = [];
      const joins: [string, SpaceField][] = [];
      const turtles: [string, SpaceField][] = [];
      const fixupJoins: [Join, model.StructDef][] = [];
      for (const [name, spaceEntry] of this.entries()) {
        if (spaceEntry instanceof StructSpaceField) {
          joins.push([name, spaceEntry]);
        } else if (spaceEntry instanceof QueryField) {
          turtles.push([name, spaceEntry]);
        } else if (spaceEntry instanceof SpaceField) {
          fields.push([name, spaceEntry]);
        } else if (spaceEntry instanceof SpaceParam) {
          parameters[name] = spaceEntry.parameter();
        }
      }
      const reorderFields = [...fields, ...joins, ...turtles];
      for (const [fieldName, field] of reorderFields) {
        if (field instanceof JoinSpaceField && field.join.needsFixup()) {
          const joinStruct = field.join.structDef();
          this.final.fields.push(joinStruct);
          fixupJoins.push([field.join, joinStruct]);
        } else {
          const fieldDef = field.fieldDef();
          if (fieldDef) {
            this.final.fields.push(fieldDef);
          } else {
            throw new Error(`'${fieldName}' doesnt' have a FieldDef`);
          }
        }
      }
      if (Object.entries(parameters).length > 0) {
        this.final.parameters = parameters;
      }
      // If we have join expressions, we need to now go back and fill them in
      for (const [join, missingOn] of fixupJoins) {
        join.fixupJoinOn(this, missingOn);
      }
    }
    return this.final;
  }
}

type QuerySegType = "reduce" | "project" | "index";
/**
 * Maintains the two namespaces (computation space and output space)
 * for a query segment
 */
export abstract class QueryFieldSpace extends NewFieldSpace {
  abstract segType: QuerySegType;
  astEl?: MalloyElement | undefined;

  constructor(readonly inputSpace: FieldSpace) {
    super(inputSpace.emptyStructDef());
  }

  /**
   * Although this QueryFieldSpace is collecting definitions for the
   * output space, expressions are all evaluated against the input space.
   *
   * I think this is probably a mistake, some external object should
   * hold both the input and output spaces, but I haven't been able to
   * refold my brain to see this properly yet.
   */
  findEntry(fieldPath: string): SpaceEntry | undefined {
    return this.inputSpace.findEntry(fieldPath);
  }

  /**
   * Another seperation of concerns problem. AST object containing the
   * QueryDesc is currently making the decicions needed to create a
   * StructDef, and it is a mistake to ever call this. Feels wrong.
   */
  structDef(): model.StructDef {
    throw new Error("INTERNAL ERROR: StructDef for pipe member requested");
  }

  addQueryItems(...qiList: QueryItem[]): void {
    for (const qi of qiList) {
      if (qi instanceof FieldName || qi instanceof NestReference) {
        this.addReference(qi.name);
      } else if (qi instanceof ExprFieldDecl) {
        this.addField(qi);
      } else if (qi instanceof NestDefinition) {
        this.setEntry(qi.name, new QueryFieldAST(this.inputSpace, qi, qi.name));
      } else {
        throw new Error("INTERNAL ERROR: QueryFieldSpace unknown element");
      }
    }
  }

  addMembers(members: FieldCollectionMember[]): void {
    for (const member of members) {
      if (member instanceof FieldName) {
        this.addReference(member.name);
      } else if (member instanceof Wildcard) {
        this.setEntry(member.refString, new WildSpaceField(member.refString));
      } else {
        this.addField(member);
      }
    }
  }

  addReference(ref: string): void {
    this.setEntry(ref, new FANSPaceField(ref, this));
  }

  conContain(_qd: model.QueryFieldDef): boolean {
    return true;
  }

  queryFieldDefs(): model.QueryFieldDef[] {
    const fields: model.QueryFieldDef[] = [];
    for (const [name, field] of this.entries()) {
      if (field instanceof SpaceField) {
        const fieldQueryDef = field.queryFieldDef();
        if (fieldQueryDef) {
          if (this.conContain(fieldQueryDef)) {
            fields.push(fieldQueryDef);
          } else {
            this.log(`'${name}' not legal in ${this.segType}`);
          }
        } else {
          throw new Error(`'${name}' does not have a QueryFieldDef`);
        }
      }
    }
    return fields;
  }

  log(s: string): void {
    if (this.astEl) {
      this.astEl.log(s);
    }
  }
}

export class ReduceFieldSpace extends QueryFieldSpace {
  segType: QuerySegType = "reduce";
}

export class ProjectFieldSpace extends QueryFieldSpace {
  segType: QuerySegType = "project";
  inputStruct: model.StructDef;
  constructor(inputFS: FieldSpace) {
    super(inputFS);
    this.inputStruct = inputFS.structDef();
  }

  conContain(qd: model.QueryFieldDef): boolean {
    if (typeof qd !== "string") {
      if (model.isFilteredAliasedName(qd)) {
        return true;
      }
      if (qd.type === "turtle") {
        this.log("Cannot nest queries in project");
        return false;
      }
      if (qd.aggregate) {
        this.log("Cannot add aggregate measures to project");
        return false;
      }
    }
    return true;
  }
}

export class IndexFieldSpace extends QueryFieldSpace {
  segType: QuerySegType = "index";

  indexSegment(exisitingFields?: model.QueryFieldDef[]): model.IndexSegment {
    const seg: model.IndexSegment = {
      type: "index",
      fields: [],
    };
    const inIndex: Record<string, boolean> = {};
    for (const [name, _] of this.entries()) {
      inIndex[name] = true;
      seg.fields.push(name);
    }
    if (exisitingFields) {
      for (const exists of exisitingFields) {
        if (typeof exists === "string" && !inIndex[exists]) {
          seg.fields.push(exists);
          inIndex[exists] = true;
        }
      }
    }
    return seg;
  }
}

/**
 * Used to detect references to fields in the statement which defines them
 */
export class CircleSpace implements FieldSpace {
  foundCircle = false;
  constructor(readonly realFS: FieldSpace, readonly circular: ExprFieldDecl) {}
  structDef(): model.StructDef {
    return this.realFS.structDef();
  }
  emptyStructDef(): model.StructDef {
    return this.realFS.emptyStructDef();
  }
  findEntry(symbol: string): SpaceEntry | undefined {
    if (symbol === this.circular.defineName) {
      this.foundCircle = true;
      return undefined;
    }
    return this.realFS.findEntry(symbol);
  }
  getDialect(): Dialect {
    return this.realFS.getDialect();
  }
}
