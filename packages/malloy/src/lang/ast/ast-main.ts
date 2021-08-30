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

import { URL } from "url";
import { cloneDeep } from "lodash";
import * as model from "../../model/malloy_types";
import { Segment } from "../../model/malloy_query";
import {
  FieldSpace,
  TranslationFieldSpace,
  ReduceFieldSpace,
  ProjectFieldSpace,
} from "../field-space";
import { TurtleField } from "../space-field";
import * as Source from "../source-reference";
import { LogMessage, MessageLogger } from "../parse-log";
import { MalloyTranslation } from "../parse-malloy";
import { ExpressionFieldDef, By, ExpressionDef } from "./ast-expr";
import { compressExpr } from "./ast-types";

/*
 ** For times when there is a code generation error but your function needs
 ** to return some kind of object to type properly, the ErrorFactory is
 ** here to help you.
 */
class ErrorFactory {
  static get structDef(): model.StructDef {
    const ret: model.StructDef = {
      type: "struct",
      name: "undefined_error_structdef",
      structSource: { type: "table" },
      structRelationship: { type: "basetable" },
      fields: [],
    };
    return ret;
  }
}

type ChildBody = MalloyElement | MalloyElement[];
type ElementChildren = Record<string, ChildBody>;

export abstract class MalloyElement {
  abstract elementType: string;
  codeLocation?: Source.Range;
  children: ElementChildren = {};
  parent: MalloyElement | null = null;
  private logger?: MessageLogger;

  /**
   * @param kids All children passed to the constructor are not optional
   */
  constructor(kids?: ElementChildren) {
    if (kids) {
      this.has(kids);
    }
  }

  /**
   * Record all elements as children of this element, and mark this
   * element as their parent.
   * @param kids Some of these might be undefined, in which case they ae ignored
   */
  has(kids: Record<string, ChildBody | undefined>): void {
    for (const kidName in kids) {
      const kidValue = kids[kidName];
      if (kidValue !== undefined) {
        this.children[kidName] = kidValue;
        if (kidValue instanceof MalloyElement) {
          kidValue.parent = this;
        } else {
          for (const oneKid of kidValue) {
            oneKid.parent = this;
          }
        }
      }
    }
  }

  get location(): Source.Range | undefined {
    if (this.codeLocation) {
      return this.codeLocation;
    }
    if (this.parent) {
      return this.parent.location;
    }
    return undefined;
  }

  set location(loc: Source.Range | undefined) {
    this.codeLocation = loc;
  }

  protected namespace(): NameSpace | undefined {
    if (this instanceof Document) {
      return this;
    } else if (this.parent) {
      return this.parent.namespace();
    }
  }

  modelEntry(str: string): ModelEntry | undefined {
    return this.namespace()?.getEntry(str);
  }

  private xlate?: MalloyTranslation;

  translator(): MalloyTranslation | undefined {
    if (this.xlate) {
      return this.xlate;
    }
    if (this.parent) {
      return this.parent.translator();
    }
    return undefined;
  }

  setTranslator(x: MalloyTranslation): void {
    this.xlate = x;
  }

  log(logString: string): void {
    const trans = this.translator();
    const msg: LogMessage = {
      sourceURL: trans?.sourceURL || "(missing)",
      message: logString,
    };
    const loc = this.location;
    if (loc) {
      msg.begin = loc.begin;
      msg.end = loc.end;
    }
    const logTo = trans?.root.logger;
    if (logTo) {
      logTo.log(msg);
      return;
    }
    throw new Error(
      `Translation error (without error reporter):\n${JSON.stringify(
        msg,
        null,
        2
      )}`
    );
  }

  /**
   * Mostly for debugging / testing. A string-y version of this object which
   * is used to ask "are these two AST segments equal"
   * @param indent only used for recursion
   */
  toString(): string {
    return this.stringify("", 0);
  }

  private stringify(prefix: string, indent: number): string {
    const left = " ".repeat(indent);
    let asString = `${left}${prefix}<${this.elementType}>${this.varInfo()}`;
    for (const kidLabel of Object.keys(this.children)) {
      const kiddle = this.children[kidLabel];
      if (kiddle instanceof MalloyElement) {
        asString += "\n" + kiddle.stringify(`${kidLabel}: `, indent + 2);
      } else {
        asString += `\n${left}  ${kidLabel}: [`;
        if (kiddle.length > 0) {
          asString +=
            "\n" +
            kiddle.map((k) => k.stringify("", indent + 4)).join("\n") +
            `\n${left}  `;
        }
        asString += "]";
      }
    }
    return asString;
  }

  private varInfo(): string {
    let extra = "";
    for (const [key, value] of Object.entries(this)) {
      if (
        (typeof value === "string" || typeof value === "number") &&
        key !== "elementType"
      ) {
        extra += ` ${key}=${value}`;
      }
    }
    return extra;
  }
}

export class Unimplemented extends MalloyElement {
  elementType = "unimplemented";
}

type ActualField =
  | NameOnly
  | ExpressionFieldDef
  | Turtle
  | FieldReferences
  | Join;

export type FieldDefinition = ActualField | RenameField;

export function isActualField(f: MalloyElement): f is ActualField {
  return (
    f.elementType === "expressionField" ||
    f.elementType === "wildcard" ||
    f.elementType === "nameOnly" ||
    f.elementType === "join" ||
    f.elementType === "turtle"
  );
}

export function isFieldDefinition(f: MalloyElement): f is FieldDefinition {
  return isActualField(f) || f.elementType === "renameField";
}

/**
 * Not sure what we call "something that is defined", will rename this
 * once we know that.
 */
export abstract class Mallobj extends MalloyElement {
  abstract structDef(): model.StructDef;
}

export abstract class Statement extends MalloyElement {
  abstract execute(doc: Document): void;
}

export class Define extends Statement {
  elementType = "define";
  readonly parameters?: HasParameter[];
  constructor(
    readonly name: string,
    readonly mallobj: Mallobj,
    readonly exported: boolean,
    params?: MalloyElement[]
  ) {
    super({ explore: mallobj });
    if (params) {
      this.parameters = [];
      for (const el of params) {
        if (el instanceof HasParameter) {
          this.parameters.push(el);
        } else {
          this.log(
            `Unexpected element type in define statement: ${el.elementType}`
          );
        }
      }
      this.has({ parameters: this.parameters });
    }
  }

  execute(doc: Document): void {
    if (doc.modelEntry(this.name)) {
      this.log(`Cannot redefine '${this.name}'`);
    } else {
      doc.setEntry(this.name, {
        struct: { ...this.mallobj.structDef(), as: this.name },
        exported: this.exported,
      });
    }
  }
}

export interface ExploreInterface {
  primaryKey?: PrimaryKey;
  fieldListEdit?: FieldListEdit;
  fields?: FieldDefinition[];
  filter?: Filter;
  pipeline?: PipelineElement;
}

export class Explore extends Mallobj implements ExploreInterface {
  elementType = "explore";

  // ExploreInterface
  primaryKey?: PrimaryKey;
  fieldListEdit?: FieldListEdit;
  fields: FieldDefinition[] = [];
  filter?: Filter;
  pipeline?: PipelineElement;

  referenceName?: NamedSource;

  constructor(readonly source: Mallobj, init: ExploreInterface = {}) {
    super({ source });
    Object.assign(this, init);
    this.has({
      primaryKey: this.primaryKey,
      acceptOrExcept: this.fieldListEdit,
      fields: this.fields,
      filter: this.filter,
      pipeline: this.pipeline,
    });
    const needsDef =
      init.fieldListEdit !== undefined ||
      init.primaryKey !== undefined ||
      (init.fields && init.fields.length > 0);
    if (this.source instanceof NamedSource && !needsDef) {
      // in a context which accepts a ref, this can be a ref
      this.referenceName = this.source;
    }
  }

  query(): model.Query {
    return this.queryAndShape().query;
  }

  private queryAndShape(): { shape: FieldSpace; query: model.Query } {
    const querySpace = this.headSpace();
    let queryPipe: model.Pipeline = { pipeline: [] };
    let shape = querySpace;
    const filterList = this.filter?.getFilterList(querySpace) || [];
    if (this.pipeline) {
      [shape, queryPipe] = this.pipeline.getPipeline(querySpace);
      const pipeFilters = this.pipeline.getFilterList(querySpace);
      if (pipeFilters) {
        filterList.push(...pipeFilters);
      }
    }
    let nameFromModel: string | undefined;
    if (this.referenceName) {
      const inModel = this.modelEntry(this.referenceName.name);
      if (inModel && inModel.exported) {
        nameFromModel = this.referenceName.name;
      }
    }
    return {
      shape,
      query: {
        type: "query",
        structRef: nameFromModel || querySpace.structDef(),
        ...queryPipe,
        filterList,
      },
    };
  }

  structDef(): model.StructDef {
    const querySpace = this.headSpace();

    if (this.headOnly()) {
      if (this.filter) {
        const filterList: model.FilterExpression[] = [];
        for (const el of this.filter.elements) {
          const fc = el.filterExpression(querySpace);
          if (fc.aggregate) {
            el.log("Can't use aggregate computations in top level filters");
          } else {
            filterList.push(fc);
          }
        }
        if (filterList.length > 0) {
          return { ...querySpace.structDef(), filterList };
        }
      }
      return querySpace.structDef();
    }

    const qs = this.queryAndShape();
    return {
      ...qs.shape.structDef(),
      structSource: {
        type: "query",
        query: qs.query,
      },
    };
  }

  headOnly(): boolean {
    return this.pipeline === undefined;
  }

  private headSpace(): FieldSpace {
    let from = this.source.structDef();
    if (this.primaryKey) {
      // TODO check that primary key exists
      from = cloneDeep(from);
      from.primaryKey = this.primaryKey.field.name;
    }
    const inProgress = TranslationFieldSpace.filteredFrom(
      from,
      this.fieldListEdit
    );
    inProgress.addFields(this.fields);
    return inProgress;
  }
}

export class TableSource extends Mallobj {
  elementType = "tableSource";
  constructor(readonly name: string) {
    super();
  }

  structDef(): model.StructDef {
    const tableDefEntry = this.translator()?.root.schemaZone.getEntry(
      this.name
    );
    let msg = `Schema read failure for table '${this.name}'`;
    if (tableDefEntry) {
      if (tableDefEntry.status == "present") {
        return tableDefEntry.value;
      }
      if (tableDefEntry.status == "error") {
        msg = tableDefEntry.message.includes(this.name)
          ? `'Schema error: ${tableDefEntry.message}`
          : `Schema error '${this.name}': ${tableDefEntry.message}`;
      }
    }
    this.log(msg);
    return ErrorFactory.structDef;
  }
}

export class NamedSource extends Mallobj {
  elementType = "namedSource";

  constructor(readonly name: string) {
    super();
  }

  structDef(): model.StructDef {
    // Defined in this document ast
    const fromModel = this.modelEntry(this.name);
    if (fromModel) {
      return fromModel.struct;
    }
    this.log(`'${this.name}' undefined data source`);
    return ErrorFactory.structDef;
  }
}

export class AnonymousSource extends Mallobj {
  elementType = "anonymousSource";
  constructor(readonly explore: Explore) {
    super({ explore });
  }

  structDef(): model.StructDef {
    return this.explore.structDef();
  }
}

export class Join extends MalloyElement {
  elementType = "join";
  constructor(
    readonly name: FieldName,
    readonly source: Mallobj,
    readonly key: FieldName
  ) {
    super({ name, source, key });
  }

  getStructDef(): model.StructDef {
    const sourceDef = this.source.structDef();
    const joinStruct: model.StructDef = {
      ...sourceDef,
      structRelationship: {
        type: "foreignKey",
        foreignKey: this.key.name,
      },
    };
    if (sourceDef.structSource.type === "query") {
      // the name from query does not need to be preserved
      joinStruct.name = this.name.name;
    } else {
      joinStruct.as = this.name.name;
    }

    return joinStruct;
  }
}
export class FilterElement extends MalloyElement {
  elementType = "filterElement";
  constructor(readonly expr: ExpressionDef, readonly exprSrc: string) {
    super({ expr });
  }

  filterExpression(fs: FieldSpace): model.FilterExpression {
    const exprVal = this.expr.getExpression(fs);
    if (exprVal.dataType !== "boolean") {
      this.expr.log("Filter expression must have boolean value");
      return {
        source: this.exprSrc,
        expression: ["_FILTER_MUST_RETURN_BOOLEAN_"],
      };
    }
    const exprCond: model.FilterExpression = {
      source: this.exprSrc,
      expression: compressExpr(exprVal.value),
    };
    if (exprVal.aggregate) {
      exprCond.aggregate = true;
    }
    return exprCond;
  }
}

export class Filter extends MalloyElement {
  elementType = "filter";
  constructor(readonly elements: FilterElement[] = []) {
    super({ elements });
  }

  empty(): boolean {
    return this.elements.length === 0;
  }

  notEmpty(): boolean {
    return this.elements.length > 0;
  }

  getFilterList(fs: FieldSpace): model.FilterExpression[] {
    return this.elements.map((e) => e.filterExpression(fs));
  }
}

export class FieldName
  extends MalloyElement
  implements CollectionMemberInterface
{
  elementType = "field name";

  constructor(readonly name: string) {
    super();
  }

  get text(): string {
    return this.name;
  }
}

interface CollectionMemberInterface {
  text: string;
}
export type CollectionMember = FieldName | Wildcard;

export class FieldReferences extends MalloyElement {
  elementType = "field reference list";
  constructor(readonly members: CollectionMember[]) {
    super({ members });
  }
}

export class FieldListEdit extends MalloyElement {
  elementType = "fieldListEdit";
  constructor(
    readonly edit: "accept" | "except",
    readonly refs: FieldReferences
  ) {
    super({ refs });
  }
}

export interface ModelEntry {
  struct: model.StructDef;
  exported?: boolean;
}
export interface NameSpace {
  getEntry(name: string): ModelEntry | undefined;
  setEntry(name: string, value: ModelEntry, exported: boolean): void;
}

export class Document extends MalloyElement implements NameSpace {
  elementType = "document";
  documentModel: Record<string, ModelEntry> = {};
  queryList: model.Query[] = [];
  constructor(readonly statements: Statement[], readonly explore?: Explore) {
    super({ statements });
    if (explore) {
      this.has({ explore });
    }
  }

  getModelDef(extendingModelDef: model.ModelDef | undefined): model.ModelDef {
    this.documentModel = {};
    this.queryList = [];
    if (extendingModelDef) {
      for (const inName in extendingModelDef.structs) {
        const struct = extendingModelDef.structs[inName];
        if (struct.type == "struct") {
          const exported = extendingModelDef.exports.includes(inName);
          this.setEntry(inName, { struct, exported });
        }
      }
    }
    for (const stmt of this.statements) {
      stmt.execute(this);
    }
    const def: model.ModelDef = { name: "", exports: [], structs: {} };
    for (const entry in this.documentModel) {
      if (this.documentModel[entry].exported) {
        def.exports.push(entry);
      }
      def.structs[entry] = cloneDeep(this.documentModel[entry].struct);
    }
    return def;
  }

  getEntry(str: string): ModelEntry {
    return this.documentModel[str];
  }

  setEntry(str: string, ent: ModelEntry): void {
    this.documentModel[str] = ent;
  }
}

export class PrimaryKey extends MalloyElement {
  elementType = "primary key";
  constructor(readonly field: FieldName) {
    super({ field });
  }
}

export class RenameField extends MalloyElement {
  elementType = "renameField";
  constructor(readonly newName: string, readonly oldName: string) {
    super();
  }
}

export class NameOnly extends MalloyElement {
  elementType = "nameOnly";
  constructor(
    readonly oldName: FieldName,
    readonly filter: Filter,
    readonly newName?: string
  ) {
    super({ oldName });
  }

  getFieldDef(_fs: FieldSpace): model.FieldDef {
    throw new Error("REF/DUP fields not implemented yet");
  }
}

export class Wildcard
  extends MalloyElement
  implements CollectionMemberInterface
{
  elementType = "wildcard";
  constructor(readonly joinName: string, readonly star: "*" | "**") {
    super();
  }

  getFieldDef(): model.FieldDef {
    throw new Error("wildcard field def not implemented");
  }

  get text(): string {
    return this.joinName !== "" ? `${this.joinName}.${this.star}` : this.star;
  }
}

export class OrderBy extends MalloyElement {
  elementType = "orderBy";
  constructor(readonly field: number | string, readonly dir?: "asc" | "desc") {
    super();
  }

  orderBy(): model.OrderBy {
    const orderElement: model.OrderBy = { field: this.field };
    if (this.dir) {
      orderElement.dir = this.dir;
    }
    return orderElement;
  }
}

export class OrderByList extends MalloyElement {
  elementType = "orderByList";
  constructor(readonly list: OrderBy[]) {
    super({ list });
  }
}

export class OrderLimit extends MalloyElement {
  elementType = "orderLimit";
  constructor(readonly orderBy: OrderByList, readonly limit?: number) {
    super({ orderBy });
  }
}

export class Limit extends MalloyElement {
  elementType = "limit";
  constructor(readonly limit: number) {
    super();
  }
}

export type ReduceField =
  | NameOnly
  | ExpressionFieldDef
  | FieldReferences
  | Turtle;
export type ProjectField = FieldReferences | ExpressionFieldDef | NameOnly;
export type IndexField = FieldReferences;

type QueryStageField = ReduceField | ProjectField;

export interface PipeInit {
  filter?: Filter;
  fields?: QueryStageField[];
  orderBy?: OrderBy[];
  limit?: number;
  by?: By;
}

export class Turtle extends MalloyElement {
  elementType = "turtle";
  constructor(readonly pipe: PipelineElement, readonly name: FieldName) {
    super({ pipe, name });
  }

  getFieldDef(space: FieldSpace): model.TurtleDef {
    const [_, pipe] = this.pipe.getPipeline(space);
    return { type: "turtle", name: this.name.text, ...pipe };
  }
}

export abstract class SegmentElement extends MalloyElement {
  elementType = "pipesegment";
  abstract getPipeSegment(fs: FieldSpace): model.PipeSegment;
}

abstract class QuerySegmentElement extends SegmentElement implements PipeInit {
  elementType = "abtract query ssegment";
  filter?: Filter;
  fields: QueryStageField[] = [];
  orderBy: OrderBy[] = [];
  limit?: number;
  by?: By;

  constructor(init: PipeInit) {
    super();
    Object.assign(this, init);
    this.has({
      filter: this.filter,
      fields: this.fields,
      orderBy: this.orderBy,
      by: this.by,
    });
  }

  abstract seedSegment(inputSpace: FieldSpace): model.QuerySegment;

  getPipeSegment(inputSpace: FieldSpace): model.QuerySegment {
    const qSeg = this.seedSegment(inputSpace);
    if (this.limit) {
      qSeg.limit = this.limit;
    }

    if (this.filter) {
      qSeg.filterList = this.filter.getFilterList(inputSpace);
    }

    if (this.by) {
      const byThing = this.by.by;
      if (typeof byThing === "string") {
        qSeg.by = { by: "name", name: byThing };
      } else {
        const eVal = byThing.getExpression(inputSpace);
        if (eVal.aggregate) {
          qSeg.by = { by: "expression", e: eVal.value };
        } else {
          this.log("BY expression must be an aggregate");
        }
      }
    } else if (this.orderBy.length > 0) {
      qSeg.orderBy = this.orderBy.map((o) => o.orderBy());
    }
    return qSeg;
  }
}

export class Reduce extends QuerySegmentElement {
  elementType = "reduce";

  seedSegment(inputSpace: FieldSpace): model.ReduceSegment {
    const reduceSpace = new ReduceFieldSpace(inputSpace);
    reduceSpace.addFields(this.fields);
    return {
      type: "reduce",
      fields: reduceSpace.queryFieldDefs(),
    };
  }
}

export class Project extends QuerySegmentElement {
  elementType = "project";

  seedSegment(inputSpace: FieldSpace): model.ProjectSegment {
    const projectSpace = new ProjectFieldSpace(inputSpace);
    projectSpace.addFields(this.fields);
    return {
      type: "project",
      fields: projectSpace.queryFieldDefs(),
    };
  }
}

export class Index extends SegmentElement {
  elementType = "index";
  fields: IndexField[] = [];
  filter?: Filter;
  on?: FieldName;
  limit?: number;

  getPipeSegment(space: FieldSpace): model.IndexSegment {
    const fieldNames: string[] = [];
    for (const ref of this.fields) {
      fieldNames.push(...ref.members.map((m) => m.text));
    }
    const indexDef: model.IndexSegment = {
      type: "index",
      fields: fieldNames,
    };
    if (this.limit) {
      indexDef.limit = this.limit;
    }
    if (this.on) {
      indexDef.weightMeasure = this.on.name;
    }
    if (this.filter) {
      indexDef.filterList = this.filter.getFilterList(space);
    }
    return indexDef;
  }
}

export class PipelineElement extends MalloyElement {
  elementType = "pipeline";
  turtleHead?: FieldName;
  headFilters?: Filter;
  constructor(readonly pipeBody: SegmentElement[], pipeHead?: FieldName) {
    super({ pipeBody });
    if (pipeHead) {
      this.addHead(pipeHead);
    }
  }

  addHead(turtleName: FieldName, filter?: Filter): void {
    this.has({ turtleHeadName: turtleName, turtleFilter: filter });
    this.turtleHead = turtleName;
    this.headFilters = filter;
  }

  getFilterList(fs: FieldSpace): model.FilterExpression[] | undefined {
    if (this.headFilters) {
      return this.headFilters.getFilterList(fs);
    }
    return undefined;
  }

  getPipeline(fs: FieldSpace): [FieldSpace, model.Pipeline] {
    const ret: model.Pipeline = { pipeline: [] };
    const [outputShape, walked] = this.translateSegments(fs);
    ret.pipeline = walked;
    if (this.turtleHead) {
      ret.pipeHead = { name: this.turtleHead.text };
    }
    return [outputShape, ret];
  }

  nextSpace(prevSpace: FieldSpace, seg: model.PipeSegment): FieldSpace {
    const nxtStruct = Segment.nextStructDef(prevSpace.structDef(), seg);
    return new FieldSpace(nxtStruct);
  }

  translateSegments(fs: FieldSpace): [FieldSpace, model.PipeSegment[]] {
    const segments: model.PipeSegment[] = [];
    fs = fs.headSpace();
    if (this.turtleHead) {
      const nfs = TurtleField.getTailSpace(this, fs, this.turtleHead.text);
      if (nfs === undefined) {
        return [fs, []];
      }
      fs = nfs;
    }

    let lastSegment: model.PipeSegment | undefined;
    for (const head of this.pipeBody) {
      lastSegment = head.getPipeSegment(fs);
      segments.push(lastSegment);
      fs = this.nextSpace(fs, lastSegment);
    }
    return [fs, segments];
  }
}

export class Top extends MalloyElement {
  elementType = "top";
  constructor(readonly limit: number, readonly by: By | undefined) {
    super();
    this.has({ by });
  }
}

export class JSONElement extends MalloyElement {
  elementType = "jsonElement";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly value: any;
  constructor(jsonSrc: string) {
    super();
    try {
      this.value = JSON.parse(jsonSrc);
    } catch (SyntaxError) {
      this.value = undefined;
    }
  }
}

export class JSONStructDef extends Mallobj {
  elementType = "jsonStructDef";
  constructor(readonly struct: model.StructDef) {
    super();
  }

  static fromJSON(jsonObj: JSONElement): JSONStructDef | undefined {
    const obj = jsonObj.value;
    if (
      obj &&
      obj.type === "struct" &&
      obj.structRelationship &&
      obj.structSource
    ) {
      return new JSONStructDef(obj as model.StructDef);
    }
    return undefined;
  }

  structDef(): model.StructDef {
    return this.struct;
  }
}

export class ImportStatement extends Statement {
  elementType = "import statement";
  fullURL?: string;

  /*
   * At the time of writng this comment, it is guaranteed that if an AST
   * node for an import statement is created, the translator has already
   * succesfully fetched the URL referred to in the statement.
   *
   * Error checking code in here is future proofing against a day when
   * there are other ways to contruct an AST.
   */

  constructor(readonly url: string, baseURL: string) {
    super();
    try {
      this.fullURL = new URL(url, baseURL).toString();
    } catch (e) {
      this.log("Invalid URI in import statement");
    }
  }

  execute(doc: Document): void {
    const trans = this.translator();
    if (!trans) {
      this.log("Cannot import without translation context");
    } else if (this.fullURL) {
      const src = trans.root.importZone.getEntry(this.fullURL);
      if (src.status === "present") {
        const importStructs = trans.getChildExports(this.fullURL);
        for (const importing in importStructs) {
          doc.setEntry(importing, {
            struct: importStructs[importing],
            exported: false,
          });
        }
      } else if (src.status === "error") {
        this.log(`import failed: '${src.message}'`);
      } else {
        this.log(`import failed with status: '${src.status}'`);
      }
    }
  }
}

export class DocumentQuery extends Statement {
  elementType = "document query";
  constructor(readonly explore: Explore, readonly index: number) {
    super({ explore });
  }

  execute(doc: Document): void {
    doc.queryList[this.index] = this.explore.query();
  }
}

interface HasInit {
  name: string;
  isCondition: boolean;
  type?: string;
  default?: ExpressionDef;
}
export class HasParameter extends MalloyElement {
  elementType = "hasParameter";
  readonly name: string;
  readonly isCondition: boolean;
  readonly type?: string;
  readonly default?: ExpressionDef;

  constructor(init: HasInit) {
    super();
    this.name = init.name;
    this.isCondition = init.isCondition;
    this.type = init.type;
    if (init.default) {
      this.default = init.default;
      this.has({ default: this.default });
    }
  }
}
