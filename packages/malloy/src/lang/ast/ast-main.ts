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
  StructSpace,
  ReduceFieldSpace,
  ProjectFieldSpace,
  NewFieldSpace,
  QueryFieldSpace,
  IndexFieldSpace,
} from "../field-space";
import { LogMessage, MessageLogger } from "../parse-log";
import { MalloyTranslation } from "../parse-malloy";
import {
  compressExpr,
  ConstantSubExpression,
  ExprFieldDecl,
  ExpressionDef,
} from "./index";
import { QueryField } from "../space-field";
import { makeSQLBlock, SQLBlockRequest } from "../../model/sql_block";

/*
 ** For times when there is a code generation error but your function needs
 ** to return some kind of object to type properly, the ErrorFactory is
 ** here to help you.
 */
class ErrorFactory {
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
  inputStruct: model.StructDef,
  opDesc: model.PipeSegment
): model.StructDef {
  if (inputStruct.name === "//undefined_error_structdef") {
    return ErrorFactory.structDef;
  }
  return ModelQuerySegment.nextStructDef(inputStruct, opDesc);
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

  get location(): model.DocumentLocation {
    if (this.codeLocation) {
      return this.codeLocation;
    }
    if (this.parent) {
      return this.parent.location;
    }
    this.log("Location not set during parse");
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

  private get sourceURL() {
    const trans = this.translator();
    return trans?.sourceURL || "(missing)";
  }

  log(logString: string): void {
    const trans = this.translator();
    const msg: LogMessage = {
      sourceURL: this.sourceURL,
      message: logString,
    };
    const loc = this.location;
    if (loc) {
      msg.begin = loc.range.start;
      msg.end = loc.range.end;
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

type FieldDecl = ExprFieldDecl | Join | TurtleDecl | Turtles;
function isFieldDecl(f: MalloyElement): f is FieldDecl {
  return (
    f instanceof ExprFieldDecl ||
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
      const struct = {
        ...this.mallobj.withParameters(this.parameters),
        as: this.name,
        location: this.location,
      };
      doc.setEntry(this.name, {
        entry: struct,
        exported: this.exported,
      });
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
        el instanceof Measures ||
        el instanceof Dimensions ||
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
    if (from.structRelationship.type === "basetable") {
      from.location = this.location;
    }
    if (primaryKey) {
      from.primaryKey = primaryKey.field.name;
    }
    const fs = NewFieldSpace.filteredFrom(from, fieldListEdit);
    fs.addField(...fields);
    if (pList) {
      fs.addParameters(pList);
    }
    if (primaryKey) {
      if (!fs.findEntry(primaryKey.field.name)) {
        primaryKey.log(`Undefined field '${primaryKey.field.name}'`);
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

/**
 * A Mallobj made from a source with no refinements
 */
export class RenamedExplore extends Mallobj {
  elementType = "renamedExplore";

  constructor(readonly source: Mallobj) {
    super({ source });
  }

  structDef(): model.StructDef {
    const structDef = cloneDeep(this.source.structDef());
    structDef.location = this.location;
    return structDef;
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
        tableDefEntry.value.fields.forEach(
          (field) => (field.location = this.location)
        );
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

export class IsValueBlock extends MalloyElement {
  elementType = "isValueBlock";

  constructor(readonly isMap: Record<string, ConstantSubExpression>) {
    super();
    this.has(isMap);
  }
}

export class NamedSource extends Mallobj {
  elementType = "namedSource";
  protected isBlock?: IsValueBlock;

  constructor(
    readonly name: string,
    paramValues: Record<string, ConstantSubExpression> = {}
  ) {
    super();
    if (paramValues && Object.keys(paramValues).length > 0) {
      this.isBlock = new IsValueBlock(paramValues);
      this.has({ parameterValues: this.isBlock });
    }
  }

  structRef(): model.StructRef {
    if (this.isBlock) {
      return this.structDef();
    }
    return this.name;
  }

  modelStruct(): model.StructDef | undefined {
    const modelEnt = this.modelEntry(this.name)?.entry;
    if (!modelEnt) {
      this.log(`Undefined data source '${this.name}'`);
      return;
    }
    if (modelEnt.type === "query") {
      this.log(`Must use 'from()' to explore query '${this.name}`);
      return;
    } else if (modelEnt.type === "sqlBlock") {
      this.log(`Must use 'from_sql()' to explore sql query '${this.name}`);
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
    const modelEnt = this.modelEntry(this.name)?.entry;
    if (!modelEnt) {
      this.log(`Undefined from_sql source '${this.name}'`);
      return;
    }
    if (modelEnt.type === "query") {
      this.log(`Cannot use 'from_sql()' to explore query '${this.name}'`);
      return;
    } else if (modelEnt.type === "struct") {
      this.log(`Cannot use 'from_sql()' to explore '${this.name}'`);
      return;
    }
    const sqlDefEntry = this.translator()?.root.sqlQueryZone;
    if (!sqlDefEntry) {
      this.log(`Cant't look up schema for sql block '${this.name}'`);
      return;
    }
    if (modelEnt.type == "sqlBlock") {
      const key = modelEnt.name;
      const lookup = sqlDefEntry.getEntry(key);
      let msg = `Schema read failure for sql query '${this.name}'`;
      if (lookup) {
        if (lookup.status == "present") {
          const structDef = lookup.value;
          structDef.fields.forEach((field) => (field.location = this.location));
          return structDef;
        }
        if (lookup.status == "error") {
          msg = lookup.message.includes(this.name)
            ? `'Schema error: ${lookup.message}`
            : `Schema error '${this.name}': ${lookup.message}`;
        }
        this.log(msg);
      }
    } else {
      this.log(`Mis-typed definition for'${this.name}'`);
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
  abstract name: string;
  abstract structDef(): model.StructDef;
  needsFixup(): boolean {
    return false;
  }
  fixupJoinOn(_outer: FieldSpace, _inStruct: model.StructDef): void {
    return;
  }
}

export class KeyJoin extends Join {
  elementType = "joinOnKey";
  constructor(
    readonly name: string,
    readonly source: Mallobj,
    readonly key: string
  ) {
    super({ source });
  }

  structDef(): model.StructDef {
    const sourceDef = this.source.structDef();
    const joinStruct: model.StructDef = {
      ...sourceDef,
      structRelationship: {
        type: "foreignKey",
        foreignKey: this.key,
      },
    };
    if (sourceDef.structSource.type === "query") {
      // the name from query does not need to be preserved
      joinStruct.name = this.name;
    } else {
      joinStruct.as = this.name;
    }

    return joinStruct;
  }
}

type ExpressionJoinType = "many" | "one" | "cross";
export class ExpressionJoin extends Join {
  elementType = "joinOnExpr";
  joinType: ExpressionJoinType = "one";
  private expr?: ExpressionDef;
  constructor(readonly name: string, readonly source: Mallobj) {
    super({ source });
  }

  needsFixup(): boolean {
    return this.expr != undefined;
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
    };
    if (sourceDef.structSource.type === "query") {
      // the name from query does not need to be preserved
      joinStruct.name = this.name;
    } else {
      joinStruct.as = this.name;
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
  | ProjectStatement
  | NestReference
  | NestDefinition
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
    q instanceof ProjectStatement ||
    q instanceof Aggregate ||
    q instanceof Nests ||
    q instanceof NestReference ||
    q instanceof NestDefinition ||
    q instanceof GroupBy
  );
}

export type ExploreProperty =
  | Filter
  | Joins
  | Measures
  | Dimensions
  | FieldListEdit
  | Renames
  | PrimaryKey
  | Turtles;
export function isExploreProperty(p: MalloyElement): p is ExploreProperty {
  return (
    p instanceof Filter ||
    p instanceof Joins ||
    p instanceof Measures ||
    p instanceof Dimensions ||
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

export class Measures extends ListOf<ExprFieldDecl> {
  constructor(measures: ExprFieldDecl[]) {
    super("measure", measures);
    for (const dim of measures) {
      dim.isMeasure = true;
    }
  }
}

export class Dimensions extends ListOf<ExprFieldDecl> {
  constructor(dimensions: ExprFieldDecl[]) {
    super("dimension", dimensions);
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

export class FieldName
  extends MalloyElement
  implements FieldReferenceInterface
{
  elementType = "field name";

  constructor(readonly name: string) {
    super();
  }

  get refString(): string {
    return this.name;
  }
}

interface FieldReferenceInterface {
  refString: string;
}
export type FieldReference = FieldName | Wildcard;

export class FieldReferences extends ListOf<FieldReference> {
  constructor(members: FieldReference[]) {
    super("fieldReferenceList", members);
  }
}
export function isFieldReference(me: MalloyElement): me is FieldReference {
  return me instanceof FieldName || me instanceof Wildcard;
}

export type FieldCollectionMember = FieldReference | ExprFieldDecl;
export function isFieldCollectionMember(
  el: MalloyElement
): el is FieldCollectionMember {
  return (
    el instanceof FieldName ||
    el instanceof Wildcard ||
    el instanceof ExprFieldDecl
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
  | ExprFieldDecl
  | FieldName
  | NestDefinition
  | NestReference;

export class GroupBy extends ListOf<QueryItem> {
  constructor(members: QueryItem[]) {
    super("groupBy", members);
    for (const el of members) {
      if (el instanceof ExprFieldDecl) {
        el.isMeasure = false;
      }
    }
  }
}

export class Aggregate extends ListOf<QueryItem> {
  constructor(members: QueryItem[]) {
    super("aggregate", members);
    for (const el of members) {
      if (el instanceof ExprFieldDecl) {
        el.isMeasure = true;
      }
    }
  }
}

function nameOf(qfd: model.QueryFieldDef): string {
  if (typeof qfd === "string") {
    return qfd;
  }
  return qfd.as || qfd.name;
}

function getRefinedFields(
  exisitingFields: model.QueryFieldDef[] | undefined,
  addingFields: model.QueryFieldDef[]
): model.QueryFieldDef[] {
  if (!exisitingFields) {
    return addingFields;
  }
  const newFields: model.QueryFieldDef[] = [];
  const newDefinition: Record<string, boolean> = {};
  for (const field of newFields) {
    const fieldName = nameOf(field);
    newDefinition[fieldName] = true;
  }
  for (const field of exisitingFields) {
    const fieldName = nameOf(field);
    if (!newDefinition[fieldName]) {
      newFields.push(field);
    }
  }
  newFields.push(...addingFields);
  return newFields;
}

interface QueryExecutor {
  execute(qp: QueryProperty): void;
  finalize(refineFrom: model.PipeSegment | undefined): model.PipeSegment;
  outputFS: QueryFieldSpace;
}

class ReduceExecutor implements QueryExecutor {
  inputFS: FieldSpace;
  outputFS: QueryFieldSpace;
  filters: model.FilterExpression[] = [];
  order?: Top | Ordering;
  limit?: number;

  constructor(baseFS: FieldSpace, out?: QueryFieldSpace) {
    this.inputFS = baseFS;
    this.outputFS = out || new ReduceFieldSpace(baseFS);
  }

  handle(qp: QueryProperty): boolean {
    if (
      qp instanceof GroupBy ||
      qp instanceof Aggregate ||
      qp instanceof Nests
    ) {
      this.outputFS.addQueryItems(...qp.list);
    } else if (isNestedQuery(qp)) {
      this.outputFS.addQueryItems(qp);
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
    } else {
      return false;
    }
    return true;
  }

  execute(qp: QueryProperty): void {
    if (!this.handle(qp)) {
      qp.log("Illegal statement in a group_by/aggregate query operation");
    }
  }

  refineFrom(from: model.QuerySegment | undefined, to: model.QuerySegment) {
    if (from) {
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
      const topBy = this.order.getBy(this.outputFS);
      if (topBy) {
        to.by = topBy;
      }
    }
    if (this.order instanceof Ordering) {
      to.orderBy = this.order.orderBy();
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
        this.outputFS.log(`Can't refine reduce with ${fromSeg.type}`);
        return ErrorFactory.reduceSegment;
      }
    }
    const reduceSegment: model.ReduceSegment = {
      type: "reduce",
      fields: getRefinedFields(from?.fields, this.outputFS.queryFieldDefs()),
    };

    this.refineFrom(from, reduceSegment);

    return reduceSegment;
  }
}

class ProjectExecutor extends ReduceExecutor {
  constructor(baseFS: FieldSpace) {
    super(baseFS, new ProjectFieldSpace(baseFS));
  }

  handle(qp: QueryProperty): boolean {
    if (qp instanceof ProjectStatement) {
      this.outputFS.addMembers(qp.list);
      return true;
    }
    if (
      qp instanceof NestDefinition ||
      qp instanceof NestReference ||
      qp instanceof Nests ||
      qp instanceof Aggregate ||
      qp instanceof GroupBy
    ) {
      return false;
    }
    return super.handle(qp);
  }

  execute(qp: QueryProperty): void {
    if (!this.handle(qp)) {
      qp.log("Illegal statement in a project query operation");
    }
  }

  finalize(fromSeg: model.PipeSegment | undefined): model.PipeSegment {
    let from: model.ProjectSegment | undefined;
    if (fromSeg) {
      if (fromSeg.type == "project") {
        from = fromSeg;
      } else {
        this.outputFS.log(`Can't refine project with ${fromSeg.type}`);
        return ErrorFactory.projectSegment;
      }
    }
    const projectSegment: model.ProjectSegment = {
      type: "project",
      fields: getRefinedFields(from?.fields, this.outputFS.queryFieldDefs()),
    };

    this.refineFrom(from, projectSegment);

    return projectSegment;
  }
}

class IndexExecutor implements QueryExecutor {
  inputFS: FieldSpace;
  outputFS: IndexFieldSpace;
  filters: model.FilterExpression[] = [];
  limit?: Limit;
  indexOn?: FieldName;

  constructor(baseFS: FieldSpace) {
    this.inputFS = baseFS;
    this.outputFS = new IndexFieldSpace(baseFS);
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
      this.outputFS.addMembers(qp.fields.list);
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
      this.outputFS.log(`Can't refine index with ${from.type}`);
      return ErrorFactory.indexSegment;
    }

    const indexSegment = this.outputFS.indexSegment(from?.fields);

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
    let anyGrouping = false;
    for (const el of this.list) {
      if (el instanceof Index) {
        firstGuess ||= "index";
        if (firstGuess !== "index") {
          el.log(`index: not legal in ${firstGuess} segment`);
        }
      } else if (el instanceof GroupBy) {
        firstGuess ||= "grouping";
        anyGrouping = true;
        if (firstGuess === "project" || firstGuess === "index") {
          el.log(`group_by: not legal in ${firstGuess}: segment`);
        }
      } else if (el instanceof Aggregate) {
        firstGuess ||= "aggregate";
        if (firstGuess === "project" || firstGuess === "index") {
          el.log(`aggregate: not legal in ${firstGuess}: segment`);
        }
      } else if (el instanceof ProjectStatement) {
        firstGuess ||= "project";
      }
    }
    if (firstGuess === "aggregate" && anyGrouping) {
      firstGuess = "grouping";
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
    qex.outputFS.astEl = this;
    for (const qp of this.list) {
      qex.execute(qp);
    }
    const segment = qex.finalize(this.refineThis);
    return {
      segment,
      outputSpace: () =>
        new StructSpace(opOutputStruct(inputFS.structDef(), segment)),
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
  constructor(readonly newName: string, readonly oldName: string) {
    super();
  }
}

export class Wildcard extends MalloyElement implements FieldReferenceInterface {
  elementType = "wildcard";
  constructor(readonly joinName: string, readonly star: "*" | "**") {
    super();
  }

  getFieldDef(): model.FieldDef {
    throw this.internalError("fielddef request from wildcard reference");
  }

  get refString(): string {
    return this.joinName !== "" ? `${this.joinName}.${this.star}` : this.star;
  }
}

export class OrderBy extends MalloyElement {
  elementType = "orderBy";
  constructor(readonly field: number | string, readonly dir?: "asc" | "desc") {
    super();
  }

  byElement(): model.OrderBy {
    const orderElement: model.OrderBy = { field: this.field };
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

  orderBy(): model.OrderBy[] {
    return this.list.map((el) => el.byElement());
  }
}

export class Limit extends MalloyElement {
  elementType = "limit";
  constructor(readonly limit: number) {
    super();
  }
}

export class TurtleDecl extends MalloyElement {
  elementType = "turtleDesc";
  constructor(readonly name: string, readonly pipe: PipelineDesc) {
    super();
    this.has({ pipe });
  }

  getFieldDef(inputFS: FieldSpace): model.TurtleDef {
    const pipe = this.pipe.getPipelineForExplore(inputFS);
    return {
      type: "turtle",
      name: this.name,
      ...pipe,
      location: this.location,
    };
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
 *
 * I expect three subclasses for this. A query starting at an explore,
 * a query starting at a query, and a turtle definition.
 *
 * I aslo expect to re-factor once I have implemented all three of the
 * above and know enough to recognize the common elements.
 */
export class PipelineDesc extends MalloyElement {
  elementType = "pipelineDesc";
  private headRefinement?: QOPDesc;
  headName?: string;
  private qops: QOPDesc[] = [];

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
    firstSpace: FieldSpace
  ): model.StructDef {
    let nextFS = firstSpace;
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
      const turtlePipe = this.importTurtle(
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
  ): model.PipeSegment[] {
    const turtle = getStructFieldDef(fromStruct, turtleName);
    if (!turtle) {
      this.log(`Reference to undefined explore query '${turtleName}'`);
    } else if (turtle.type !== "turtle") {
      this.log(`'${turtleName}' is not a query`);
    } else {
      return turtle.pipeline;
    }
    return [];
  }

  protected getOutputStruct(
    walkStruct: model.StructDef,
    pipeline: model.PipeSegment[]
  ): model.StructDef {
    for (const modelQop of pipeline) {
      walkStruct = opOutputStruct(walkStruct, modelQop);
    }
    return walkStruct;
  }

  getPipelineForExplore(exploreFS: FieldSpace): model.Pipeline {
    const modelPipe: model.Pipeline = { pipeline: [] };
    if (this.headName && this.headRefinement) {
      const headEnt = exploreFS.findEntry(this.headName);
      let reportWrongType = true;
      if (!headEnt) {
        this.log(`Reference to undefined query '${this.headName}'`);
        reportWrongType = false;
      } else if (headEnt instanceof QueryField) {
        const headDef = headEnt.queryFieldDef();
        if (isTurtle(headDef)) {
          const newPipe = this.refinePipeline(exploreFS, headDef);
          modelPipe.pipeline = [...newPipe.pipeline];
          reportWrongType = false;
        }
      }
      if (reportWrongType) {
        this.log(`Expected '${this.headName}' to be as query`);
      }
    } else if (this.headName) {
      throw this.internalError("Unrefined turtle with a named head");
    } else if (this.headRefinement) {
      throw this.internalError(
        "Can't refine the head of a turtle in its definition"
      );
    }

    this.appendOps(modelPipe.pipeline, exploreFS);
    return modelPipe;
  }

  queryFromQuery(): QueryComp {
    if (!this.headName) {
      throw this.internalError("can't make query from nameless query");
    }
    const queryEntry = this.modelEntry(this.headName);
    const seedQuery = queryEntry?.entry;
    const oops = function () {
      return {
        outputStruct: ErrorFactory.structDef,
        query: ErrorFactory.query,
      };
    };
    if (!seedQuery) {
      this.log(`Reference to undefined query '${this.headName}'`);
      return oops();
    }
    if (seedQuery.type !== "query") {
      this.log(`Illegal reference to '${this.headName}', query expected`);
      return oops();
    }
    const queryHead = new QueryHeadStruct(seedQuery.structRef);
    this.has({ queryHead });
    const exploreStruct = queryHead.structDef();
    const exploreFS = new StructSpace(exploreStruct);
    const resultPipe = this.refinePipeline(exploreFS, seedQuery);
    const walkStruct = this.getOutputStruct(exploreStruct, resultPipe.pipeline);
    const outputStruct = this.appendOps(
      resultPipe.pipeline,
      new StructSpace(walkStruct)
    );
    const query: model.Query = {
      ...resultPipe,
      type: "query",
      structRef: queryHead.structRef(),
      location: this.location,
    };
    return { outputStruct, query };
  }

  queryFromExplore(explore: Mallobj): QueryComp {
    const structRef = explore.structRef();
    const destQuery: model.Query = {
      type: "query",
      structRef,
      pipeline: [],
      location: this.location,
    };
    const structDef = model.refIsStructDef(structRef)
      ? structRef
      : explore.structDef();
    let pipeFs = new StructSpace(structDef);

    if (this.headName) {
      const pipeline = this.importTurtle(this.headName, structDef);
      const refined = this.refinePipeline(pipeFs, { pipeline }).pipeline;
      if (this.headRefinement) {
        // TODO there is an issue with losing the name of the turtle
        // which we need to fix, possibly adding a "name:" field to a segment
        // TODO there was mention of promoting filters to the query
        destQuery.pipeline = refined;
      } else {
        destQuery.pipeHead = { name: this.headName };
      }
      const pipeStruct = this.getOutputStruct(structDef, refined);
      pipeFs = new StructSpace(pipeStruct);
    }
    const outputStruct = this.appendOps(destQuery.pipeline, pipeFs);
    return { outputStruct, query: destQuery };
  }
}

/**
 * A FullQuery is something which starts at an explorable, and then
 * may have a named-turtle first segment, which may have refinments,
 * and then it has a pipeline of zero or more qops after that.
 */
export class FullQuery extends MalloyElement {
  elementType = "fullQuery";

  constructor(readonly explore: Mallobj, readonly pipeline: PipelineDesc) {
    super({ explore, pipeline });
  }

  queryComp(): QueryComp {
    return this.pipeline.queryFromExplore(this.explore);
  }

  query(): model.Query {
    return this.queryComp().query;
  }
}

/**
 * An ExisitingQuery is a query definition which starts with an existing
 * named query, and then may have a refinement for the head of the query
 * and then may have a list of new qops to add.
 */
export class ExistingQuery extends MalloyElement {
  elementType = "queryFromQuery";
  constructor(readonly queryDesc: PipelineDesc) {
    super();
    this.has({ queryDesc });
  }

  queryComp(): QueryComp {
    return this.queryDesc.queryFromQuery();
  }

  query(): model.Query {
    return this.queryComp().query;
  }
}

export class NestReference extends MalloyElement {
  elementType = "nestReference";
  constructor(readonly name: string) {
    super();
  }
}

export class NestDefinition extends TurtleDecl {
  elementType = "nestDefinition";
  constructor(name: string, queryDesc: PipelineDesc) {
    super(name, queryDesc);
  }
}

export type NestedQuery = NestReference | NestDefinition;
export function isNestedQuery(me: MalloyElement): me is NestedQuery {
  return me instanceof NestReference || me instanceof NestDefinition;
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

interface TopByExpr {
  byExpr: ExpressionDef;
}
type TopInit = { byString: string } | TopByExpr;
function isByExpr(t: TopInit): t is TopByExpr {
  return (t as TopByExpr).byExpr !== undefined;
}

export class Top extends MalloyElement {
  elementType = "top";
  constructor(readonly limit: number, readonly by?: TopInit) {
    super();
    this.has({ byExpression: (by as TopByExpr)?.byExpr });
  }

  getBy(fs: FieldSpace): model.By | undefined {
    if (this.by) {
      if (isByExpr(this.by)) {
        const byExpr = this.by.byExpr.getExpression(fs);
        if (!byExpr.aggregate) {
          this.log("top by expression must be an aggregate");
        }
        return { by: "expression", e: compressExpr(byExpr.value) };
      }
      return { by: "name", name: this.by.byString };
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
