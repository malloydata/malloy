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
import { Segment as ModelQuerySegment } from "../../model/malloy_query";
import {
  FieldSpace,
  ReduceFieldSpace,
  ProjectFieldSpace,
  DynamicSpace,
  QuerySpace,
  IndexFieldSpace,
  LookupResult,
  QueryOperationSpace,
} from "../field-space";
import { MessageLogger } from "../parse-log";
import { MalloyTranslation } from "../parse-malloy";
import {
  compressExpr,
  ConstantSubExpression,
  ExpressionDef,
  FieldDeclaration,
} from "./index";
import { QueryField } from "../space-field";
import { makeSQLBlock, SQLBlockRequest } from "../../model/sql_block";

/*
 ** For times when there is a code generation error but your function needs
 ** to return some kind of object to type properly, the ErrorFactory is
 ** here to help you.
 */
export class ErrorFactory {
  static get structDef(): model.StructDef {
    const ret: model.StructDef = {
      type: "struct",
      name: "//undefined_error_structdef",
      dialect: "//undefined_errror_dialect",
      structSource: { type: "table" },
      structRelationship: {
        type: "basetable",
        connectionName: "//undefined_error_conection",
      },
      fields: [],
    };
    return ret;
  }

  static isErrorStructdef(s: model.StructDef): boolean {
    return s.name === this.structDef.name;
  }

  static get query(): model.Query {
    return {
      structRef: ErrorFactory.structDef,
      pipeline: [],
    };
  }

  static get reduceSegment(): model.ReduceSegment {
    return { type: "reduce", fields: [] };
  }

  static get projectSegment(): model.ProjectSegment {
    return { type: "project", fields: [] };
  }

  static get indexSegment(): model.IndexSegment {
    return { type: "index", fields: [] };
  }
}

function opOutputStruct(
  logTo: MalloyElement,
  inputStruct: model.StructDef,
  opDesc: model.PipeSegment
): model.StructDef {
  const badModel =
    logTo.errorsExist() || ErrorFactory.isErrorStructdef(inputStruct);
  // Don't call into the model code with a broken model
  if (!badModel) {
    try {
      return ModelQuerySegment.nextStructDef(inputStruct, opDesc);
    } catch (e) {
      logTo.log(`INTERNAL ERROR model/Segment.nextStructDef: ${e.message}`);
    }
  }
  return ErrorFactory.structDef;
}

type ChildBody = MalloyElement | MalloyElement[];
type ElementChildren = Record<string, ChildBody>;

export abstract class MalloyElement {
  abstract elementType: string;
  codeLocation?: model.DocumentLocation;
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
   * @param kids Some of these might be undefined, in which case they are ignored
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

  get location(): model.DocumentLocation {
    if (this.codeLocation) {
      return this.codeLocation;
    }
    if (this.parent) {
      return this.parent.location;
    }
    return {
      url: this.sourceURL,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    };
  }

  set location(loc: model.DocumentLocation | undefined) {
    this.codeLocation = loc;
  }

  protected namespace(): NameSpace | undefined {
    if (this instanceof Document) {
      return this;
    } else if (this.parent) {
      return this.parent.namespace();
    }
    throw new Error("INTERNAL ERROR: Translation without document scope");
  }

  modelEntry(reference: string | ModelEntryReference): ModelEntry | undefined {
    const key =
      reference instanceof ModelEntryReference ? reference.name : reference;
    const result = this.namespace()?.getEntry(key);
    if (reference instanceof ModelEntryReference) {
      if (result?.entry.type === "query") {
        this.addReference({
          type: "queryReference",
          text: key,
          definition: result.entry,
          location: reference.location,
        });
      } else if (result?.entry.type === "struct") {
        this.addReference({
          type: "exploreReference",
          text: key,
          definition: result.entry,
          location: reference.location,
        });
      } else if (result?.entry.type === "sqlBlock") {
        this.addReference({
          type: "sqlBlockReference",
          text: key,
          definition: result.entry,
          location: reference.location,
        });
      }
    }
    return result;
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

  addReference(reference: model.DocumentReference): void {
    this.translator()?.addReference(reference);
  }

  private get sourceURL() {
    const trans = this.translator();
    return trans?.sourceURL || "(missing)";
  }

  errorsExist(): boolean {
    const logger = this.translator()?.root.logger;
    if (logger) {
      return logger.hasErrors();
    }
    return true;
  }

  private logged = new Set<string>();
  log(message: string): void {
    if (this.codeLocation) {
      /*
       * If this element has a location, then don't report the same
       * error message at the same location more than once
       */
      if (this.logged.has(message)) {
        return;
      }
      this.logged.add(message);
    }
    const trans = this.translator();
    const msg = { at: this.location, message };
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
   * is used to ask "are these two AST segments equal". Formatted so that
   * errors would be human readable.
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

  walk(callBack: (node: MalloyElement) => void): void {
    callBack(this);
    for (const kidLabel of Object.keys(this.children)) {
      const kiddle = this.children[kidLabel];
      if (kiddle instanceof MalloyElement) {
        kiddle.walk(callBack);
      } else {
        for (const k of kiddle) {
          k.walk(callBack);
        }
      }
    }
  }

  private varInfo(): string {
    let extra = "";
    for (const [key, value] of Object.entries(this)) {
      if (key !== "elementType") {
        if (typeof value == "boolean") {
          extra += value ? ` ${key}` : ` !${key}`;
        } else if (typeof value === "string" || typeof value === "number") {
          extra += ` ${key}=${value}`;
        }
      }
    }
    return extra;
  }

  protected internalError(msg: string): Error {
    this.log(`INTERNAL ERROR IN TRANSLATION: ${msg}`);
    return new Error(msg);
  }
}

export class ListOf<ET extends MalloyElement> extends MalloyElement {
  elementType = "genericElementList";
  private elements: ET[];
  constructor(listDesc: string, elements: ET[]) {
    super();
    this.elements = elements;
    if (this.elementType === "genericElementList") {
      this.elementType = listDesc;
    }
    this.newContents();
  }

  private newContents(): void {
    this.has({ [this.elementType]: this.elements });
  }

  get list(): ET[] {
    return this.elements;
  }

  empty(): boolean {
    return this.elements.length === 0;
  }

  notEmpty(): boolean {
    return this.elements.length > 0;
  }

  push(...el: ET[]): ET[] {
    this.elements.push(...el);
    this.newContents();
    return this.elements;
  }
}

export class Unimplemented extends MalloyElement {
  elementType = "unimplemented";
  reported = false;
}

function getStructFieldDef(
  s: model.StructDef,
  fn: string
): model.FieldDef | undefined {
  return s.fields.find((fld) => (fld.as || fld.name) === fn);
}

type FieldDecl = FieldDeclaration | Join | TurtleDecl | Turtles;
function isFieldDecl(f: MalloyElement): f is FieldDecl {
  return (
    f instanceof FieldDeclaration ||
    f instanceof Join ||
    f instanceof TurtleDecl ||
    f instanceof Turtles
  );
}

export type ExploreField = FieldDecl | RenameField;
export function isExploreField(f: MalloyElement): f is ExploreField {
  return isFieldDecl(f) || f instanceof RenameField;
}

/**
 * A "Mallobj" is a thing which you can run queries against, it has been called
 * an "exploreable", or a "space".
 */
export abstract class Mallobj extends MalloyElement {
  abstract structDef(): model.StructDef;

  structRef(): model.StructRef {
    return this.structDef();
  }

  withParameters(pList: HasParameter[] | undefined): model.StructDef {
    const before = this.structDef();
    // TODO name collisions are flagged where?
    if (pList) {
      const parameters = { ...(before.parameters || {}) };
      for (const hasP of pList) {
        const pVal = hasP.parameter();
        parameters[pVal.name] = pVal;
      }
      return {
        ...before,
        parameters,
      };
    }
    return before;
  }
}

class QueryHeadStruct extends Mallobj {
  elementType = "internalOnlyQueryHead";
  constructor(readonly fromRef: model.StructRef) {
    super();
  }

  structRef(): model.StructRef {
    return this.fromRef;
  }

  structDef(): model.StructDef {
    if (model.refIsStructDef(this.fromRef)) {
      return this.fromRef;
    }
    const ns = new NamedSource(this.fromRef);
    this.has({ exploreReference: ns });
    return ns.structDef();
  }
}

export interface DocStatement extends MalloyElement {
  execute(doc: Document): void;
}

export function isDocStatement(e: MalloyElement): e is DocStatement {
  return (e as DocStatement).execute !== undefined;
}

export class DefineExplore extends MalloyElement implements DocStatement {
  elementType = "defineExplore";
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
      const structDef = this.mallobj.withParameters(this.parameters);
      if (ErrorFactory.isErrorStructdef(structDef)) {
        return;
      }
      doc.setEntry(this.name, {
        entry: {
          ...structDef,
          as: this.name,
          location: this.location,
        },
        exported: this.exported,
      });
    }
  }
}

export class DefineSourceList
  extends ListOf<DefineExplore>
  implements DocStatement
{
  constructor(sourceList: DefineExplore[]) {
    super("defineSources", sourceList);
    this.has({ sourceList });
  }

  execute(doc: Document): void {
    for (const dq of this.list) {
      dq.execute(doc);
    }
  }
}

/**
 * A Mallobj made from a source and a set of refinements
 */
export class RefinedExplore extends Mallobj {
  elementType = "refinedExplore";

  constructor(readonly source: Mallobj, readonly refinement: ExploreDesc) {
    super({ source, refinement });
  }

  structDef(): model.StructDef {
    return this.withParameters([]);
  }

  withParameters(pList: HasParameter[] | undefined): model.StructDef {
    let primaryKey: PrimaryKey | undefined;
    let fieldListEdit: FieldListEdit | undefined;
    const fields: ExploreField[] = [];
    const filters: Filter[] = [];

    for (const el of this.refinement.list) {
      const errTo = el;
      if (el instanceof PrimaryKey) {
        if (primaryKey) {
          primaryKey.log("Primary key already defined");
          el.log("Primary key redefined");
        }
        primaryKey = el;
      } else if (el instanceof FieldListEdit) {
        if (fieldListEdit) {
          fieldListEdit.log("Too many accept/except statements");
          el.log("Too many accept/except statements");
        }
        fieldListEdit = el;
      } else if (
        el instanceof DeclareFields ||
        el instanceof Joins ||
        el instanceof Turtles ||
        el instanceof Renames
      ) {
        fields.push(...el.list);
      } else if (el instanceof Filter) {
        filters.push(el);
      } else {
        errTo.log(`Unexpected explore property: '${errTo.elementType}'`);
      }
    }

    const from = cloneDeep(this.source.structDef());
    if (primaryKey) {
      from.primaryKey = primaryKey.field.name;
    }
    const fs = DynamicSpace.filteredFrom(from, fieldListEdit);
    fs.addField(...fields);
    if (pList) {
      fs.addParameters(pList);
    }
    if (primaryKey) {
      const keyDef = primaryKey.field.getField(fs);
      if (keyDef.error) {
        primaryKey.log(keyDef.error);
      }
    }
    const retStruct = fs.structDef();

    const filterList = retStruct.filterList || [];
    let moreFilters = false;
    for (const filter of filters) {
      for (const el of filter.list) {
        const fc = el.filterExpression(fs);
        if (fc.aggregate) {
          el.log("Can't use aggregate computations in top level filters");
        } else {
          filterList.push(fc);
          moreFilters = true;
        }
      }
    }
    if (moreFilters) {
      return { ...retStruct, filterList };
    }
    return retStruct;
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
        tableDefEntry.value.location = this.location;
        tableDefEntry.value.fields.forEach(
          (field) => (field.location = this.location)
        );
        return {
          ...tableDefEntry.value,
          fields: tableDefEntry.value.fields.map((field) => ({
            ...field,
            location: this.location,
          })),
          location: this.location,
        };
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

export class IsValueBlock extends MalloyElement {
  elementType = "isValueBlock";

  constructor(readonly isMap: Record<string, ConstantSubExpression>) {
    super();
    this.has(isMap);
  }
}

export class ModelEntryReference extends MalloyElement {
  elementType = "modelEntryReference";

  constructor(readonly name: string) {
    super();
  }

  get refString(): string {
    return this.name;
  }

  toString(): string {
    return this.refString;
  }
}

export class NamedSource extends Mallobj {
  elementType = "namedSource";
  protected isBlock?: IsValueBlock;

  constructor(
    readonly ref: ModelEntryReference | string,
    paramValues: Record<string, ConstantSubExpression> = {}
  ) {
    super();
    if (paramValues && Object.keys(paramValues).length > 0) {
      this.isBlock = new IsValueBlock(paramValues);
      this.has({ parameterValues: this.isBlock });
    }
    if (ref instanceof ModelEntryReference) {
      this.has({ ref });
    }
  }

  get refName(): string {
    return this.ref instanceof ModelEntryReference ? this.ref.name : this.ref;
  }

  structRef(): model.StructRef {
    if (this.isBlock) {
      return this.structDef();
    }
    return this.refName;
  }

  modelStruct(): model.StructDef | undefined {
    const modelEnt = this.modelEntry(this.ref)?.entry;
    if (!modelEnt) {
      const undefMsg = `Undefined source '${this.refName}'`;
      (this.ref instanceof ModelEntryReference ? this.ref : this).log(undefMsg);
      return;
    }
    if (modelEnt.type === "query") {
      this.log(`Must use 'from()' to explore query '${this.refName}`);
      return;
    } else if (modelEnt.type === "sqlBlock") {
      this.log(`Must use 'from_sql()' to explore sql query '${this.refName}`);
      return;
    }
    return { ...modelEnt };
  }

  structDef(): model.StructDef {
    /*
      Can't really generate the callback list until after all the
      things before me are translated, and that kinda screws up
      the translation process, so that might be a better place
      to start the next step, because how that gets done might
      make any code I write which ignores the translation problem
      kind of meaningless.

      Maybe the output of a tranlsation is something which describes
      all the missing data, and then there is a "link" step where you
      can do other translations and link them into a partial translation
      which might result in a full translation.
    */

    const ret = this.modelStruct();
    if (!ret) {
      return ErrorFactory.structDef;
    }
    const declared = { ...ret.parameters } || {};

    const makeWith = this.isBlock?.isMap || {};
    for (const [pName, pExpr] of Object.entries(makeWith)) {
      const decl = declared[pName];
      // const pVal = pExpr.constantValue();
      if (!decl) {
        this.log(`Value given for undeclared parameter '${pName}`);
      } else {
        if (model.isValueParameter(decl)) {
          if (decl.constant) {
            pExpr.log(`Cannot override constant parameter ${pName}`);
          } else {
            const pVal = pExpr.constantValue();
            let value: model.Expr | null = pVal.value;
            if (pVal.dataType !== decl.type) {
              if (decl.type === "timestamp" && pVal.dataType === "date") {
                // @mtoy-googly-moogly : I've stubbed for now as we don't do parameters yet
                //  not sure how to get to a dialect from here.
                // value = toTimestampV(getDialect(this.dialect), pVal).value;
              } else {
                pExpr.log(
                  `Type mismatch for parameter '${pName}', expected '${decl.type}'`
                );
                value = null;
              }
            }
            decl.value = value;
          }
        } else {
          // TODO type checking here -- except I am still not sure what
          // datatype half conditions have ..
          decl.condition = pExpr.constantCondition(decl.type).value;
        }
      }
    }
    for (const checkDef in ret.parameters) {
      if (!model.paramHasValue(declared[checkDef])) {
        this.log(`Value not provided for required parameter ${checkDef}`);
      }
    }
    return ret;
  }
}

export class SQLSource extends NamedSource {
  elementType = "sqlSource";
  structRef(): model.StructRef {
    return this.structDef();
  }
  modelStruct(): model.StructDef | undefined {
    const modelEnt = this.modelEntry(this.ref)?.entry;
    if (!modelEnt) {
      this.log(`Undefined from_sql source '${this.refName}'`);
      return;
    }
    if (modelEnt.type === "query") {
      this.log(`Cannot use 'from_sql()' to explore query '${this.refName}'`);
      return;
    } else if (modelEnt.type === "struct") {
      this.log(`Cannot use 'from_sql()' to explore '${this.refName}'`);
      return;
    }
    const sqlDefEntry = this.translator()?.root.sqlQueryZone;
    if (!sqlDefEntry) {
      this.log(`Cant't look up schema for sql block '${this.refName}'`);
      return;
    }
    if (modelEnt.type == "sqlBlock") {
      const key = modelEnt.name;
      const lookup = sqlDefEntry.getEntry(key);
      let msg = `Schema read failure for sql query '${this.refName}'`;
      if (lookup) {
        if (lookup.status == "present") {
          const structDef = lookup.value;
          return {
            ...structDef,
            fields: structDef.fields.map((field) => ({
              ...field,
              location: modelEnt.location,
            })),
          };
        }
        if (lookup.status == "error") {
          msg = lookup.message.includes(this.refName)
            ? `'Schema error: ${lookup.message}`
            : `Schema error '${this.refName}': ${lookup.message}`;
        }
        this.log(msg);
      }
    } else {
      this.log(`Mis-typed definition for'${this.refName}'`);
    }
  }
}

export class QuerySource extends Mallobj {
  elementType = "querySource";
  constructor(readonly query: QueryElement) {
    super({ query });
  }

  structDef(): model.StructDef {
    const comp = this.query.queryComp();
    const queryStruct = comp.outputStruct;
    queryStruct.structSource = { type: "query", query: comp.query };
    return queryStruct;
  }
}

export abstract class Join extends MalloyElement {
  abstract name: ModelEntryReference;
  abstract structDef(): model.StructDef;
  abstract fixupJoinOn(outer: FieldSpace, inStruct: model.StructDef): void;
}

export class KeyJoin extends Join {
  elementType = "joinOnKey";
  constructor(
    readonly name: ModelEntryReference,
    readonly source: Mallobj,
    readonly keyExpr: ExpressionDef
  ) {
    super({ name, source, keyExpr });
  }

  structDef(): model.StructDef {
    const sourceDef = this.source.structDef();
    const joinStruct: model.StructDef = {
      ...sourceDef,
      structRelationship: { type: "one", onExpression: ["1=0"] },
      location: this.location,
    };
    if (sourceDef.structSource.type === "query") {
      // the name from query does not need to be preserved
      joinStruct.name = this.name.refString;
    } else {
      joinStruct.as = this.name.refString;
    }

    return joinStruct;
  }

  fixupJoinOn(outer: FieldSpace, inStruct: model.StructDef): void {
    const exprX = this.keyExpr.getExpression(outer);
    if (inStruct.primaryKey) {
      const pkey = inStruct.fields.find(
        (f) => (f.as || f.name) === inStruct.primaryKey
      );
      if (pkey) {
        if (pkey.type === exprX.dataType) {
          inStruct.structRelationship = {
            type: "one",
            onExpression: [
              { type: "field", path: `${this.name}.${inStruct.primaryKey}` },
              "=",
              ...exprX.value,
            ],
          };
          return;
        } else {
          this.log(
            `join_one: with type mismatch with primary key: ${exprX.dataType}/${pkey.type}`
          );
        }
      } else {
        this.log(`join_one: with requires primary key`);
      }
    }
  }
}

type ExpressionJoinType = "many" | "one" | "cross";
export class ExpressionJoin extends Join {
  elementType = "joinOnExpr";
  joinType: ExpressionJoinType = "one";
  private expr?: ExpressionDef;
  constructor(readonly name: ModelEntryReference, readonly source: Mallobj) {
    super({ name, source });
  }

  set joinOn(joinExpr: ExpressionDef | undefined) {
    this.expr = joinExpr;
    this.has({ on: joinExpr });
  }

  get joinOn(): ExpressionDef | undefined {
    return this.expr;
  }

  fixupJoinOn(
    outer: FieldSpace,
    inStruct: model.StructDef
  ): model.Expr | undefined {
    if (this.expr == undefined) {
      return;
    }
    const exprX = this.expr.getExpression(outer);
    if (exprX.dataType !== "boolean") {
      this.log("join conditions must be boolean expressions");
      return;
    }
    const joinRel = inStruct.structRelationship;
    if (model.isJoinOn(joinRel)) {
      joinRel.onExpression = compressExpr(exprX.value);
    }
  }

  structDef(): model.StructDef {
    const sourceDef = this.source.structDef();
    const joinStruct: model.StructDef = {
      ...sourceDef,
      structRelationship: { type: this.joinType },
      location: this.location,
    };
    if (sourceDef.structSource.type === "query") {
      // the name from query does not need to be preserved
      joinStruct.name = this.name.refString;
    } else {
      joinStruct.as = this.name.refString;
    }
    return joinStruct;
  }
}

export class Joins extends ListOf<Join> {
  constructor(joins: Join[]) {
    super("joinList", joins);
  }
}

export type QueryProperty =
  | Ordering
  | Top
  | Limit
  | Filter
  | Index
  | Joins
  | DeclareFields
  | ProjectStatement
  | NestReference
  | NestDefinition
  | NestReference
  | Nests
  | Aggregate
  | GroupBy;
export function isQueryProperty(q: MalloyElement): q is QueryProperty {
  return (
    q instanceof Ordering ||
    q instanceof Top ||
    q instanceof Limit ||
    q instanceof Filter ||
    q instanceof Index ||
    q instanceof Joins ||
    q instanceof DeclareFields ||
    q instanceof ProjectStatement ||
    q instanceof Aggregate ||
    q instanceof Nests ||
    isNestedQuery(q) ||
    q instanceof GroupBy
  );
}

export type ExploreProperty =
  | Filter
  | Joins
  | DeclareFields
  | FieldListEdit
  | Renames
  | PrimaryKey
  | Turtles;
export function isExploreProperty(p: MalloyElement): p is ExploreProperty {
  return (
    p instanceof Filter ||
    p instanceof Joins ||
    p instanceof DeclareFields ||
    p instanceof FieldListEdit ||
    p instanceof Renames ||
    p instanceof PrimaryKey ||
    p instanceof Turtles
  );
}
export class ExploreDesc extends ListOf<ExploreProperty> {
  constructor(props: ExploreProperty[]) {
    super("exploreDesc", props);
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

export class Filter extends ListOf<FilterElement> {
  elementType = "filter";
  private havingClause?: boolean;
  constructor(elements: FilterElement[] = []) {
    super("filterElements", elements);
  }

  set having(isHaving: boolean) {
    this.elementType = isHaving ? "having" : "where";
  }

  getFilterList(fs: FieldSpace): model.FilterExpression[] {
    const checked: model.FilterExpression[] = [];
    for (const oneElement of this.list) {
      const fExpr = oneElement.filterExpression(fs);
      // Aggregates are ALSO checked at SQL generation time, but checking
      // here allows better reflection of errors back to user.
      if (this.havingClause !== undefined) {
        if (this.havingClause) {
          if (!fExpr.aggregate) {
            oneElement.log("Aggregate expression expected in HAVING filter");
            continue;
          }
        } else {
          if (fExpr.aggregate) {
            oneElement.log("Aggregate expression not allowed in WHERE");
            continue;
          }
        }
      }
      checked.push(fExpr);
    }
    return checked;
  }
}

export class DeclareFields extends ListOf<FieldDeclaration> {
  constructor(fields: FieldDeclaration[], fieldType = "declare") {
    super(fieldType, fields);
  }
}

export class Measures extends DeclareFields {
  constructor(measures: FieldDeclaration[]) {
    super(measures, "measure");
    for (const dim of measures) {
      dim.isMeasure = true;
    }
  }
}

export class Dimensions extends DeclareFields {
  constructor(dimensions: FieldDeclaration[]) {
    super(dimensions, "dimension");
    for (const dim of dimensions) {
      dim.isMeasure = false;
    }
  }
}

export class Renames extends ListOf<RenameField> {
  constructor(renames: RenameField[]) {
    super("renameField", renames);
  }
}

export class FieldName extends MalloyElement {
  elementType = "fieldName";

  constructor(readonly name: string) {
    super();
  }

  get refString(): string {
    return this.name;
  }

  toString(): string {
    return this.refString;
  }

  getField(inFs: FieldSpace): LookupResult {
    return inFs.lookup([this]);
  }
}

export class FieldReference extends ListOf<FieldName> {
  elementType = "fieldReference";

  constructor(names: FieldName[]) {
    super("fieldReference", names);
  }

  get refString(): string {
    return this.list.map((n) => n.refString).join(".");
  }

  get sourceString(): string | undefined {
    if (this.list.length > 1) {
      return this.list
        .slice(0, -1)
        .map((n) => n.refString)
        .join(".");
    }
    return undefined;
  }

  get nameString(): string {
    return this.list[this.list.length - 1].refString;
  }

  getField(inFs: FieldSpace): LookupResult {
    return inFs.lookup(this.list);
  }
}

export type FieldListReference = FieldReference | WildcardFieldReference;

export class FieldReferences extends ListOf<FieldListReference> {
  constructor(members: FieldListReference[]) {
    super("fieldReferenceList", members);
  }
}
export function isFieldListReference(
  me: MalloyElement
): me is FieldListReference {
  return me instanceof FieldReference || me instanceof WildcardFieldReference;
}

export type FieldCollectionMember = FieldListReference | FieldDeclaration;
export function isFieldCollectionMember(
  el: MalloyElement
): el is FieldCollectionMember {
  return (
    el instanceof FieldReference ||
    el instanceof WildcardFieldReference ||
    el instanceof FieldDeclaration
  );
}
export class ProjectStatement extends ListOf<FieldCollectionMember> {
  constructor(members: FieldCollectionMember[]) {
    super("fieldCollection", members);
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

export type QueryItem =
  | FieldDeclaration
  | FieldReference
  | NestDefinition
  | NestReference;

export class GroupBy extends ListOf<QueryItem> {
  constructor(members: QueryItem[]) {
    super("groupBy", members);
    for (const el of members) {
      if (el instanceof FieldDeclaration) {
        el.isMeasure = false;
      }
    }
  }
}

export class Aggregate extends ListOf<QueryItem> {
  constructor(members: QueryItem[]) {
    super("aggregate", members);
    for (const el of members) {
      if (el instanceof FieldDeclaration) {
        el.isMeasure = true;
      }
    }
  }
}

interface QueryExecutor {
  execute(qp: QueryProperty): void;
  finalize(refineFrom: model.PipeSegment | undefined): model.PipeSegment;
  queryFS: QueryOperationSpace;
}

class ReduceExecutor implements QueryExecutor {
  inputFS: FieldSpace;
  queryFS: QuerySpace;
  filters: model.FilterExpression[] = [];
  order?: Top | Ordering;
  limit?: number;
  refinedInputFS?: DynamicSpace;

  constructor(baseFS: FieldSpace, out?: QuerySpace) {
    this.inputFS = baseFS;
    this.queryFS = out || new ReduceFieldSpace(baseFS);
  }

  execute(qp: QueryProperty): void {
    if (
      qp instanceof GroupBy ||
      qp instanceof Aggregate ||
      qp instanceof Nests
    ) {
      this.queryFS.addQueryItems(...qp.list);
    } else if (isNestedQuery(qp)) {
      this.queryFS.addQueryItems(qp);
    } else if (qp instanceof Filter) {
      this.filters.push(...qp.getFilterList(this.inputFS));
    } else if (qp instanceof Top) {
      if (this.limit) {
        qp.log("Query operation already limited");
      } else {
        this.limit = qp.limit;
      }
      if (qp.by) {
        if (this.order) {
          qp.log("Query operation is already sorted");
        } else {
          this.order = qp;
        }
      }
    } else if (qp instanceof Limit) {
      if (this.limit) {
        qp.log("Query operation already limited");
      } else {
        this.limit = qp.limit;
      }
    } else if (qp instanceof Ordering) {
      if (this.order) {
        qp.log("Query operation already sorted");
      } else {
        this.order = qp;
      }
    } else if (qp instanceof Joins || qp instanceof DeclareFields) {
      for (const qel of qp.list) {
        this.queryFS.extendSource(qel);
      }
    }
  }

  refineFrom(
    from: model.PipeSegment | undefined,
    to: model.QuerySegment
  ): void {
    if (from && from.type !== "index") {
      if (!this.order) {
        if (from.orderBy) {
          to.orderBy = from.orderBy;
        } else if (from.by) {
          to.by = from.by;
        }
      }
      if (!this.limit && from.limit) {
        to.limit = from.limit;
      }
    }

    if (this.limit) {
      to.limit = this.limit;
    }

    if (this.order instanceof Top) {
      const topBy = this.order.getBy(this.queryFS);
      if (topBy) {
        to.by = topBy;
      }
    }
    if (this.order instanceof Ordering) {
      to.orderBy = this.order.getOrderBy(this.queryFS);
    }

    const oldFilters = from?.filterList || [];
    if (this.filters.length > 0 && !oldFilters) {
      to.filterList = this.filters;
    } else if (oldFilters) {
      to.filterList = [...oldFilters, ...this.filters];
    }
  }

  finalize(fromSeg: model.PipeSegment | undefined): model.PipeSegment {
    let from: model.ReduceSegment | undefined;
    if (fromSeg) {
      if (fromSeg.type == "reduce") {
        from = fromSeg;
      } else {
        this.queryFS.log(`Can't refine reduce with ${fromSeg.type}`);
        return ErrorFactory.reduceSegment;
      }
    }
    const reduceSegment = this.queryFS.getPipeSegment(from);
    this.refineFrom(from, reduceSegment);

    return reduceSegment;
  }
}

class ProjectExecutor extends ReduceExecutor {
  constructor(baseFS: FieldSpace) {
    super(baseFS, new ProjectFieldSpace(baseFS));
  }

  execute(qp: QueryProperty): void {
    if (qp instanceof ProjectStatement) {
      this.queryFS.addMembers(qp.list);
    } else if (
      (qp instanceof Filter && qp.elementType === "having") ||
      qp instanceof Measures ||
      qp instanceof GroupBy
    ) {
      qp.log("Illegal statement in a project query operation");
    } else {
      super.execute(qp);
    }
  }

  finalize(fromSeg: model.PipeSegment | undefined): model.PipeSegment {
    let from: model.ProjectSegment | undefined;
    if (fromSeg) {
      if (fromSeg.type == "project") {
        from = fromSeg;
      } else {
        this.queryFS.log(`Can't refine project with ${fromSeg.type}`);
        return ErrorFactory.projectSegment;
      }
    }
    const projectSegment = this.queryFS.getPipeSegment(from);
    this.refineFrom(from, projectSegment);

    return projectSegment;
  }
}

class IndexExecutor implements QueryExecutor {
  inputFS: FieldSpace;
  queryFS: IndexFieldSpace;
  filters: model.FilterExpression[] = [];
  limit?: Limit;
  indexOn?: FieldName;

  constructor(baseFS: FieldSpace) {
    this.inputFS = baseFS;
    this.queryFS = new IndexFieldSpace(baseFS);
  }

  execute(qp: QueryProperty): void {
    if (qp instanceof Filter) {
      this.filters.push(...qp.getFilterList(this.inputFS));
    } else if (qp instanceof Limit) {
      if (this.limit) {
        this.limit.log("Ignored, too many limit: statements");
      }
      this.limit = qp;
    } else if (qp instanceof Index) {
      this.queryFS.addMembers(qp.fields.list);
      if (qp.weightBy) {
        if (this.indexOn) {
          this.indexOn.log("Ignoring previous BY");
        }
        this.indexOn = qp.weightBy;
      }
    } else {
      qp.log("Not legal in an index query operation");
    }
  }

  finalize(from: model.PipeSegment | undefined): model.PipeSegment {
    if (from && from.type !== "index") {
      this.queryFS.log(`Can't refine index with ${from.type}`);
      return ErrorFactory.indexSegment;
    }

    const indexSegment = this.queryFS.getPipeSegment(from);

    const oldFilters = from?.filterList || [];
    if (this.filters.length > 0 && !oldFilters) {
      indexSegment.filterList = this.filters;
    } else if (oldFilters) {
      indexSegment.filterList = [...oldFilters, ...this.filters];
    }

    if (from?.limit) {
      indexSegment.limit = from.limit;
    }
    if (this.limit) {
      indexSegment.limit = this.limit.limit;
    }

    if (this.indexOn) {
      indexSegment.weightMeasure = this.indexOn.refString;
    }

    return indexSegment;
  }
}

interface OpDesc {
  segment: model.PipeSegment;
  outputSpace: () => FieldSpace;
}
type QOPType = "grouping" | "aggregate" | "project" | "index";

export class QOPDesc extends ListOf<QueryProperty> {
  opType: QOPType = "grouping";
  private refineThis?: model.PipeSegment;
  constructor(props: QueryProperty[]) {
    super("queryOperator", props);
  }

  protected computeType(): QOPType {
    let firstGuess: QOPType | undefined;
    if (this.refineThis) {
      if (this.refineThis.type == "reduce") {
        firstGuess = "grouping";
      } else {
        firstGuess = this.refineThis.type;
      }
    }
    let anyGrouping = false;
    for (const el of this.list) {
      if (el instanceof Index) {
        firstGuess ||= "index";
        if (firstGuess !== "index") {
          el.log(`index: not legal in ${firstGuess} query`);
        }
      } else if (
        el instanceof Nests ||
        isNestedQuery(el) ||
        el instanceof GroupBy
      ) {
        firstGuess ||= "grouping";
        anyGrouping = true;
        if (firstGuess === "project" || firstGuess === "index") {
          el.log(`group_by: not legal in ${firstGuess} query`);
        }
      } else if (el instanceof Aggregate) {
        firstGuess ||= "aggregate";
        if (firstGuess === "project" || firstGuess === "index") {
          el.log(`aggregate: not legal in ${firstGuess} query`);
        }
      } else if (el instanceof ProjectStatement) {
        firstGuess ||= "project";
        if (firstGuess !== "project") {
          el.log(`project: not legal in ${firstGuess} query`);
        }
      }
    }
    if (firstGuess === "aggregate" && anyGrouping) {
      firstGuess = "grouping";
    }
    if (!firstGuess) {
      this.log(
        "Can't determine query type (group_by/aggregate/nest,project,index)"
      );
    }
    const guessType = firstGuess || "grouping";
    this.opType = guessType;
    return guessType;
  }

  refineFrom(existing: model.PipeSegment): void {
    this.refineThis = existing;
  }

  private getExecutor(baseFS: FieldSpace): QueryExecutor {
    switch (this.computeType()) {
      case "aggregate":
      case "grouping":
        return new ReduceExecutor(baseFS);
      case "project":
        return new ProjectExecutor(baseFS);
      case "index":
        return new IndexExecutor(baseFS);
    }
  }

  getOp(inputFS: FieldSpace): OpDesc {
    const qex = this.getExecutor(inputFS);
    qex.queryFS.astEl = this;
    for (const qp of this.list) {
      qex.execute(qp);
    }
    const segment = qex.finalize(this.refineThis);
    return {
      segment,
      outputSpace: () =>
        new DynamicSpace(opOutputStruct(this, inputFS.structDef(), segment)),
    };
  }
}

export interface ModelEntry {
  entry: model.NamedModelObject | model.SQLBlock;
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
  sqlBlocks: model.SQLBlock[] = [];
  constructor(readonly statements: DocStatement[]) {
    super({ statements });
  }

  getModelDef(extendingModelDef: model.ModelDef | undefined): model.ModelDef {
    this.documentModel = {};
    this.queryList = [];
    this.sqlBlocks = [];
    if (extendingModelDef) {
      for (const inName in extendingModelDef.contents) {
        const struct = extendingModelDef.contents[inName];
        if (struct.type == "struct") {
          const exported = extendingModelDef.exports.includes(inName);
          this.setEntry(inName, { entry: struct, exported });
        }
      }
    }
    for (const stmt of this.statements) {
      stmt.execute(this);
    }
    const def: model.ModelDef = { name: "", exports: [], contents: {} };
    for (const entry in this.documentModel) {
      const entryDef = this.documentModel[entry].entry;
      if (entryDef.type === "struct" || entryDef.type === "query") {
        if (this.documentModel[entry].exported) {
          def.exports.push(entry);
        }
        def.contents[entry] = cloneDeep(entryDef);
      }
    }
    return def;
  }

  defineSQL(sql: model.SQLBlock, name?: string): boolean {
    const ret = { ...sql, as: `$${this.sqlBlocks.length}` };
    if (name) {
      if (this.getEntry(name)) {
        return false;
      }
      ret.as = name;
      this.setEntry(name, { entry: ret });
    }
    this.sqlBlocks.push(ret);
    return true;
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
  constructor(readonly newName: string, readonly oldName: FieldName) {
    super();
    this.has({ oldName });
  }
}

export class WildcardFieldReference extends MalloyElement {
  elementType = "wildcardFieldReference";
  constructor(
    readonly joinPath: FieldReference | undefined,
    readonly star: "*" | "**"
  ) {
    super();
    this.has({ joinPath });
  }

  getFieldDef(): model.FieldDef {
    throw this.internalError("fielddef request from wildcard reference");
  }

  get refString(): string {
    return this.joinPath
      ? `${this.joinPath.refString}.${this.star}`
      : this.star;
  }
}

export class OrderBy extends MalloyElement {
  elementType = "orderBy";
  constructor(
    readonly field: number | FieldName,
    readonly dir?: "asc" | "desc"
  ) {
    super();
    if (field instanceof FieldName) {
      this.has({ field });
    }
  }

  get modelField(): string | number {
    return typeof this.field === "number" ? this.field : this.field.refString;
  }

  getOrderBy(_fs: FieldSpace): model.OrderBy {
    // TODO jump-to-definition `fs` cannot currently `lookup` fields in the output space
    // if (this.field instanceof FieldName) {
    //   const entry = this.field.getField(_fs);
    //   if (entry.error) {
    //     this.field.log(entry.error);
    //   }
    // }
    const orderElement: model.OrderBy = { field: this.modelField };
    if (this.dir) {
      orderElement.dir = this.dir;
    }
    return orderElement;
  }
}

export class Ordering extends ListOf<OrderBy> {
  constructor(list: OrderBy[]) {
    super("ordering", list);
  }

  getOrderBy(fs: FieldSpace): model.OrderBy[] {
    return this.list.map((el) => el.getOrderBy(fs));
  }
}

export class Limit extends MalloyElement {
  elementType = "limit";
  constructor(readonly limit: number) {
    super();
  }
}

export class Turtles extends ListOf<TurtleDecl> {
  constructor(turtles: TurtleDecl[]) {
    super("turtleDeclarationList", turtles);
  }
}

export class Index extends MalloyElement {
  elementType = "index";
  weightBy?: FieldName;
  constructor(readonly fields: FieldReferences) {
    super({ fields });
  }

  useWeight(fn: FieldName): void {
    this.has({ weightBy: fn });
    this.weightBy = fn;
  }
}

interface QueryComp {
  outputStruct: model.StructDef;
  query: model.Query;
}

function isTurtle(fd: model.QueryFieldDef | undefined): fd is model.TurtleDef {
  const ret =
    fd && typeof fd !== "string" && (fd as model.TurtleDef).type === "turtle";
  return !!ret;
}

/**
 * Generic abstract for all pipelines, the first segment might be a reference
 * to an existing pipeline (query or turtle), and if there is a refinement it
 * is refers to the first segment of the composed pipeline.
 */
abstract class PipelineDesc extends MalloyElement {
  elementType = "pipelineDesc";
  protected headRefinement?: QOPDesc;
  protected qops: QOPDesc[] = [];

  refineHead(refinement: QOPDesc): void {
    this.headRefinement = refinement;
    this.has({ headRefinement: refinement });
  }

  addSegments(...segDesc: QOPDesc[]): void {
    this.qops.push(...segDesc);
    this.has({ segments: this.qops });
  }

  protected appendOps(
    modelPipe: model.PipeSegment[],
    existingEndSpace: FieldSpace
  ): model.StructDef {
    let nextFS = existingEndSpace;
    for (const qop of this.qops) {
      const next = qop.getOp(nextFS);
      modelPipe.push(next.segment);
      nextFS = next.outputSpace();
    }
    return nextFS.structDef();
  }

  protected refinePipeline(
    fs: FieldSpace,
    modelPipe: model.Pipeline
  ): model.Pipeline {
    if (!this.headRefinement) {
      return modelPipe;
    }
    const pipeline: model.PipeSegment[] = [];
    if (modelPipe.pipeHead) {
      const { pipeline: turtlePipe } = this.importTurtle(
        modelPipe.pipeHead.name,
        fs.structDef()
      );
      pipeline.push(...turtlePipe);
    }
    pipeline.push(...modelPipe.pipeline);
    const firstSeg = pipeline[0];
    if (firstSeg) {
      this.headRefinement.refineFrom(firstSeg);
    }
    pipeline[0] = this.headRefinement.getOp(fs).segment;
    return { pipeline };
  }

  protected importTurtle(
    turtleName: string,
    fromStruct: model.StructDef
  ): {
    pipeline: model.PipeSegment[];
    location: model.DocumentLocation | undefined;
  } {
    const turtle = getStructFieldDef(fromStruct, turtleName);
    if (!turtle) {
      this.log(`Reference to undefined explore query '${turtleName}'`);
    } else if (turtle.type !== "turtle") {
      this.log(`'${turtleName}' is not a query`);
    } else {
      return { pipeline: turtle.pipeline, location: turtle.location };
    }
    return { pipeline: [], location: undefined };
  }

  protected getOutputStruct(
    walkStruct: model.StructDef,
    pipeline: model.PipeSegment[]
  ): model.StructDef {
    for (const modelQop of pipeline) {
      walkStruct = opOutputStruct(this, walkStruct, modelQop);
    }
    return walkStruct;
  }
}

export class ExistingQuery extends PipelineDesc {
  _head?: ModelEntryReference;

  set head(head: ModelEntryReference | undefined) {
    this._head = head;
    this.has({ head });
  }

  get head(): ModelEntryReference | undefined {
    return this._head;
  }

  queryComp(): QueryComp {
    if (!this.head) {
      throw this.internalError("can't make query from nameless query");
    }
    const queryEntry = this.modelEntry(this.head);
    const seedQuery = queryEntry?.entry;
    const oops = function () {
      return {
        outputStruct: ErrorFactory.structDef,
        query: ErrorFactory.query,
      };
    };
    if (!seedQuery) {
      this.log(`Reference to undefined query '${this.head}'`);
      return oops();
    }
    if (seedQuery.type !== "query") {
      this.log(`Illegal reference to '${this.head}', query expected`);
      return oops();
    }
    const queryHead = new QueryHeadStruct(seedQuery.structRef);
    this.has({ queryHead });
    const exploreStruct = queryHead.structDef();
    const exploreFS = new DynamicSpace(exploreStruct);
    const resultPipe = this.refinePipeline(exploreFS, seedQuery);
    const walkStruct = this.getOutputStruct(exploreStruct, resultPipe.pipeline);
    const outputStruct = this.appendOps(
      resultPipe.pipeline,
      new DynamicSpace(walkStruct)
    );
    const query: model.Query = {
      ...resultPipe,
      type: "query",
      structRef: queryHead.structRef(),
      location: this.location,
    };
    return { outputStruct, query };
  }

  query(): model.Query {
    return this.queryComp().query;
  }
}

export abstract class TurtleHeadedPipe extends PipelineDesc {
  _turtleName?: FieldName;

  set turtleName(turtleName: FieldName | undefined) {
    this._turtleName = turtleName;
    this.has({ turtleName });
  }

  get turtleName(): FieldName | undefined {
    return this._turtleName;
  }
}

export class FullQuery extends TurtleHeadedPipe {
  constructor(readonly explore: Mallobj) {
    super({ explore });
  }

  queryComp(): QueryComp {
    const structRef = this.explore.structRef();
    const destQuery: model.Query = {
      type: "query",
      structRef,
      pipeline: [],
      location: this.location,
    };
    const structDef = model.refIsStructDef(structRef)
      ? structRef
      : this.explore.structDef();
    let pipeFs = new DynamicSpace(structDef);

    if (this.turtleName) {
      const { error } = this.turtleName.getField(pipeFs);
      if (error) this.log(error);
      const name = this.turtleName.refString;
      const { pipeline, location } = this.importTurtle(name, structDef);
      destQuery.location = location;
      const refined = this.refinePipeline(pipeFs, { pipeline }).pipeline;
      if (this.headRefinement) {
        // TODO there is an issue with losing the name of the turtle
        // which we need to fix, possibly adding a "name:" field to a segment
        // TODO there was mention of promoting filters to the query
        destQuery.pipeline = refined;
      } else {
        destQuery.pipeHead = { name };
      }
      const pipeStruct = this.getOutputStruct(structDef, refined);
      pipeFs = new DynamicSpace(pipeStruct);
    }
    const outputStruct = this.appendOps(destQuery.pipeline, pipeFs);
    return { outputStruct, query: destQuery };
  }

  query(): model.Query {
    return this.queryComp().query;
  }
}

export class TurtleDecl extends TurtleHeadedPipe {
  constructor(readonly name: string) {
    super();
  }

  getPipeline(exploreFS: FieldSpace): model.Pipeline {
    const modelPipe: model.Pipeline = { pipeline: [] };
    if (this.turtleName) {
      const headEnt = this.turtleName.getField(exploreFS);
      let reportWrongType = true;
      if (headEnt.error) {
        this.log(headEnt.error);
        reportWrongType = false;
      } else if (headEnt.found instanceof QueryField) {
        const headDef = headEnt.found.getQueryFieldDef(exploreFS);
        if (isTurtle(headDef)) {
          const newPipe = this.refinePipeline(exploreFS, headDef);
          modelPipe.pipeline = [...newPipe.pipeline];
          reportWrongType = false;
        }
      }
      if (reportWrongType) {
        this.log(`Expected '${this.turtleName}' to be as query`);
      }
    } else if (this.headRefinement) {
      throw this.internalError(
        "Can't refine the head of a turtle in its definition"
      );
    }

    let appendInput = exploreFS;
    if (modelPipe.pipeline.length > 0) {
      let endStruct = appendInput.structDef();
      for (const existingSeg of modelPipe.pipeline) {
        endStruct = opOutputStruct(this, endStruct, existingSeg);
      }
      appendInput = new DynamicSpace(endStruct);
    }
    this.appendOps(modelPipe.pipeline, appendInput);
    return modelPipe;
  }

  getFieldDef(inputFS: FieldSpace): model.TurtleDef {
    const pipe = this.getPipeline(inputFS);
    return {
      type: "turtle",
      name: this.name,
      ...pipe,
      location: this.location,
    };
  }
}

export class NestReference extends FieldReference {
  elementType = "nestReference";
  constructor(readonly name: FieldName) {
    super([name]);
  }
}

export class NestRefinement extends TurtleDecl {
  elementType = "nestRefinement";
  constructor(turtleName: FieldName) {
    super(turtleName.refString);
    this.turtleName = turtleName;
  }
}

export class NestDefinition extends TurtleDecl {
  elementType = "nestDefinition";
  constructor(name: string) {
    super(name);
  }
}

export type NestedQuery = NestReference | NestDefinition | NestRefinement;
export function isNestedQuery(me: MalloyElement): me is NestedQuery {
  return (
    me instanceof NestRefinement ||
    me instanceof NestReference ||
    me instanceof NestDefinition
  );
}

export class Nests extends ListOf<NestedQuery> {
  constructor(nests: NestedQuery[]) {
    super("nestedQueries", nests);
  }
}

export type QueryElement = FullQuery | ExistingQuery;
export function isQueryElement(e: MalloyElement): e is QueryElement {
  return e instanceof FullQuery || e instanceof ExistingQuery;
}

export class DefineQueryList
  extends ListOf<DefineQuery>
  implements DocStatement
{
  constructor(queryList: DefineQuery[]) {
    super("defineQueries", queryList);
    this.has({ queryList });
  }

  execute(doc: Document): void {
    for (const dq of this.list) {
      dq.execute(doc);
    }
  }
}

export class DefineQuery extends MalloyElement implements DocStatement {
  elementType = "defineQuery";

  constructor(readonly name: string, readonly queryDetails: QueryElement) {
    super({ queryDetails });
  }

  execute(doc: Document): void {
    const entry: model.NamedQuery = {
      ...this.queryDetails.query(),
      type: "query",
      name: this.name,
      location: this.location,
    };
    const exported = false;
    doc.setEntry(this.name, { entry, exported });
  }
}

export class AnonymousQuery extends MalloyElement implements DocStatement {
  elementType = "anonymousQuery";
  constructor(readonly theQuery: QueryElement) {
    super();
    this.has({ query: theQuery });
  }

  execute(doc: Document): void {
    const modelQuery = this.theQuery.query();
    doc.queryList.push(modelQuery);
  }
}

type TopInit = FieldName | ExpressionDef;

export class Top extends MalloyElement {
  elementType = "top";
  constructor(readonly limit: number, readonly by?: TopInit) {
    super();
    this.has({ by });
  }

  getBy(fs: FieldSpace): model.By | undefined {
    if (this.by) {
      if (this.by instanceof FieldName) {
        // TODO jump-to-definition `fs` cannot currently `lookup` fields in the output space
        // const entry = this.by.getField(fs);
        // if (entry.error) {
        //   this.by.log(entry.error);
        // }
        return { by: "name", name: this.by.refString };
      } else {
        const byExpr = this.by.getExpression(fs);
        if (!byExpr.aggregate) {
          this.log("top by expression must be an aggregate");
        }
        return { by: "expression", e: compressExpr(byExpr.value) };
      }
    }
    return undefined;
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
      this.log("JSON syntax error");
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

export class ImportStatement extends MalloyElement implements DocStatement {
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
            entry: importStructs[importing],
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

interface HasInit {
  name: string;
  isCondition: boolean;
  type?: string;
  default?: ConstantSubExpression;
}

export class HasParameter extends MalloyElement {
  elementType = "hasParameter";
  readonly name: string;
  readonly isCondition: boolean;
  readonly type?: model.AtomicFieldType;
  readonly default?: ConstantSubExpression;

  constructor(init: HasInit) {
    super();
    this.name = init.name;
    this.isCondition = init.isCondition;
    if (init.type && model.isAtomicFieldType(init.type)) {
      this.type = init.type;
    }
    if (init.default) {
      this.default = init.default;
      this.has({ default: this.default });
    }
  }

  parameter(): model.Parameter {
    const name = this.name;
    const type = this.type || "string";
    if (this.isCondition) {
      const cCond = this.default?.constantCondition(type).value || null;
      return {
        type,
        name,
        condition: cCond,
      };
    }
    const cVal = this.default?.constantValue().value || null;
    return {
      value: cVal,
      type,
      name: this.name,
      constant: false,
    };
  }
}

export class ConstantParameter extends HasParameter {
  constructor(name: string, readonly value: ConstantSubExpression) {
    super({ name, isCondition: false });
    this.has({ value });
  }

  parameter(): model.Parameter {
    const cVal = this.value.constantValue();
    if (!model.isAtomicFieldType(cVal.dataType)) {
      this.log(`Unexpected expression type '${cVal.dataType}'`);
      return {
        value: ["XXX-type-mismatch-error-XXX"],
        type: "string",
        name: this.name,
        constant: true,
      };
    }
    return {
      value: cVal.value,
      type: cVal.dataType,
      name: this.name,
      constant: true,
    };
  }
}

export class SQLStatement extends MalloyElement implements DocStatement {
  elementType = "sqlStatement";
  is?: string;
  constructor(readonly blockReq: SQLBlockRequest) {
    super();
  }

  sqlBlock(): model.SQLBlock {
    const sqlBlock = makeSQLBlock(this.blockReq);
    sqlBlock.location = this.location;
    return sqlBlock;
  }

  execute(doc: Document): void {
    if (!doc.defineSQL(this.sqlBlock(), this.is)) {
      this.log(`${this.is} already defined`);
    }
  }
}
