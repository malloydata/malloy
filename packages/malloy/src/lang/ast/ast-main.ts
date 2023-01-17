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
  ResultSpace,
} from "../field-space";
import { MessageLogger } from "../parse-log";
import { MalloyTranslation, ModelDataRequest } from "../parse-malloy";
import { compressExpr } from "./ast-types";
import {
  ConstantSubExpression,
  ExpressionDef,
  FieldDeclaration,
} from "./ast-expr";
import { QueryField } from "../space-field";
import { makeSQLBlock } from "../../model/sql_block";
import { inspect } from "util";
import { castTo } from "./time-utils";

/*
 ** For times when there is a code generation error but your function needs
 ** to return some kind of object to type properly, the ErrorFactory is
 ** here to help you.
 */

const theErrorStruct: model.StructDef = {
  type: "struct",
  name: "~malformed~",
  dialect: "~malformed~",
  structSource: { type: "table", tablePath: "//undefined_error_table_path" },
  structRelationship: {
    type: "basetable",
    connectionName: "//undefined_error_connection",
  },
  fields: [],
};

export class ErrorFactory {
  static get structDef(): model.StructDef {
    return { ...theErrorStruct };
  }

  static isErrorStructDef(s: model.StructDef): boolean {
    return s.name.includes(theErrorStruct.name);
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
  const badModel = ErrorFactory.isErrorStructDef(inputStruct);
  // Don't call into the model code with a broken model
  if (!badModel) {
    try {
      return ModelQuerySegment.nextStructDef(inputStruct, opDesc);
    } catch (e) {
      logTo.log(
        `INTERNAL ERROR model/Segment.nextStructDef: ${e.message}\n` +
          `QUERY: ${inspect(opDesc, { breakLength: 72, depth: Infinity })}`
      );
    }
  }
  return { ...ErrorFactory.structDef, dialect: inputStruct.dialect };
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
        if (model.isSQLBlock(result.entry)) {
          this.addReference({
            type: "sqlBlockReference",
            text: key,
            definition: result.entry,
            location: reference.location,
          });
        } else {
          this.addReference({
            type: "exploreReference",
            text: key,
            definition: result.entry,
            location: reference.location,
          });
        }
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
  protected elements: ET[];
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
  execute(doc: Document): ModelDataRequest;
}

export class RunList extends ListOf<DocStatement> {
  execCursor = 0;
  executeList(doc: Document): ModelDataRequest {
    while (this.execCursor < this.elements.length) {
      if (doc.errorsExist()) {
        // This stops cascading errors
        return;
      }
      const el = this.elements[this.execCursor];
      if (isDocStatement(el)) {
        const resp = el.execute(doc);
        if (resp) {
          return resp;
        }
        this.execCursor += 1;
      }
    }
    return undefined;
  }
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

  execute(doc: Document): ModelDataRequest {
    if (doc.modelEntry(this.name)) {
      this.log(`Cannot redefine '${this.name}'`);
    } else {
      const structDef = this.mallobj.withParameters(this.parameters);
      if (ErrorFactory.isErrorStructDef(structDef)) {
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

export class DefineSourceList extends RunList implements DocStatement {
  constructor(sourceList: DefineExplore[]) {
    super("defineSources", sourceList);
  }

  execute(doc: Document): ModelDataRequest {
    return this.executeList(doc);
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
        if (model.expressionIsCalculation(fc.expressionType)) {
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
        msg = tableDefEntry.message;
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
    const modelEnt = this.modelEntry(this.ref);
    if (modelEnt && !modelEnt.exported) {
      // If we are not exporting the referenced structdef, don't
      // use the reference
      return this.structDef();
    }
    return this.refName;
  }

  modelStruct(): model.StructDef | undefined {
    const modelEnt = this.modelEntry(this.ref);
    const entry = modelEnt?.entry;
    if (!entry) {
      const undefMsg = `Undefined source '${this.refName}'`;
      (this.ref instanceof ModelEntryReference ? this.ref : this).log(undefMsg);
      return;
    }
    if (entry.type === "query") {
      this.log(`Must use 'from()' for query source '${this.refName}`);
      return;
    } else if (modelEnt.sqlType) {
      this.log(`Must use 'from_sql()' for sql source '${this.refName}`);
      return;
    }
    return { ...entry };
  }

  structDef(): model.StructDef {
    /*
      Can't really generate the callback list until after all the
      things before me are translated, and that kinda screws up
      the translation process, so that might be a better place
      to start the next step, because how that gets done might
      make any code I write which ignores the translation problem
      kind of meaningless.

      Maybe the output of a translation is something which describes
      all the missing data, and then there is a "link" step where you
      can do other translations and link them into a partial translation
      which might result in a full translation.
    */

    const ret = this.modelStruct();
    if (!ret) {
      const notFound = ErrorFactory.structDef;
      const err = `${this.refName}-undefined`;
      notFound.name = notFound.name + err;
      notFound.dialect = notFound.dialect + err;
      return notFound;
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
            let value = pVal.value;
            if (pVal.dataType !== decl.type) {
              value = castTo(decl.type, pVal.value, true);
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
    const modelEnt = this.modelEntry(this.ref);
    const entry = modelEnt?.entry;
    if (!entry) {
      this.log(`Undefined from_sql source '${this.refName}'`);
      return;
    }
    if (entry.type === "query") {
      this.log(`Cannot use 'from_sql()' to explore query '${this.refName}'`);
      return;
    } else if (!modelEnt.sqlType) {
      this.log(`Cannot use 'from_sql()' to explore '${this.refName}'`);
      return;
    }
    return entry;
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
      structRelationship: {
        type: "one",
        onExpression: ["('join fixup'='not done yet')"],
      },
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
        this.log(`join_one: Primary key '${pkey}' not found in source`);
      }
    } else {
      this.log(`join_one: Cannot use with unless source has a primary key`);
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
      delete joinStruct.as;
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
  | SampleProperty
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
    q instanceof SampleProperty ||
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
        code: this.exprSrc,
        expression: ["_FILTER_MUST_RETURN_BOOLEAN_"],
        expressionType: "scalar",
      };
    }
    const exprCond: model.FilterExpression = {
      code: this.exprSrc,
      expression: compressExpr(exprVal.value),
      expressionType: exprVal.expressionType,
    };
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
          if (model.expressionIsCalculation(fExpr.expressionType)) {
            oneElement.log(
              "Aggregate or Analytical expression expected in HAVING filter"
            );
            continue;
          }
        } else {
          if (fExpr.expressionType !== "scalar") {
            oneElement.log(
              "Aggregate or Analytical expressions not allowed in WHERE"
            );
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

  getField(fs: FieldSpace): LookupResult {
    return fs.lookup([this]);
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

  get outputName(): string {
    const last = this.list[this.list.length - 1];
    return last.refString;
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

  getField(fs: FieldSpace): LookupResult {
    return fs.lookup(this.list);
  }
}

export type FieldReferenceElement = FieldReference | WildcardFieldReference;

export class FieldReferences extends ListOf<FieldReferenceElement> {
  constructor(members: FieldReferenceElement[]) {
    super("fieldReferenceList", members);
  }
}
export type FieldCollectionMember = FieldReferenceElement | FieldDeclaration;
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

interface Executor {
  inputFS: QuerySpace;
  resultFS: ResultSpace;
  execute(qp: QueryProperty): void;
  finalize(refineFrom: model.PipeSegment | undefined): model.PipeSegment;
}

class ReduceExecutor implements Executor {
  inputFS: QuerySpace;
  resultFS: ResultSpace;
  filters: model.FilterExpression[] = [];
  order?: Top | Ordering;
  limit?: number;
  refinedInputFS?: DynamicSpace;

  constructor(baseFS: FieldSpace) {
    this.resultFS = this.getResultSpace(baseFS);
    this.inputFS = this.resultFS.exprSpace;
  }

  getResultSpace(fs: FieldSpace): ResultSpace {
    return new ReduceFieldSpace(fs);
  }

  execute(qp: QueryProperty): void {
    if (
      qp instanceof GroupBy ||
      qp instanceof Aggregate ||
      qp instanceof Nests
    ) {
      this.resultFS.addQueryItems(...qp.list);
    } else if (isNestedQuery(qp)) {
      this.resultFS.addQueryItems(qp);
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
        this.inputFS.extendSource(qel);
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
      const topBy = this.order.getBy(this.inputFS);
      if (topBy) {
        to.by = topBy;
      }
    }
    if (this.order instanceof Ordering) {
      to.orderBy = this.order.getOrderBy(this.inputFS);
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
      if (model.isReduceSegment(fromSeg)) {
        from = fromSeg;
      } else {
        this.inputFS.result.log(`Can't refine reduce with ${fromSeg.type}`);
        return ErrorFactory.reduceSegment;
      }
    }
    const reduceSegment = this.resultFS.getQuerySegment(from);
    this.refineFrom(from, reduceSegment);

    return reduceSegment;
  }
}

class ProjectExecutor extends ReduceExecutor {
  getResultSpace(fs: FieldSpace): ProjectFieldSpace {
    return new ProjectFieldSpace(fs);
  }
  execute(qp: QueryProperty): void {
    if (qp instanceof ProjectStatement) {
      this.resultFS.addMembers(qp.list);
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
      if (model.isProjectSegment(fromSeg)) {
        from = fromSeg;
      } else {
        this.resultFS.log(`Can't refine project with ${fromSeg.type}`);
        return ErrorFactory.projectSegment;
      }
    }
    const projectSegment = this.resultFS.getQuerySegment(from);
    this.refineFrom(from, projectSegment);

    return projectSegment;
  }
}

class IndexExecutor implements Executor {
  filters: model.FilterExpression[] = [];
  limit?: Limit;
  indexOn?: FieldName;
  sample?: model.Sampling;
  resultFS: IndexFieldSpace;
  inputFS: QuerySpace;

  constructor(inputFS: FieldSpace) {
    this.resultFS = new IndexFieldSpace(inputFS);
    this.inputFS = this.resultFS.exprSpace;
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
      this.resultFS.addMembers(qp.fields.list);
      if (qp.weightBy) {
        if (this.indexOn) {
          this.indexOn.log("Ignoring previous BY");
        }
        this.indexOn = qp.weightBy;
      }
    } else if (qp instanceof SampleProperty) {
      this.sample = qp.sampling();
    } else {
      qp.log("Not legal in an index query operation");
    }
  }

  finalize(from: model.PipeSegment | undefined): model.PipeSegment {
    if (from && from.type !== "index") {
      this.resultFS.log(`Can't refine index with ${from.type}`);
      return ErrorFactory.indexSegment;
    }

    const indexSegment = this.resultFS.getPipeSegment(from);

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

    if (from?.sample) {
      indexSegment.sample = from.sample;
    }
    if (this.sample) {
      indexSegment.sample = this.sample;
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

  private getExecutor(baseFS: FieldSpace): Executor {
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

  getOp(inputFS: FieldSpace, forPipeline: PipelineDesc | null): OpDesc {
    const qex = this.getExecutor(inputFS);
    if (forPipeline?.nestedInQuerySpace) {
      qex.inputFS.nestParent = forPipeline.nestedInQuerySpace;
    }
    qex.resultFS.astEl = this;
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
  entry: model.NamedModelObject;
  exported?: boolean;
  sqlType?: boolean;
}
export interface NameSpace {
  getEntry(name: string): ModelEntry | undefined;
  setEntry(name: string, value: ModelEntry, exported: boolean): void;
}

interface DocumentCompileResult {
  modelDef: model.ModelDef;
  queryList: model.Query[];
  sqlBlocks: model.SQLBlockStructDef[];
  needs: ModelDataRequest;
}

/**
 * The Document class is a little weird because we might need to bounce back
 * to the requestor, which might be on the other side of a wire, to get
 * back some schema information. The intended translation of a Document
 * is to call initModelDef(), and then to call modelDataRequest() until it
 * returns undefined. At any time you can call modelDef to get the model
 * as it exists so far, but the translation is not complete until
 * modelDataRequest() returns undefined;
 *
 * TODO probably modelRequest should be the method and you call it
 * until it returns a model with no additional data needed ...
 * that can be tomorrow
 */
export class Document extends MalloyElement implements NameSpace {
  elementType = "document";
  documentModel: Record<string, ModelEntry> = {};
  queryList: model.Query[] = [];
  sqlBlocks: model.SQLBlockStructDef[] = [];
  statements: RunList;
  didInitModel = false;

  constructor(statements: DocStatement[]) {
    super();
    this.statements = new RunList("topLevelStatements", statements);
    this.has({ statements });
  }

  initModelDef(extendingModelDef: model.ModelDef | undefined): void {
    if (this.didInitModel) {
      return;
    }
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
    this.didInitModel = true;
  }

  compile(): DocumentCompileResult {
    const needs = this.statements.executeList(this);
    const ret: DocumentCompileResult = {
      modelDef: this.modelDef(),
      queryList: this.queryList,
      sqlBlocks: this.sqlBlocks,
      needs,
    };
    return ret;
  }

  modelDef(): model.ModelDef {
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

  defineSQL(sql: model.SQLBlockStructDef, name?: string): boolean {
    const ret = { ...sql, as: `$${this.sqlBlocks.length}` };
    if (name) {
      if (this.getEntry(name)) {
        return false;
      }
      ret.as = name;
      this.setEntry(name, { entry: ret, sqlType: true });
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
  nestedInQuerySpace?: QuerySpace;

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
  ) {
    let nextFS = existingEndSpace;
    let returnPipe: model.PipeSegment[] | undefined;
    for (const qop of this.qops) {
      const qopIsNested = modelPipe.length == 0;
      const next = qop.getOp(nextFS, qopIsNested ? this : null);
      if (returnPipe == undefined) {
        returnPipe = [...modelPipe];
      }
      returnPipe.push(next.segment);
      nextFS = next.outputSpace();
    }
    return {
      opList: returnPipe || modelPipe,
      structDef: nextFS.structDef(),
    };
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
      const { pipeline: turtlePipe } = this.expandTurtle(
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
    pipeline[0] = this.headRefinement.getOp(fs, this).segment;
    return { pipeline };
  }

  protected expandTurtle(
    turtleName: string,
    fromStruct: model.StructDef
  ): {
    pipeline: model.PipeSegment[];
    location: model.DocumentLocation | undefined;
  } {
    const turtle = getStructFieldDef(fromStruct, turtleName);
    if (!turtle) {
      this.log(`Query '${turtleName}' is not defined in source`);
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
    const sourcePipe = this.refinePipeline(exploreFS, seedQuery);
    const walkStruct = this.getOutputStruct(exploreStruct, sourcePipe.pipeline);
    const appended = this.appendOps(
      sourcePipe.pipeline,
      new DynamicSpace(walkStruct)
    );
    const destPipe = { ...sourcePipe, pipeline: appended.opList };
    const query: model.Query = {
      type: "query",
      ...destPipe,
      structRef: queryHead.structRef(),
      location: this.location,
    };
    return { outputStruct: appended.structDef, query };
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

    if (ErrorFactory.isErrorStructDef(structDef)) {
      return {
        outputStruct: structDef,
        query: {
          structRef: structRef,
          pipeline: [],
        },
      };
    }
    if (this.turtleName) {
      const { error } = this.turtleName.getField(pipeFs);
      if (error) this.log(error);
      const name = this.turtleName.refString;
      const { pipeline, location } = this.expandTurtle(name, structDef);
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
    const appended = this.appendOps(destQuery.pipeline, pipeFs);
    destQuery.pipeline = appended.opList;
    return { outputStruct: appended.structDef, query: destQuery };
  }

  query(): model.Query {
    return this.queryComp().query;
  }
}

export class TurtleDecl extends TurtleHeadedPipe {
  constructor(readonly name: string) {
    super();
  }

  getPipeline(fs: FieldSpace): model.Pipeline {
    const modelPipe: model.Pipeline = { pipeline: [] };
    if (this.turtleName) {
      const headEnt = this.turtleName.getField(fs);
      let reportWrongType = true;
      if (headEnt.error) {
        this.log(headEnt.error);
        reportWrongType = false;
      } else if (headEnt.found instanceof QueryField) {
        const headDef = headEnt.found.getQueryFieldDef(fs);
        if (isTurtle(headDef)) {
          const newPipe = this.refinePipeline(fs, headDef);
          modelPipe.pipeline = [...newPipe.pipeline];
          reportWrongType = false;
        }
      }
      if (reportWrongType) {
        this.log(`Expected '${this.turtleName}' to be a query`);
      }
    } else if (this.headRefinement) {
      throw this.internalError(
        "Can't refine the head of a turtle in its definition"
      );
    }

    let appendInput = fs;
    if (modelPipe.pipeline.length > 0) {
      let endStruct = appendInput.structDef();
      for (const existingSeg of modelPipe.pipeline) {
        endStruct = opOutputStruct(this, endStruct, existingSeg);
      }
      appendInput = new DynamicSpace(endStruct);
    }
    const appended = this.appendOps(modelPipe.pipeline, appendInput);
    modelPipe.pipeline = appended.opList;
    return modelPipe;
  }

  getFieldDef(
    fs: FieldSpace,
    nestParent: QuerySpace | undefined
  ): model.TurtleDef {
    if (nestParent) {
      this.nestedInQuerySpace = nestParent;
    }
    const pipe = this.getPipeline(fs);
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

export class DefineQueryList extends RunList implements DocStatement {
  constructor(queryList: DefineQuery[]) {
    super("defineQueries", queryList);
  }

  execute(doc: Document): ModelDataRequest {
    return this.executeList(doc);
  }
}

export class DefineQuery extends MalloyElement implements DocStatement {
  elementType = "defineQuery";

  constructor(readonly name: string, readonly queryDetails: QueryElement) {
    super({ queryDetails });
  }

  execute(doc: Document): ModelDataRequest {
    const entry: model.NamedQuery = {
      ...this.queryDetails.query(),
      type: "query",
      name: this.name,
      location: this.location,
    };
    const exported = false;
    doc.setEntry(this.name, { entry, exported });
    return undefined;
  }
}

export class AnonymousQuery extends MalloyElement implements DocStatement {
  elementType = "anonymousQuery";

  constructor(readonly theQuery: QueryElement) {
    super();
    this.has({ query: theQuery });
  }

  execute(doc: Document): ModelDataRequest {
    const modelQuery = this.theQuery.query();
    doc.queryList.push(modelQuery);
    return undefined;
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
        if (model.expressionIsAggregate(byExpr.expressionType)) {
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
      this.fullURL = decodeURI(new URL(url, baseURL).toString());
    } catch (e) {
      this.log("Invalid URI in import statement");
    }
  }

  execute(doc: Document): ModelDataRequest {
    const trans = this.translator();
    if (!trans) {
      this.log("Cannot import without translation context");
    } else if (this.fullURL) {
      const src = trans.root.importZone.getEntry(this.fullURL);
      if (src.status === "present") {
        const childNeeds = trans.childRequest(this.fullURL);
        if (childNeeds) {
          return childNeeds;
        }
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
    return undefined;
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

type SQLStringSegment = string | QueryElement;
export class SQLString extends MalloyElement {
  elementType = "sqlString";
  elements: SQLStringSegment[] = [];
  containsQueries = false;
  push(el: string | MalloyElement): void {
    if (typeof el == "string") {
      if (el.length > 0) {
        this.elements.push(el);
      }
    } else if (isQueryElement(el)) {
      this.elements.push(el);
      this.containsQueries = true;
      el.parent = this;
    } else {
      el.log("This element is not legal inside an SQL string");
    }
  }

  sqlPhrases(): model.SQLPhrase[] {
    return this.elements.map((el) => {
      if (typeof el == "string") {
        return { sql: el };
      }
      return el.query();
    });
  }
}

export class SQLStatement extends MalloyElement implements DocStatement {
  elementType = "sqlStatement";
  is?: string;
  connection?: string;
  requestBlock?: model.SQLBlockSource;

  constructor(readonly select: SQLString) {
    super();
    this.has({ select });
  }

  sqlBlock(): model.SQLBlockSource {
    if (!this.requestBlock) {
      this.requestBlock = makeSQLBlock(
        this.select.sqlPhrases(),
        this.connection
      );
    }
    return this.requestBlock;
  }

  /**
   * This is the one statement which pauses execution. First time through
   * it will generate a schema request, next time through it will either
   * record the error or record the schema.
   */
  execute(doc: Document): ModelDataRequest {
    const sqlDefEntry = this.translator()?.root.sqlQueryZone;
    if (!sqlDefEntry) {
      this.log("Cant't look up schema for sql block");
      return;
    }
    const sql = this.sqlBlock();
    sqlDefEntry.reference(sql.name, this.location);
    const lookup = sqlDefEntry.getEntry(sql.name);
    if (lookup.status == "error") {
      const msgLines = lookup.message.split(/\r?\n/);
      this.select.log("Invalid SQL, " + msgLines.join("\n    "));
      return undefined;
    }
    if (lookup.status == "present") {
      const location = this.select.location;
      const locStruct = {
        ...lookup.value,
        fields: lookup.value.fields.map((f) => ({ ...f, location })),
        location: this.location,
      };
      if (this.is && !doc.defineSQL(locStruct, this.is)) {
        this.log(`'${this.is}' already defined`);
      }
      return undefined;
    }
    return {
      compileSQL: sql,
      partialModel: this.select.containsQueries ? doc.modelDef() : undefined,
    };
  }
}

export class SampleProperty extends MalloyElement {
  elementType = "sampleProperty";
  constructor(readonly sample: model.Sampling) {
    super();
  }
  sampling(): model.Sampling {
    return this.sample;
  }
}
