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
import { Dialect, getDialect } from "../dialect";
import * as model from "../model/malloy_types";
import {
  ExploreField,
  FieldListEdit,
  FieldDeclaration,
  RenameField,
  WildcardFieldReference,
  Join,
  FieldName,
  TurtleDecl,
  HasParameter,
  FieldCollectionMember,
  QueryItem,
  MalloyElement,
  NestReference,
  FieldReference,
  ErrorFactory,
  isNestedQuery,
} from "./ast";
import {
  SpaceField,
  StructSpaceField,
  JoinSpaceField,
  ExpressionFieldFromAst,
  QueryField,
  QueryFieldAST,
  QueryFieldStruct,
  ColumnSpaceField,
  WildSpaceField,
  DefinedParameter,
  SpaceEntry,
  AbstractParameter,
  SpaceParam,
  RenameSpaceField,
  ReferenceField,
} from "./space-field";
import { nameOf, mergeFields } from "./field-utils";

type FieldMap = Record<string, SpaceEntry>;

interface LookupFound {
  found: SpaceEntry;
  error: undefined;
}
interface LookupError {
  error: string;
  found: undefined;
}
export type LookupResult = LookupFound | LookupError;

/**
 * A FieldSpace is a hierarchy of namespaces, where the leaf nodes
 * are fields. A FieldSpace can lookup fields, and generate a StructDef
 */
export interface FieldSpace {
  type: "fieldSpace";
  structDef(): model.StructDef;
  emptyStructDef(): model.StructDef;
  lookup(symbol: FieldName[]): LookupResult;
  getDialect(): Dialect;
}

/**
 * The father of all FieldSpaces is a wrapper for a StructDef.
 */

export class StaticSpace implements FieldSpace {
  readonly type = "fieldSpace";
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

  lookup(path: FieldName[]): LookupResult {
    const head = path[0];
    const rest = path.slice(1);
    const found = this.entry(head.refString);
    if (!found) {
      return { error: `'${head}' is not defined`, found };
    }
    if (found instanceof SpaceField) {
      const definition = found.fieldDef();
      if (definition) {
        head.addReference({
          type:
            found instanceof StructSpaceField
              ? "joinReference"
              : "fieldReference",
          definition,
          location: head.location,
          text: head.refString,
        });
      }
    }
    if (rest.length) {
      if (found instanceof StructSpaceField) {
        return found.fieldSpace.lookup(rest);
      }
      return {
        error: `'${head}' cannot contain a '${rest[0]}'`,
        found: undefined,
      };
    }
    return { found, error: undefined };
  }
}

export type SourceSpec = model.StructDef | FieldSpace;
function isFieldSpace(x: SourceSpec): x is FieldSpace {
  return x.type == "fieldSpace";
}

/**
 * Based on how things are constructed, the starting field space
 * can either be another field space or an existing structdef.
 * Using a SourceSpace allows a class to accept either one
 * and use either version at some future time.
 */
class SourceSpace {
  private spaceSpec: SourceSpec;
  private asFS?: StaticSpace;
  private asStruct?: model.StructDef;

  constructor(readonly sourceSpec: SourceSpec) {
    this.spaceSpec = sourceSpec;
  }

  get structDef(): model.StructDef {
    if (isFieldSpace(this.spaceSpec)) {
      if (!this.asStruct) {
        this.asStruct = this.spaceSpec.structDef();
      }
      return this.asStruct;
    }
    return this.spaceSpec;
  }

  get fieldSpace(): FieldSpace {
    if (isFieldSpace(this.spaceSpec)) {
      return this.spaceSpec;
    }
    if (!this.asFS) {
      this.asFS = new StaticSpace(this.spaceSpec);
    }
    return this.asFS;
  }
}

/**
 * A FieldSpace which may undergo modification
 */
export class DynamicSpace extends StaticSpace {
  protected final: model.StructDef | undefined;
  protected source: SourceSpace;
  constructor(extending: SourceSpec) {
    const source = new SourceSpace(extending);
    super(cloneDeep(source.structDef));
    this.final = undefined;
    this.source = source;
  }

  /**
   * Factory for DynamicSpace when there are accept/except edits
   * @param from A structdef which seeds this space
   * @param choose A accept/except edit of the "from" fields
   */
  static filteredFrom(
    from: model.StructDef,
    choose?: FieldListEdit
  ): DynamicSpace {
    const edited = new DynamicSpace(from);
    if (choose) {
      const names = choose.refs.list;
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

  protected setEntry(name: string, value: SpaceEntry): void {
    if (this.final) {
      throw new Error("Space already final");
    }
    super.setEntry(name, value);
  }

  addParameters(params: HasParameter[]): DynamicSpace {
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
      if (def instanceof FieldDeclaration) {
        const exprField = new ExpressionFieldFromAst(this, def);
        this.setEntry(exprField.name, exprField);
        // querry (turtle) fields
      } else if (def instanceof TurtleDecl) {
        const name = def.name;
        this.setEntry(name, new QueryFieldAST(this, def, name));
      } else if (def instanceof RenameField) {
        if (def.oldName.refString === def.newName) {
          def.log("Can't rename field to itself");
          continue;
        }
        const oldValue = def.oldName.getField(this);
        if (oldValue.found) {
          if (oldValue.found instanceof SpaceField) {
            this.setEntry(
              def.newName,
              new RenameSpaceField(oldValue.found, def.newName, def.location)
            );
            this.dropEntry(def.oldName.refString);
          } else {
            def.log(`'${def.oldName}' cannot be renamed`);
          }
        } else {
          def.log(`Can't rename '${def.oldName}', no such field`);
        }
      } else if (def instanceof Join) {
        this.setEntry(def.name.refString, new JoinSpaceField(this, def));
      } else {
        elseLog(
          `Internal error: Expected expression, query, or rename, got '${elseType}'`
        );
      }
    }
  }

  addFieldDef(fd: model.FieldDef): void {
    this.setEntry(nameOf(fd), this.fromFieldDef(fd));
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
        if (field instanceof JoinSpaceField) {
          const joinStruct = field.join.structDef();
          if (!ErrorFactory.isErrorStructDef(joinStruct)) {
            this.final.fields.push(joinStruct);
            fixupJoins.push([field.join, joinStruct]);
          }
        } else {
          const fieldDef = field.fieldDef();
          if (fieldDef) {
            this.final.fields.push(fieldDef);
          } else {
            throw new Error(`'${fieldName}' doesn't have a FieldDef`);
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
 * A namespace for Query operations. The have an input and an
 * output set of fields.
 */
export abstract class QueryOperationSpace extends DynamicSpace {
  abstract segType: QuerySegType;
  astEl?: MalloyElement | undefined;
  readonly queryInput: SourceSpace;

  constructor(input: SourceSpec) {
    const inputSpace = new SourceSpace(input);
    super({ ...inputSpace.structDef, fields: [] });
    this.queryInput = inputSpace;
  }

  inputFS(): FieldSpace {
    return this.queryInput.fieldSpace;
  }

  lookup(_fieldPath: FieldName[]): LookupResult {
    throw new Error("INTERNAL ERRROR, SHOULD LOOKUP IN INPUT SPACE");
    /*
     * once HAVING works correctly this should lookup fields in the output space
     * OR in the input space or somewthing like that
     */
  }

  structDef(): model.StructDef {
    // Actually since we have the input structdef and the fields, this feels
    // like it could return the output structdef of the query op ... except
    // the pipeline code merges refinements in before asking for the output
    // struct, and that would require a call back here somehow to get the
    // pre-refinement fields ... I think possibly this is always a
    // runtime error
    throw new Error("StructDef requested from QueryOperationSpace");
  }

  abstract getPipeSegment(
    refineFrom: model.PipeSegment | undefined
  ): model.PipeSegment;

  addMembers(members: FieldCollectionMember[]): void {
    for (const member of members) {
      if (member instanceof FieldReference) {
        this.addReference(member);
      } else if (member instanceof WildcardFieldReference) {
        this.setEntry(member.refString, new WildSpaceField(member.refString));
      } else {
        this.addField(member);
      }
    }
  }

  addReference(ref: FieldReference): void {
    const refName = ref.outputName;
    if (this.entry(refName)) {
      ref.log(`Output already has a field named '${refName}'`);
    } else {
      this.setEntry(refName, new ReferenceField(ref));
    }
  }

  log(s: string): void {
    if (this.astEl) {
      this.astEl.log(s);
    }
  }
}

/**
 * Reduce and project queries use a "QuerySpace"
 */
export abstract class QuerySpace extends QueryOperationSpace {
  extendedInput?: DynamicSpace;
  extendedFields: string[] = [];

  extendSource(extendField: Join | FieldDeclaration): void {
    this.extendedFields.push(
      extendField instanceof Join
        ? extendField.name.refString
        : extendField.defineName
    );
    this.extendInto().addField(extendField);
  }

  inputFS(): FieldSpace {
    if (this.extendedInput) {
      return this.extendedInput;
    }
    return this.queryInput.fieldSpace;
  }

  private extendInto(): DynamicSpace {
    if (!this.extendedInput) {
      this.extendedInput = new DynamicSpace(this.queryInput.sourceSpec);
    }
    return this.extendedInput;
  }

  getPipeSegment(
    refineFrom: model.QuerySegment | undefined
  ): model.QuerySegment {
    const reduceOrProject = this.segType;
    if (reduceOrProject === "index") {
      throw new Error("IndexSegment getPipeSegment should not call super");
    }

    if (refineFrom?.extendSource) {
      for (const xField of refineFrom.extendSource) {
        this.extendInto().addFieldDef(xField);
      }
    }
    const segment: model.QuerySegment = {
      type: reduceOrProject,
      fields: this.queryFieldDefs(),
    };

    segment.fields = mergeFields(refineFrom?.fields, segment.fields);

    if (refineFrom?.extendSource) {
      segment.extendSource = refineFrom.extendSource;
    }
    if (this.extendedInput) {
      const newExtends: model.FieldDef[] = [];
      // have to get the whole structdef because we need all the join
      // resolution to happen and that only happens at the completion
      // of the structdef generation.
      const extendedStruct = this.extendedInput.structDef();

      for (const extendName of this.extendedFields) {
        const extendEnt = extendedStruct.fields.find(
          (f) => nameOf(f) == extendName
        );
        if (extendEnt) {
          newExtends.push(extendEnt);
        }
      }
      segment.extendSource = mergeFields(segment.extendSource, newExtends);
    }
    return segment;
  }

  addQueryItems(...qiList: QueryItem[]): void {
    for (const qi of qiList) {
      if (qi instanceof FieldReference || qi instanceof NestReference) {
        this.addReference(qi);
      } else if (qi instanceof FieldDeclaration) {
        this.addField(qi);
      } else if (isNestedQuery(qi)) {
        this.setEntry(qi.name, new QueryFieldAST(this.inputFS(), qi, qi.name));
      } else {
        // Compiler will error if we don't handle all cases
        const _unhandledQUeryItem: never = qi;
      }
    }
  }

  conContain(_qd: model.QueryFieldDef): boolean {
    return true;
  }

  protected queryFieldDefs(): model.QueryFieldDef[] {
    const fields: model.QueryFieldDef[] = [];
    for (const [name, field] of this.entries()) {
      if (field instanceof SpaceField) {
        const fieldQueryDef = field.getQueryFieldDef(this.inputFS());
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
}

export class ReduceFieldSpace extends QuerySpace {
  segType: QuerySegType = "reduce";
}

export class ProjectFieldSpace extends QuerySpace {
  segType: QuerySegType = "project";

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

export class IndexFieldSpace extends QueryOperationSpace {
  segType: QuerySegType = "index";
  fieldList = new Set<string>();

  addReference(ref: FieldReference): void {
    if (ref.getField(this.inputFS()).found) {
      this.fieldList.add(ref.refString);
    }
  }

  getPipeSegment(refineIndex?: model.PipeSegment): model.IndexSegment {
    if (refineIndex && refineIndex.fields) {
      for (const exists of refineIndex.fields) {
        if (typeof exists == "string") {
          this.fieldList.add(exists);
        }
      }
    }
    return {
      type: "index",
      fields: Array.from(this.fieldList.values()),
    };
  }
}

/**
 * Used to detect references to fields in the statement which defines them
 */
export class DefSpace implements FieldSpace {
  readonly type = "fieldSpace";
  foundCircle = false;
  constructor(
    readonly realFS: FieldSpace,
    readonly circular: FieldDeclaration
  ) {}
  structDef(): model.StructDef {
    return this.realFS.structDef();
  }
  emptyStructDef(): model.StructDef {
    return this.realFS.emptyStructDef();
  }
  lookup(symbol: FieldName[]): LookupResult {
    if (symbol[0] && symbol[0].refString === this.circular.defineName) {
      this.foundCircle = true;
      return {
        error: `Circular reference to '${this.circular.defineName}' in definition`,
        found: undefined,
      };
    }
    return this.realFS.lookup(symbol);
  }
  getDialect(): Dialect {
    return this.realFS.getDialect();
  }
}
