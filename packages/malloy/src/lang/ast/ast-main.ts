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
import { Dialect } from "../../dialect/dialect";
import { getDialect } from "../../dialect/dialect_map";
import {
  AtomicFieldType,
  DivFragment,
  Expr,
  ExpressionType,
  FieldTypeDef,
  Fragment,
  isAtomicFieldType,
  isDateUnit,
  isTimeFieldType,
  maxExpressionType,
  mkExpr,
  StructDef,
  TimeFieldType,
  TimestampUnit,
} from "../../model/malloy_types";
import { Segment as ModelQuerySegment } from "../../model/malloy_query";
import {
  DocStatement,
  Document,
  ListOf,
  MalloyElement,
  ModelEntryReference,
  RunList,
} from "./malloy-element";
import { ModelDataRequest } from "../parse-malloy";
import {
  Comparison,
  Equality,
  ExprValue,
  FieldType,
  FieldValueType,
  FT,
  GranularResult,
} from "./ast-types";
import {
  compose,
  compressExpr,
  errorFor,
  isComparison,
  isEquality,
  isGranularResult,
} from "./ast-utils";
import { makeSQLBlock } from "../../model/sql_block";
import { inspect } from "util";
import {
  castTimestampToDate,
  castTo,
  timeOffset,
  timeResult,
} from "./time-utils";
import { nullsafeNot } from "./apply-expr";
import { mergeFields, nameOf } from "../field-utils";

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

/**
 * Root node for any element in an expression. These essentially
 * create a sub-tree in the larger AST. Expression nodes know
 * how to write themselves as SQL (or rather, generate the
 * template for SQL required by the query writer)
 */
export abstract class ExpressionDef extends MalloyElement {
  abstract elementType: string;
  granular(): boolean {
    return false;
  }

  /**
   * Returns the "translation" or template for SQL generation. When asking
   * for a tranlsation you may pass the types you can accept, allowing
   * the translation code a chance to convert to match your expectations
   * @param space Namespace for looking up field references
   */
  abstract getExpression(fs: FieldSpace): ExprValue;
  legalChildTypes = FT.anyAtomicT;

  /**
   * Some operators want to give the right hand value a chance to
   * rewrite itself. This requests a translation for a rewrite,
   * or returns undefined if that request should be denied.
   * @param fs FieldSpace
   * @returns Translated expression or undefined
   */
  requestExpression(fs: FieldSpace): ExprValue | undefined {
    return this.getExpression(fs);
  }

  defaultFieldName(): string | undefined {
    return undefined;
  }

  /**
   * Check an expression for type compatibility
   * @param _eNode currently unused, will be used to get error location
   * @param eVal ...list of expressions that must match legalChildTypes
   */
  typeCheck(eNode: ExpressionDef, eVal: ExprValue): boolean {
    if (!FT.in(eVal, this.legalChildTypes)) {
      eNode.log(`'${this.elementType}' Can't use type ${FT.inspect(eVal)}`);
      return false;
    }
    return true;
  }

  /**
   * This is the operation which makes partial comparison and value trees work
   * The default implemention merely constructs LEFT OP RIGHT, but specialized
   * nodes like alternation trees or or partial comparison can control how
   * the appplication gets generated
   * @param fs The symbol table
   * @param op The operator being applied
   * @param expr The "other" (besdies 'this') value
   * @returns The translated expression
   */
  apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
    return applyBinary(fs, left, op, this);
  }
}

export class ConstantSubExpression extends ExpressionDef {
  elementType = "constantExpression";
  private cfs?: ConstantFieldSpace;
  constructor(readonly expr: ExpressionDef) {
    super({ expr });
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.constantValue();
  }

  private get constantFs(): FieldSpace {
    if (!this.cfs) {
      this.cfs = new ConstantFieldSpace();
    }
    return this.cfs;
  }

  constantValue(): ExprValue {
    return this.expr.getExpression(this.constantFs);
  }

  constantCondition(type: AtomicFieldType): ExprValue {
    const compareAndContrast = new ExprCompare(
      new DollarReference(type),
      Comparison.EqualTo,
      this.expr
    );
    const application = compareAndContrast.getExpression(this.constantFs);
    return { ...application, value: compressExpr(application.value) };
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    return this.expr.apply(fs, op, expr);
  }

  requestExpression(fs: FieldSpace): ExprValue | undefined {
    return this.expr.requestExpression(fs);
  }
}

class DollarReference extends ExpressionDef {
  elementType = "$";
  constructor(readonly refType: FieldValueType) {
    super();
  }
  getExpression(_fs: FieldSpace): ExprValue {
    return {
      dataType: this.refType,
      value: [{ type: "applyVal" }],
      expressionType: "scalar",
    };
  }
}

class ConstantFieldSpace implements FieldSpace {
  readonly type = "fieldSpace";
  structDef(): StructDef {
    throw new Error("ConstantFieldSpace cannot generate a structDef");
  }
  emptyStructDef(): StructDef {
    throw new Error("ConstantFieldSpace cannot generate a structDef");
  }
  lookup(_name: unknown): LookupResult {
    return {
      error: "Only constants allowed in parameter expressions",
      found: undefined,
    };
  }
  dialectObj(): undefined {
    return undefined;
  }
  whenComplete(step: () => void): void {
    step();
  }
}

export class FieldDeclaration extends MalloyElement {
  elementType = "fieldDeclaration";
  isMeasure?: boolean;

  constructor(
    readonly expr: ExpressionDef,
    readonly defineName: string,
    readonly exprSrc?: string
  ) {
    super({ expr });
  }

  fieldDef(fs: FieldSpace, exprName: string): FieldTypeDef {
    /*
     * In an explore we cannot reference the thing we are defining, you need
     * to use rename. In a query, the output space is a new thing, and expressions
     * can reference the outer value in order to make a value with the new name,
     * and it feels wrong that this is HERE and not somehow in the QueryOperation.
     * For now, this stops the stack overflow, and passes all tests, but I think
     * a refactor of QueryFieldSpace might someday be the place where this should
     * happen.
     */
    return this.queryFieldDef(new DefSpace(fs, this), exprName);
  }

  queryFieldDef(exprFS: FieldSpace, exprName: string): FieldTypeDef {
    let exprValue;

    try {
      exprValue = this.expr.getExpression(exprFS);
    } catch (error) {
      this.log(`Cannot define '${exprName}', ${error.message}`);
      return {
        name: `error_defining_${exprName}`,
        type: "string",
      };
    }
    const compressValue = compressExpr(exprValue.value);
    const retType = exprValue.dataType;
    if (isAtomicFieldType(retType)) {
      const template: FieldTypeDef = {
        name: exprName,
        type: retType,
        location: this.location,
      };
      if (compressValue.length > 0) {
        template.e = compressValue;
      }
      if (exprValue.expressionType) {
        template.expressionType = exprValue.expressionType;
      }
      if (this.exprSrc) {
        template.code = this.exprSrc;
      }
      // TODO this should work for dates too
      if (isGranularResult(exprValue) && template.type === "timestamp") {
        template.timeframe = exprValue.timeframe;
      }
      return template;
    }
    const circularDef = exprFS instanceof DefSpace && exprFS.foundCircle;
    if (!circularDef) {
      if (exprValue.dataType == "unknown") {
        this.log(`Cannot define '${exprName}', value has unknown type`);
      } else {
        const badType = FT.inspect(exprValue);
        this.log(`Cannot define '${exprName}', unexpected type: ${badType}`);
      }
    }
    return {
      name: `error_defining_${exprName}`,
      type: "string",
    };
  }
}

/**
 * All of the magic of malloy expressions eventually flows to here,
 * where an operator is applied to two values. Depending on the
 * operator and value types this may involve transformations of
 * the values or even the operator.
 * @param fs FieldSpace for the symbols
 * @param left Left value
 * @param op The operator
 * @param right Right Value
 * @returns ExprValue of the expression
 */
export function applyBinary(
  fs: FieldSpace,
  left: ExpressionDef,
  op: string,
  right: ExpressionDef
): ExprValue {
  if (isEquality(op)) {
    return equality(fs, left, op, right);
  }
  if (isComparison(op)) {
    return compare(fs, left, op, right);
  }
  if (oneOf(op, "+", "-")) {
    return delta(fs, left, op, right);
  }
  if (oneOf(op, "*", "%")) {
    return numeric(fs, left, op, right);
  }
  if (oneOf(op, "/")) {
    const num = left.getExpression(fs);
    const denom = right.getExpression(fs);

    if (num.dataType != "number") {
      left.log("Numerator for division must be a number");
    } else if (denom.dataType != "number") {
      right.log("Denominator for division must be a number");
    } else {
      const div: DivFragment = {
        type: "dialect",
        function: "div",
        numerator: num.value,
        denominator: denom.value,
      };
      return {
        dataType: "number",
        expressionType: maxExpressionType(
          num.expressionType,
          denom.expressionType
        ),
        value: [div],
      };
    }
    return errorFor("divide type mismatch");
  }
  left.log(`Canot use ${op} operator here`);
  return errorFor("applybinary bad operator");
}

export abstract class BinaryBoolean<
  opType extends string
> extends ExpressionDef {
  elementType = "abstract boolean binary";
  legalChildTypes = [FT.boolT];
  constructor(
    readonly left: ExpressionDef,
    readonly op: opType,
    readonly right: ExpressionDef
  ) {
    super({ left, right });
  }

  getExpression(fs: FieldSpace): ExprValue {
    const left = this.left.getExpression(fs);
    const right = this.right.getExpression(fs);
    if (this.typeCheck(this.left, left) && this.typeCheck(this.right, right)) {
      return {
        dataType: "boolean",
        expressionType: maxExpressionType(
          left.expressionType,
          right.expressionType
        ),
        value: compose(left.value, this.op, right.value),
      };
    }
    return errorFor("logial required boolean");
  }
}

export class ExprCompare extends BinaryBoolean<Comparison> {
  elementType = "a<=>b";
  constructor(left: ExpressionDef, op: Comparison, right: ExpressionDef) {
    super(left, op, right);
    this.legalChildTypes = compareTypes[op];
  }

  getExpression(fs: FieldSpace): ExprValue {
    if (!this.right.granular()) {
      const rhs = this.right.requestExpression(fs);
      if (rhs && isGranularResult(rhs)) {
        const newRight = new ExprGranularTime(this.right, rhs.timeframe, false);
        return newRight.apply(fs, this.op, this.left);
      }
    }

    return this.right.apply(fs, this.op, this.left);
  }
}

function equality(
  fs: FieldSpace,
  left: ExpressionDef,
  op: Equality,
  right: ExpressionDef
): ExprValue {
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);
  let value = timeCompare(lhs, op, rhs) || compose(lhs.value, op, rhs.value);

  if (lhs.dataType != "unknown" && rhs.dataType != "unknown") {
    switch (op) {
      case "~":
      case "!~": {
        if (lhs.dataType === "string" && rhs.dataType === "string") {
          value = compose(lhs.value, "LIKE", rhs.value);
        } else {
          const regexCmp = regexEqual(lhs, rhs);
          if (regexCmp === undefined) {
            throw new TypeMistmatch(
              "Incompatible types for match('~') operator"
            );
          }
          value = regexCmp;
        }
        value = nullsafeNot(value, op);
        break;
      }
      case "=":
      case "!=": {
        const nullCmp = nullCompare(lhs, op, rhs);
        if (nullCmp) {
          value = nullCmp;
        } else {
          value = nullsafeNot(
            regexEqual(lhs, rhs) || compose(lhs.value, "=", rhs.value),
            op
          );
        }
        break;
      }
    }
  }

  return {
    dataType: "boolean",
    expressionType: maxExpressionType(lhs.expressionType, rhs.expressionType),
    value,
  };
}

function compare(
  fs: FieldSpace,
  left: ExpressionDef,
  op: string,
  right: ExpressionDef
): ExprValue {
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);
  const expressionType = maxExpressionType(
    lhs.expressionType,
    rhs.expressionType
  );
  const value = timeCompare(lhs, op, rhs) || compose(lhs.value, op, rhs.value);

  return {
    dataType: "boolean",
    expressionType,
    value: value,
  };
}

function oneOf(op: string, ...operators: string[]): boolean {
  return operators.includes(op);
}

function delta(
  fs: FieldSpace,
  left: ExpressionDef,
  op: string,
  right: ExpressionDef
): ExprValue {
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);

  if (isTimeFieldType(lhs.dataType)) {
    let duration: ExpressionDef = right;
    if (rhs.dataType !== "duration") {
      if (isGranularResult(lhs)) {
        duration = new ExprDuration(right, lhs.timeframe);
      } else if (lhs.dataType === "date") {
        duration = new ExprDuration(right, "day");
      } else {
        left.log(`Can not offset time by '${rhs.dataType}'`);
        return errorFor(`time plus ${rhs.dataType}`);
      }
    }
    return duration.apply(fs, op, left);
  }
  return numeric(fs, left, op, right);
}

function numeric(
  fs: FieldSpace,
  left: ExpressionDef,
  op: string,
  right: ExpressionDef
): ExprValue {
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);
  const expressionType = maxExpressionType(
    lhs.expressionType,
    rhs.expressionType
  );

  if (allAre("number", lhs, rhs)) {
    return {
      dataType: "number",
      expressionType,
      value: compose(lhs.value, op, rhs.value),
    };
  }

  left.log(`Non numeric('${lhs.dataType},${rhs.dataType}') value with '${op}'`);
  return errorFor("numbers required");
}

const compareTypes = {
  "~": [FT.stringT],
  "!~": [FT.stringT],
  "<": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
  "<=": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
  "=": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
  "!=": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
  ">=": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
  ">": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
};

/**
 * GranularTime is a moment in time which ALSO has a "granularity"
 * commonly this are created by applying ".datePart" to an expression
 * 1) They have a value, which is the moment in time
 * 2) When used in a comparison, they act like a range, for the
 *    duration of 1 unit of granularity
 */
export class ExprGranularTime extends ExpressionDef {
  elementType = "granularTime";
  legalChildTypes = [FT.timestampT, FT.dateT];
  constructor(
    readonly expr: ExpressionDef,
    readonly units: TimestampUnit,
    readonly truncate: boolean
  ) {
    super({ expr });
  }

  granular(): boolean {
    return true;
  }

  getExpression(fs: FieldSpace): ExprValue {
    const timeframe = this.units;
    const exprVal = this.expr.getExpression(fs);
    if (isTimeFieldType(exprVal.dataType)) {
      const tsVal: GranularResult = {
        ...exprVal,
        dataType: exprVal.dataType,
        timeframe: timeframe,
      };
      if (this.truncate) {
        tsVal.value = [
          {
            type: "dialect",
            function: "trunc",
            expr: { value: exprVal.value, valueType: exprVal.dataType },
            units: timeframe,
          },
        ];
      }
      return tsVal;
    }
    this.log(`Cannot do time truncation on type '${exprVal.dataType}'`);
    return errorFor(`granularity typecheck`);
  }

  apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
    const rangeType = this.getExpression(fs).dataType;
    const _valueType = left.getExpression(fs).dataType;
    const granularityType = isDateUnit(this.units) ? "date" : "timestamp";

    if (rangeType == "date" && granularityType == "date") {
      return this.dateRange(fs, op, left);
    }
    return this.timestampRange(fs, op, left);

    /*
      write tests for each of these cases ....

      vt  rt  gt  use
      dt  dt  dt  dateRange
      dt  dt  ts  == or timeStampRange
      dt  ts  dt  timestampRange
      dt  ts  ts  timeStampRange

      ts  ts  ts  timestampRange
      ts  ts  dt  timestampRange
      ts  dt  ts  timestampRange
      ts  dt  dt  either

    */
  }

  protected timestampRange(
    fs: FieldSpace,
    op: string,
    expr: ExpressionDef
  ): ExprValue {
    const begin = this.getExpression(fs);
    const beginTime = ExprTime.fromValue("timestamp", begin);
    const endTime = new ExprTime(
      "timestamp",
      timeOffset("timestamp", begin.value, "+", mkExpr`1`, this.units),
      begin.expressionType
    );
    const range = new Range(beginTime, endTime);
    return range.apply(fs, op, expr);
  }

  protected dateRange(
    fs: FieldSpace,
    op: string,
    expr: ExpressionDef
  ): ExprValue {
    const begin = this.getExpression(fs);
    const beginTime = new ExprTime("date", begin.value, begin.expressionType);
    const endAt = timeOffset("date", begin.value, "+", ["1"], this.units);
    const end = new ExprTime("date", endAt, begin.expressionType);
    const range = new Range(beginTime, end);
    return range.apply(fs, op, expr);
  }
}

function timeCompare(
  lhs: ExprValue,
  op: string,
  rhs: ExprValue
): Expr | undefined {
  if (isTimeFieldType(lhs.dataType) && isTimeFieldType(rhs.dataType)) {
    if (lhs.dataType !== rhs.dataType) {
      let lval = lhs.value;
      let rval = rhs.value;
      if (lhs.dataType === "timestamp") {
        lval = castTimestampToDate(lval);
      } else {
        rval = castTimestampToDate(rval);
      }
      return compose(lval, op, rval);
    }
  }
  return undefined;
}

function regexEqual(left: ExprValue, right: ExprValue): Expr | undefined {
  if (left.dataType === "string") {
    if (right.dataType === "regular expression") {
      return [
        {
          type: "dialect",
          function: "regexpMatch",
          expr: left.value,
          regexp: (right.value[0] as string).replace(/^r'/, "'"),
        },
      ];
    }
  } else if (right.dataType === "string") {
    if (left.dataType === "regular expression") {
      return [
        {
          type: "dialect",
          function: "regexpMatch",
          expr: right.value,
          regexp: (left.value[0] as string).replace(/^r'/, "'"),
        },
      ];
    }
  }
  return undefined;
}

export class TypeMistmatch extends Error {}

function nullCompare(
  left: ExprValue,
  op: string,
  right: ExprValue
): Expr | undefined {
  const not = op === "!=" || op === "!~";
  if (left.dataType === "null" || right.dataType === "null") {
    const maybeNot = not ? " NOT" : "";
    if (left.dataType !== "null") {
      return [...left.value, ` IS${maybeNot} NULL`];
    }
    if (right.dataType !== "null") {
      return [...right.value, `IS${maybeNot} NULL`];
    }
    return [not ? "false" : "true"];
  }
  return undefined;
}

export class ExprDuration extends ExpressionDef {
  elementType = "duration";
  legalChildTypes = [FT.timestampT, FT.dateT];
  constructor(readonly n: ExpressionDef, readonly timeframe: TimestampUnit) {
    super({ n });
  }

  apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
    const lhs = left.getExpression(fs);
    this.typeCheck(this, lhs);
    if (isTimeFieldType(lhs.dataType) && (op === "+" || op === "-")) {
      const num = this.n.getExpression(fs);
      if (!FT.typeEq(num, FT.numberT)) {
        this.log(`Duration units needs number not '${num.dataType}`);
        return errorFor("illegal unit expression");
      }
      let resultGranularity: TimestampUnit | undefined;
      // Only allow the output of this to be granular if the
      // granularities match, this is still an area where
      // more thought is required.
      if (isGranularResult(lhs) && lhs.timeframe == this.timeframe) {
        resultGranularity = lhs.timeframe;
      }
      if (lhs.dataType === "timestamp") {
        const result = timeOffset(
          "timestamp",
          lhs.value,
          op,
          num.value,
          this.timeframe
        );
        return timeResult(
          {
            dataType: "timestamp",
            expressionType: maxExpressionType(
              lhs.expressionType,
              num.expressionType
            ),
            value: result,
          },
          resultGranularity
        );
      }
      return timeResult(
        {
          dataType: "date",
          expressionType: maxExpressionType(
            lhs.expressionType,
            num.expressionType
          ),
          value: timeOffset("date", lhs.value, op, num.value, this.timeframe),
        },
        resultGranularity
      );
    }
    return super.apply(fs, op, left);
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return {
      dataType: "duration",
      expressionType: "scalar",
      value: ["__ERROR_DURATION_IS_NOT_A_VALUE__"],
    };
  }
}

function allAre(oneType: FieldValueType, ...values: ExprValue[]): boolean {
  for (const v of values) {
    if (v.dataType !== oneType) {
      return false;
    }
  }
  return true;
}

export class ExprTime extends ExpressionDef {
  elementType = "timestampOrDate";
  readonly translationValue: ExprValue;
  constructor(
    timeType: TimeFieldType,
    value: Fragment[] | string,
    expressionType: ExpressionType = "scalar"
  ) {
    super();
    this.elementType = timeType;
    this.translationValue = {
      dataType: timeType,
      expressionType,
      value: typeof value === "string" ? [value] : value,
    };
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.translationValue;
  }

  static fromValue(timeType: TimeFieldType, expr: ExprValue): ExprTime {
    let value = expr.value;
    if (timeType != expr.dataType) {
      const toTs: Fragment = {
        type: "dialect",
        function: "cast",
        safe: false,
        dstType: timeType,
        expr: expr.value,
      };
      if (isTimeFieldType(expr.dataType)) {
        toTs.srcType = expr.dataType;
      }
      value = compressExpr([toTs]);
    }
    return new ExprTime(timeType, value, expr.expressionType);
  }
}

export class Range extends ExpressionDef {
  elementType = "range";
  constructor(readonly first: ExpressionDef, readonly last: ExpressionDef) {
    super({ first, last });
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    switch (op) {
      case "=":
      case "!=": {
        const op1 = op === "=" ? ">=" : "<";
        const op2 = op === "=" ? "and" : "or";
        const op3 = op === "=" ? "<" : ">=";
        const fromValue = this.first.apply(fs, op1, expr);
        const toValue = this.last.apply(fs, op3, expr);
        return {
          dataType: "boolean",
          expressionType: maxExpressionType(
            fromValue.expressionType,
            toValue.expressionType
          ),
          value: compose(fromValue.value, op2, toValue.value),
        };
      }

      /**
       * This is a little surprising, but is actually how you comapre a
       * value to a range ...
       *
       * val > begin to end     val >= end
       * val >= begin to end    val >= begin
       * val < begin to end     val < begin
       * val <= begin to end    val < end
       */
      case ">":
        return this.last.apply(fs, ">=", expr);
      case ">=":
        return this.first.apply(fs, ">=", expr);
      case "<":
        return this.first.apply(fs, "<", expr);
      case "<=":
        return this.last.apply(fs, "<", expr);
    }
    throw new Error("mysterious error in range computation");
  }

  requestExpression(_fs: FieldSpace): ExprValue | undefined {
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return errorFor("a range is not a value");
  }
}

/**
 * A FieldSpace is a hierarchy of namespaces, where the leaf nodes
 * are fields. A FieldSpace can lookup fields, and generate a StructDef
 */
export interface FieldSpace {
  type: "fieldSpace";
  structDef(): model.StructDef;
  emptyStructDef(): model.StructDef;
  lookup(symbol: FieldName[]): LookupResult;
  dialectObj(): Dialect | undefined;
  whenComplete: (step: () => void) => void;
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
  dialectObj(): Dialect | undefined {
    return this.realFS.dialectObj();
  }
  whenComplete(step: () => void): void {
    this.realFS.whenComplete(step);
  }
}

export class StaticSpace implements FieldSpace {
  readonly type = "fieldSpace";
  private memoMap?: FieldMap;
  protected fromStruct: model.StructDef;

  constructor(sourceStructDef: model.StructDef) {
    this.fromStruct = sourceStructDef;
  }

  whenComplete(step: () => void): void {
    step();
  }

  dialectObj(): Dialect | undefined {
    try {
      return getDialect(this.fromStruct.dialect);
    } catch {
      return undefined;
    }
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
      /*
       * TODO cache defs, post the addReference call to whenComplete
       *
       * In the cleanup phase of query space construction, it may check
       * the output space for ungrouping variables. However if an
       * ungrouping variable is a measure, the field expression value
       * needed to get the definition needs to be computed in the
       * input space of the query. There is a test which failed which
       * caused this code to be here, but this is really a bandaid.
       *
       * Some re-work of how to get the definition of a SpaceField
       * no matter what it is contained in needs to be thought out.
       *
       * ... or this check would look at the finalized output of
       * the namespace and not re-compile ...
       */
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

/**
 * A FieldSpace which may undergo modification
 */
export class DynamicSpace extends StaticSpace {
  protected final: model.StructDef | undefined;
  protected source: SpaceSeed;
  outputFS?: QuerySpace;
  completions: (() => void)[] = [];
  private complete = false;

  constructor(extending: SourceSpec) {
    const source = new SpaceSeed(extending);
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

  whenComplete(finalizeStep: () => void): void {
    if (this.complete) {
      finalizeStep();
    } else {
      this.completions.push(finalizeStep);
    }
  }

  isComplete(): void {
    this.complete = true;
    for (const step of this.completions) {
      step();
    }
    this.completions = [];
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

  newEntry(name: string, astEl: MalloyElement, entry: SpaceEntry): void {
    if (this.entry(name)) {
      astEl.log(`Cannot redefine '${name}'`);
      return;
    }
    this.setEntry(name, entry);
  }

  addField(...defs: ExploreField[]): void {
    for (const def of defs) {
      // TODO express the "three fields kinds" in a typesafe way
      // one of three kinds of fields are legal in an explore: expressions ...
      const elseLog = def.log;
      const elseType = def.elementType;
      if (def instanceof FieldDeclaration) {
        const exprField = new ExpressionFieldFromAst(this, def);
        this.newEntry(exprField.name, def, exprField);
        // querry (turtle) fields
      } else if (def instanceof TurtleDecl) {
        const name = def.name;
        this.newEntry(name, def, new QueryFieldAST(this, def, name));
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
        this.newEntry(def.name.refString, def, new JoinSpaceField(this, def));
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
    this.isComplete();
    return this.final;
  }
}

export abstract class ResultSpace extends DynamicSpace {
  readonly exprSpace: QuerySpace;
  astEl?: MalloyElement | undefined;
  abstract readonly segmentType: "reduce" | "project" | "index";
  constructor(readonly queryInputSpace: FieldSpace) {
    super(queryInputSpace.emptyStructDef());
    this.exprSpace = new QuerySpace(queryInputSpace, this);
  }

  log(s: string): void {
    if (this.astEl) {
      this.astEl.log(s);
    }
  }

  addMembers(members: FieldCollectionMember[]): void {
    for (const member of members) {
      if (member instanceof FieldReference) {
        this.addReference(member);
      } else if (member instanceof WildcardFieldReference) {
        this.addWild(member);
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

  addWild(wild: WildcardFieldReference): void {
    this.setEntry(wild.refString, new WildSpaceField(wild.refString));
  }

  /**
   * Check for the definition of an ungrouping reference in the result space,
   * or in the case of an exclude reference, if this query is nested
   * in another query, in the result space of a query that this query
   * is nested inside of.
   */
  checkUngroup(fn: FieldName, isExclude: boolean): void {
    if (!this.entry(fn.refString)) {
      if (isExclude && this.exprSpace.nestParent) {
        const parent = this.exprSpace.nestParent;
        parent.whenComplete(() => {
          parent.result.checkUngroup(fn, isExclude);
        });
      } else {
        const uName = isExclude ? "exclude()" : "all()";
        fn.log(`${uName} '${fn.refString}' is missing from query output`);
      }
    }
  }

  addQueryItems(...qiList: QueryItem[]): void {
    for (const qi of qiList) {
      if (qi instanceof FieldReference || qi instanceof NestReference) {
        this.addReference(qi);
      } else if (qi instanceof FieldDeclaration) {
        this.addField(qi);
      } else if (isNestedQuery(qi)) {
        const qf = new QueryFieldAST(this, qi, qi.name);
        qf.nestParent = this.exprSpace;
        this.setEntry(qi.name, qf);
      } else {
        // Compiler will error if we don't handle all cases
        const _itemNotHandled: never = qi;
      }
    }
  }

  canContain(_qd: model.QueryFieldDef): boolean {
    return true;
  }

  protected queryFieldDefs(): model.QueryFieldDef[] {
    const fields: model.QueryFieldDef[] = [];
    for (const [name, field] of this.entries()) {
      if (field instanceof SpaceField) {
        const fieldQueryDef = field.getQueryFieldDef(this.exprSpace);
        if (fieldQueryDef) {
          if (this.canContain(fieldQueryDef)) {
            fields.push(fieldQueryDef);
          } else {
            this.log(`'${name}' not legal in ${this.segmentType}`);
          }
        } else {
          throw new Error(`'${name}' does not have a QueryFieldDef`);
        }
      }
    }
    this.isComplete();
    return fields;
  }

  getQuerySegment(rf: model.QuerySegment | undefined): model.QuerySegment {
    const p = this.getPipeSegment(rf);
    if (model.isQuerySegment(p)) {
      return p;
    }
    throw new Error("TODO NOT POSSIBLE");
  }

  getPipeSegment(
    refineFrom: model.QuerySegment | undefined
  ): model.PipeSegment {
    if (this.segmentType == "index") {
      // TODO ... should make this go away
      throw new Error("INDEX FIELD PIPE SEGMENT MIS HANDLED");
    }

    if (refineFrom?.extendSource) {
      for (const xField of refineFrom.extendSource) {
        this.exprSpace.addFieldDef(xField);
      }
    }

    const segment: model.QuerySegment = {
      type: this.segmentType,
      fields: this.queryFieldDefs(),
    };

    segment.fields = mergeFields(refineFrom?.fields, segment.fields);

    if (refineFrom?.extendSource) {
      segment.extendSource = refineFrom.extendSource;
    }
    if (this.exprSpace.extendList.length > 0) {
      const newExtends: model.FieldDef[] = [];
      const extendedStruct = this.exprSpace.structDef();

      for (const extendName of this.exprSpace.extendList) {
        const extendEnt = extendedStruct.fields.find(
          (f) => nameOf(f) == extendName
        );
        if (extendEnt) {
          newExtends.push(extendEnt);
        }
      }
      segment.extendSource = mergeFields(segment.extendSource, newExtends);
    }
    this.isComplete();
    return segment;
  }
}

/**
 * Reduce and project queries use a "QuerySpace"
 */
export class ReduceFieldSpace extends ResultSpace {
  readonly segmentType = "reduce";
}

export class ProjectFieldSpace extends ResultSpace {
  readonly segmentType = "project";

  canContain(qd: model.QueryFieldDef): boolean {
    if (typeof qd !== "string") {
      if (model.isFilteredAliasedName(qd)) {
        return true;
      }
      if (qd.type === "turtle") {
        this.log("Cannot nest queries in project");
        return false;
      }
      if (model.expressionIsAggregate(qd.expressionType)) {
        this.log("Cannot add aggregate measures to project");
        return false;
      }
    }
    return true;
  }
}

export abstract class SpaceEntry {
  abstract type(): FieldType;
  abstract refType: "field" | "parameter";
}
type FieldMap = Record<string, SpaceEntry>;

export abstract class SpaceField extends SpaceEntry {
  readonly refType = "field";

  protected fieldTypeFromFieldDef(def: model.FieldDef): FieldType {
    const ref: FieldType = { type: def.type };
    if (model.isFieldTypeDef(def) && def.expressionType) {
      ref.expressionType = def.expressionType;
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

export abstract class QueryField extends SpaceField {
  constructor(protected inSpace: FieldSpace) {
    super();
  }

  abstract getQueryFieldDef(fs: FieldSpace): model.QueryFieldDef | undefined;
  abstract fieldDef(): model.FieldDef;

  type(): FieldType {
    return { type: "turtle" };
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

  getQueryFieldDef(_fs: FieldSpace): model.QueryFieldDef | undefined {
    return this.fieldDef();
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

/**
 * Based on how things are constructed, the starting field space
 * can either be another field space or an existing structdef.
 * Using a SpaceSeed allows a class to accept either one
 * and use either version at some future time.
 */
export class SpaceSeed {
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

export type SourceSpec = model.StructDef | FieldSpace;
function isFieldSpace(x: SourceSpec): x is FieldSpace {
  return x.type == "fieldSpace";
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

  getQueryFieldDef(fs: FieldSpace): model.QueryFieldDef {
    const def = this.exprDef.queryFieldDef(fs, this.name);
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

export class QueryFieldAST extends QueryField {
  renameAs?: string;
  nestParent?: QuerySpace;
  constructor(
    fs: FieldSpace,
    readonly turtle: TurtleDecl,
    protected name: string
  ) {
    super(fs);
  }

  getQueryFieldDef(fs: FieldSpace): model.QueryFieldDef {
    const def = this.turtle.getFieldDef(fs, this.nestParent);
    if (this.renameAs) {
      def.as = this.renameAs;
    }
    return def;
  }

  fieldDef(): model.TurtleDef {
    const def = this.turtle.getFieldDef(this.inSpace, this.nestParent);
    if (this.renameAs) {
      def.as = this.renameAs;
    }
    return def;
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

export class JoinSpaceField extends StructSpaceField {
  constructor(readonly intoFS: FieldSpace, readonly join: Join) {
    super(join.structDef());
  }
}

/**
 * Unlike a source, which is a refinement of a namespace, a query
 * is creating a new unrelated namespace. The query starts with a
 * source, which it might modify. This set of fields used to resolve
 * expressions in the query is called the "input space". There is a
 * specialized QuerySpace for each type of query operation.
 *
 * The query output is managed by an instance of ResultSpace.
 */

export class QuerySpace extends DynamicSpace {
  nestParent?: QuerySpace;
  extendList: string[] = [];

  constructor(input: SourceSpec, readonly result: ResultSpace) {
    const inputSpace = new SpaceSeed(input);
    super(inputSpace.structDef);
  }

  extendSource(extendField: Join | FieldDeclaration): void {
    this.addField(extendField);
    if (extendField instanceof Join) {
      this.extendList.push(extendField.name.refString);
    } else {
      this.extendList.push(extendField.defineName);
    }
  }
}

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
    return this.fieldRef.refString;
  }

  type(): FieldType {
    return { type: "unknown" };
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

interface LookupFound {
  found: SpaceEntry;
  error: undefined;
}
interface LookupError {
  error: string;
  found: undefined;
}
export type LookupResult = LookupFound | LookupError;

export class IndexFieldSpace extends ResultSpace {
  readonly segmentType = "index";
  fieldList = new Set<string>();

  addReference(ref: FieldReference): void {
    if (ref.getField(this.exprSpace).found) {
      this.fieldList.add(ref.refString);
    }
  }

  addWild(wild: WildcardFieldReference): void {
    this.fieldList.add(wild.refString);
  }

  getPipeSegment(refineIndex?: model.PipeSegment): model.IndexSegment {
    if (refineIndex && refineIndex.fields) {
      for (const exists of refineIndex.fields) {
        if (typeof exists == "string") {
          this.fieldList.add(exists);
        }
      }
    }
    this.isComplete();
    return {
      type: "index",
      fields: Array.from(this.fieldList.values()),
    };
  }
}
