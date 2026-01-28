/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {v4 as uuidv4} from 'uuid';
import type {
  FieldDef,
  BooleanFieldDef,
  DateFieldDef,
  StringFieldDef,
  JSONFieldDef,
  NumberFieldDef,
  ATimestampFieldDef,
  NativeUnsupportedFieldDef,
  JoinFieldDef,
  Argument,
  PrepareResultOptions,
  AtomicFieldDef,
  BasicAtomicDef,
  FilterCondition,
  Parameter,
  RefToField,
  StructDef,
  TurtleDef,
  TurtleDefPlusFilters,
  SourceDef,
  Query,
} from './malloy_types';
import {
  isSourceDef,
  getIdentifier,
  isBaseTable,
  hasExpression,
  isAtomic,
  isJoinedSource,
  expressionIsAggregate,
  expressionIsCalculation,
} from './malloy_types';
import type {EventStream} from '../runtime_types';
import {annotationToTag} from '../annotation';
import type {Tag} from '@malloydata/malloy-tag';
import type {Dialect, FieldReferenceType} from '../dialect';
import {getDialect} from '../dialect';
import {exprMap} from './utils';

abstract class QueryNode {
  readonly referenceId: string;
  constructor(referenceId?: string) {
    this.referenceId = referenceId ?? uuidv4();
  }
  abstract getIdentifier(): string;
  getChildByName(_name: string): QueryField | undefined {
    return undefined;
  }
}

export class QueryField extends QueryNode {
  fieldDef: FieldDef;
  parent: QueryStruct;

  constructor(fieldDef: FieldDef, parent: QueryStruct, referenceId?: string) {
    super(referenceId);
    this.fieldDef = fieldDef;
    this.parent = parent;
    this.fieldDef = fieldDef;
  }

  getIdentifier() {
    return getIdentifier(this.fieldDef);
  }

  getJoinableParent(): QueryStruct {
    const parent = this.parent;
    if (parent.structDef.type === 'record') {
      return parent.getJoinableParent();
    }
    return parent;
  }

  isAtomic() {
    return isAtomic(this.fieldDef);
  }

  getFullOutputName() {
    return this.parent.getFullOutputName() + this.getIdentifier();
  }

  isNestedInParent(parentDef: FieldDef) {
    switch (parentDef.type) {
      case 'record':
      case 'array':
        return true;
        return true;
      default:
        return false;
    }
  }

  isArrayElement(parentDef: FieldDef) {
    return (
      parentDef.type === 'array' &&
      parentDef.elementTypeDef.type !== 'record_element'
    );
  }

  includeInWildcard() {
    return false;
  }
}

export abstract class QueryAtomicField<
  T extends AtomicFieldDef,
> extends QueryField {
  fieldDef: T;

  constructor(fieldDef: T, parent: QueryStruct, refId?: string) {
    super(fieldDef, parent, refId);
    this.fieldDef = fieldDef; // wish I didn't have to do this
  }

  includeInWildcard(): boolean {
    return this.fieldDef.name !== '__distinct_key';
  }

  getFilterList(): FilterCondition[] {
    return [];
  }
}

export class QueryFieldBoolean extends QueryAtomicField<BooleanFieldDef> {}

export class QueryFieldDate extends QueryAtomicField<DateFieldDef> {}

export class QueryFieldDistinctKey extends QueryAtomicField<StringFieldDef> {}

export class QueryFieldJSON extends QueryAtomicField<JSONFieldDef> {}

export class QueryFieldNumber extends QueryAtomicField<NumberFieldDef> {}

export class QueryFieldString extends QueryAtomicField<StringFieldDef> {}

/*
 * The input to a query will always be a QueryStruct. A QueryStruct is also a namespace
 * for tracking joins, and so a QueryFieldStruct is a QueryField which has a QueryStruct.
 *
 * This is a result of it being impossible to inherit both from QueryStruct and QueryField
 * for array and record types.
 */
export class QueryFieldStruct extends QueryField {
  queryStruct: QueryStruct;
  fieldDef: JoinFieldDef;
  constructor(
    jfd: JoinFieldDef,
    sourceArguments: Record<string, Argument> | undefined,
    parent: QueryStruct,
    prepareResultOptions: PrepareResultOptions,
    referenceId?: string
  ) {
    super(jfd, parent, referenceId);
    this.fieldDef = jfd;
    this.queryStruct = new QueryStruct(
      jfd,
      sourceArguments,
      {struct: parent},
      prepareResultOptions
    );
  }

  /*
   * Proxy the field-like methods that QueryStruct implements, eventually
   * those probably should be in here ... I thought this would be important
   * but maybe it isn't, it doesn't fix the problem I am working on ...
   */

  getJoinableParent() {
    return this.queryStruct.getJoinableParent();
  }

  getFullOutputName() {
    return this.queryStruct.getFullOutputName();
  }

  includeInWildcard(): boolean {
    return this.isAtomic();
  }
}

export class QueryFieldTimestamp extends QueryAtomicField<ATimestampFieldDef> {}

export class QueryFieldUnsupported extends QueryAtomicField<NativeUnsupportedFieldDef> {}
/*
 * When compound (arrays, records) types became atomic types, it became unclear
 * which code wanted just "numbers and strings" and which code wanted anything
 * atomic.
 *
 * All of the original QueryFields are now members of "QueryBasicField"
 *
 * I think the re-factor for adding atomic compound types isn't done yet,
 * but things are working well enough now. A bug with nesting repeated
 * records revealed the need for isScalarField, but I was not brave
 * enough to look at all the calls is isBasicScalar.
 */
export type QueryBasicField = QueryAtomicField<BasicAtomicDef>;

// ============================================================================
// QueryField utility functions (consolidated from is_* files)
// ============================================================================

export function isAggregateField(f: QueryField): boolean {
  if (f.isAtomic() && hasExpression(f.fieldDef)) {
    return expressionIsAggregate(f.fieldDef.expressionType);
  }
  return false;
}

export function isCalculatedField(f: QueryField): boolean {
  if (f.isAtomic() && hasExpression(f.fieldDef)) {
    return expressionIsCalculation(f.fieldDef.expressionType);
  }
  return false;
}

export function isScalarField(f: QueryField): boolean {
  if (f.isAtomic()) {
    if (hasExpression(f.fieldDef)) {
      const et = f.fieldDef.expressionType;
      if (expressionIsCalculation(et) || expressionIsAggregate(et)) {
        return false;
      }
    }
    return true;
  }
  return false;
}

export function isBasicAggregate(f: QueryField): f is QueryBasicField {
  return f instanceof QueryAtomicField && isAggregateField(f);
}

export function isBasicCalculation(f: QueryField): f is QueryBasicField {
  return f instanceof QueryAtomicField && isCalculatedField(f);
}

export function isBasicScalar(f: QueryField): f is QueryBasicField {
  return f instanceof QueryAtomicField && isScalarField(f);
}

// Parent interface for QueryStruct
export interface ParentQueryStruct {
  struct: QueryStruct;
}

// Interface for model - provides struct lookup capability
export interface ModelRootInterface {
  structs: Map<string, QueryStruct>;
}

export interface ParentQueryModel {
  model: ModelRootInterface;
}

function identifierNormalize(s: string) {
  return s.replace(/[^a-zA-Z0-9_]/g, '_o_');
}

/** Structure object as it is used to build a query */
export class QueryStruct {
  parent: QueryStruct | undefined;
  model: ModelRootInterface;
  nameMap = new Map<string, QueryField>();
  pathAliasMap: Map<string, string>;
  dialect: Dialect;
  connectionName: string;
  /**
   * For fields which are a record, but the value is an expression
   * we capture the context needed to generate the expression in
   * QueryQuery.expandRecordExpressions. Later in the compilation if a
   * reference passes through this struct, this will call
   * the expression compiler with the correct context
   * to compute the record value.
   */
  computeRecordExpression?: () => string;
  recordValue?: string;

  constructor(
    public structDef: StructDef,
    readonly sourceArguments: Record<string, Argument> | undefined,
    parent: ParentQueryStruct | ParentQueryModel,
    readonly prepareResultOptions: PrepareResultOptions
  ) {
    if ('model' in parent) {
      this.model = parent.model;
      this.pathAliasMap = new Map<string, string>();
      if (isSourceDef(structDef)) {
        this.connectionName = structDef.connection;
      } else {
        throw new Error('All root StructDefs should be a baseTable');
      }
    } else {
      this.parent = parent.struct;
      this.model = this.getModel();
      this.pathAliasMap = this.root().pathAliasMap;
      this.connectionName = this.root().connectionName;
    }

    this.dialect = getDialect(this.findFirstDialect());
    this.addFieldsFromFieldList(structDef.fields);
  }

  // Injeected factory to break circularity with QueryQuery
  private static turtleFieldMaker:
    | ((field: TurtleDef, parent: QueryStruct) => QueryField)
    | undefined;

  static registerTurtleFieldMaker(
    maker: (field: TurtleDef, parent: QueryStruct) => QueryField
  ) {
    QueryStruct.turtleFieldMaker = maker;
  }

  private _modelTag: Tag | undefined = undefined;
  modelCompilerFlags(): Tag {
    if (this._modelTag === undefined) {
      const annotation = this.structDef.modelAnnotation;
      const {tag} = annotationToTag(annotation, {prefix: /^##!\s*/});
      this._modelTag = tag;
    }
    return this._modelTag;
  }

  protected findFirstDialect(): string {
    if (isSourceDef(this.structDef)) {
      return this.structDef.dialect;
    }
    if (this.parent) {
      return this.parent.findFirstDialect();
    }
    throw new Error('Cannot create QueryStruct from record with model parent');
  }

  maybeEmitParameterizedSourceUsage() {
    if (isSourceDef(this.structDef)) {
      const paramsAndArgs = {
        ...this.structDef.parameters,
        ...this.structDef.arguments,
      };
      if (Object.values(paramsAndArgs).length === 0) return;
      this.eventStream?.emit('parameterized-source-compiled', {
        parameters: paramsAndArgs,
      });
    }
  }

  private resolveParentParameterReferences(param: Parameter): Parameter {
    return {
      ...param,
      value:
        param.value === null
          ? null
          : exprMap(param.value, frag => {
              if (frag.node === 'parameter') {
                const resolved1 = (
                  this.parent ? this.parent.arguments() : this.arguments()
                )[frag.path[0]];
                const resolved2 = this.parent
                  ? this.parent.resolveParentParameterReferences(resolved1)
                  : resolved1;
                if (resolved2.value === null) {
                  throw new Error('Invalid parameter value');
                } else {
                  return resolved2.value;
                }
              }
              return frag;
            }),
    };
  }

  private _arguments: Record<string, Argument> | undefined = undefined;
  arguments(): Record<string, Argument> {
    if (this._arguments !== undefined) {
      return this._arguments;
    }
    this._arguments = {};
    if (isSourceDef(this.structDef)) {
      // First, copy over all parameters, to get default values
      const params = this.structDef.parameters ?? {};
      for (const parameterName in params) {
        this._arguments[parameterName] = params[parameterName];
      }
      // Then, copy over arguments to override default values
      const args = {...this.structDef.arguments, ...this.sourceArguments};
      for (const parameterName in args) {
        const orig = args[parameterName];
        this._arguments[parameterName] =
          this.resolveParentParameterReferences(orig);
      }
    }
    return this._arguments;
  }

  private addFieldsFromFieldList(fields: FieldDef[]) {
    for (const field of fields) {
      const as = getIdentifier(field);

      if (field.type === 'turtle') {
        if (!QueryStruct.turtleFieldMaker) {
          throw new Error(
            'INTERNAL ERROR: QueryQuery must initialize QueryStruct nested factory method'
          );
        }
        this.addFieldToNameMap(as, QueryStruct.turtleFieldMaker(field, this));
      } else if (isAtomic(field) || isJoinedSource(field)) {
        this.addFieldToNameMap(as, this.makeQueryField(field));
      } else {
        throw new Error('mtoy did nit add field');
      }
    }
    // if we don't have distinct key yet for this struct, add it.
    if (!this.nameMap.has('__distinct_key')) {
      this.addFieldToNameMap(
        '__distinct_key',
        new QueryFieldDistinctKey(
          {type: 'string', name: '__distinct_key'},
          this
        )
      );
    }
  }

  // generate unique string for the alias.
  // return a string that can be used to represent the full
  //  join path to a struct.
  getAliasIdentifier(): string {
    const path = this.getFullOutputName();
    const ret: string | undefined = this.pathAliasMap.get(path);

    // make a unique alias name
    if (ret === undefined) {
      const aliases = Array.from(this.pathAliasMap.values());
      const base = identifierNormalize(getIdentifier(this.structDef));
      let name = `${base}_0`;
      let n = 1;
      while (aliases.includes(name) && n < 1000) {
        n++;
        name = `${base}_${n}`;
      }
      if (n < 1000) {
        this.pathAliasMap.set(path, name);
        return name;
      } else {
        throw new Error('Internal Error: cannot create unique alias name');
      }

      // get the malloy name for this struct (will include a trailing dot)
      // return this.getFullOutputName().replace(/\.$/, "").replace(/\./g, "_o_");
    } else {
      return ret;
    }
  }

  getSQLIdentifier(): string {
    if (this.unnestWithNumbers() && this.parent !== undefined) {
      const x =
        this.parent.getSQLIdentifier() +
        '.' +
        getIdentifier(this.structDef) +
        `[${this.getIdentifier()}.__row_id]`;
      return x;
    } else {
      return this.getIdentifier();
    }
  }

  sqlSimpleChildReference(name: string) {
    const parentRef = this.getSQLIdentifier();
    let refType: FieldReferenceType = 'table';
    if (this.structDef.type === 'record') {
      refType = 'record';
    } else if (this.structDef.type === 'array') {
      refType =
        this.structDef.elementTypeDef.type === 'record_element'
          ? 'array[record]'
          : 'array[scalar]';
    } else if (this.structDef.type === 'nest_source') {
      refType = 'nest source';
    }
    const child = this.getChildByName(name);
    const childType = child?.fieldDef.type || 'unknown';
    return this.dialect.sqlFieldReference(parentRef, refType, name, childType);
  }

  // return the name of the field in SQL
  getIdentifier(): string {
    // if it is the root table, use provided alias if we have one.
    if (isBaseTable(this.structDef)) {
      return 'base';
    }

    // If this is a synthetic column, return the expression rather than the name
    // because the name will not exist. Only for records because the other types
    // will have joins and thus be in the namespace. We can't compute it here
    // because we don't have access to the Query to call exprToSQL.
    if (this.structDef.type === 'record' && hasExpression(this.structDef)) {
      if (this.computeRecordExpression) {
        if (!this.recordValue) {
          this.recordValue = this.computeRecordExpression();
        }
        return this.recordValue;
      }
      throw new Error('INTERNAL ERROR, record field alias not pre-computed');
    }

    // if this is an inline object, include the parents alias.
    if (this.structDef.type === 'record' && this.parent) {
      return this.parent.sqlSimpleChildReference(getIdentifier(this.structDef));
    }
    // we are somewhere in the join tree.  Make sure the alias is unique.
    return this.getAliasIdentifier();
  }

  // return the name of the field in Malloy
  getFullOutputName(): string {
    if (this.parent) {
      return (
        this.parent.getFullOutputName() + getIdentifier(this.structDef) + '.'
      );
    } else {
      return '';
    }
  }

  unnestWithNumbers(): boolean {
    return this.dialect.unnestWithNumbers && this.structDef.type === 'array';
  }

  getJoinableParent(): QueryStruct {
    // if it is inline it should always have a parent
    if (this.structDef.type === 'record') {
      if (this.parent) {
        return this.parent.getJoinableParent();
      } else {
        throw new Error('Internal Error: inline struct cannot be root');
      }
    }
    return this;
  }

  addFieldToNameMap(as: string, n: QueryField) {
    if (this.nameMap.has(as)) {
      throw new Error(`Redefinition of ${as}`);
    }
    this.nameMap.set(as, n);
  }

  /** the the primary key or throw an error. */
  getPrimaryKeyField(fieldDef: FieldDef): QueryBasicField {
    let pk;
    if ((pk = this.primaryKey())) {
      return pk;
    } else {
      throw new Error(`Missing primary key for ${fieldDef}`);
    }
  }

  /**
   * called after all structure has been loaded.  Examine this structure to see
   * if if it is based on a query and if it is, add the output fields (unless
   * they exist) to the structure.
   *
   * finalOutputStruct exists so that query_node doesn't need to
   * to import query_query
   */
  resolveQueryFields(
    finalOutputStruct: (
      query: Query,
      options: PrepareResultOptions | undefined
    ) => SourceDef | undefined
  ) {
    if (this.structDef.type === 'query_source' && finalOutputStruct) {
      const resultStruct = finalOutputStruct(
        this.structDef.query,
        this.prepareResultOptions
      );

      // should never happen.
      if (!resultStruct) {
        throw new Error("Internal Error, query didn't produce a struct");
      }

      const structDef = {...this.structDef};
      for (const f of resultStruct.fields) {
        const as = getIdentifier(f);
        if (!this.nameMap.has(as)) {
          structDef.fields.push(f);
          this.nameMap.set(as, this.makeQueryField(f));
        }
      }
      this.structDef = structDef;
      if (!this.structDef.primaryKey && resultStruct.primaryKey) {
        this.structDef.primaryKey = resultStruct.primaryKey;
      }
    }
    for (const [, v] of this.nameMap) {
      if (v instanceof QueryFieldStruct) {
        v.queryStruct.resolveQueryFields(finalOutputStruct);
      }
    }
  }

  getModel(): ModelRootInterface {
    if (this.model) {
      return this.model;
    } else {
      if (this.parent === undefined) {
        throw new Error(
          'Expected this query struct to have a parent, as no model was present.'
        );
      }
      return this.parent.getModel();
    }
  }

  get eventStream(): EventStream | undefined {
    return this.prepareResultOptions?.eventStream;
  }

  /** makes a new queryable field object from a fieldDef */
  makeQueryField(field: FieldDef, referenceId?: string): QueryField {
    switch (field.type) {
      case 'array':
      case 'record':
      case 'query_source':
      case 'table':
      case 'sql_select':
      case 'composite':
        return new QueryFieldStruct(
          field,
          undefined,
          this,
          this.prepareResultOptions
        );
      case 'string':
        return new QueryFieldString(field, this, referenceId);
      case 'date':
        return new QueryFieldDate(field, this, referenceId);
      case 'timestamp':
      case 'timestamptz':
        return new QueryFieldTimestamp(field, this, referenceId);
      case 'number':
        return new QueryFieldNumber(field, this, referenceId);
      case 'boolean':
        return new QueryFieldBoolean(field, this, referenceId);
      case 'json':
        return new QueryFieldJSON(field, this, referenceId);
      case 'sql native':
        return new QueryFieldUnsupported(field, this, referenceId);
      case 'turtle':
        if (!QueryStruct.turtleFieldMaker) {
          throw new Error(
            'INTERNAL ERROR: QueryQuery must initialize QueryStruct nested factory method'
          );
        }
        return QueryStruct.turtleFieldMaker(field, this);
      default:
        throw new Error(
          `unknown field definition ${(JSON.stringify(field), undefined, 2)}`
        );
    }
  }

  root(): QueryStruct {
    return this.parent ? this.parent.root() : this;
  }

  primaryKey(): QueryBasicField | undefined {
    if (isSourceDef(this.structDef) && this.structDef.primaryKey) {
      return this.getDimensionByName([this.structDef.primaryKey]);
    } else {
      return undefined;
    }
  }

  getChildByName(name: string): QueryField | undefined {
    return this.nameMap.get(name);
  }

  /** convert a path into a field reference */
  getFieldByName(path: string[]): QueryField {
    let found: QueryField | undefined = undefined;
    let lookIn = this as QueryStruct | undefined;
    let notFound = path[0];
    for (const n of path) {
      found = lookIn?.getChildByName(n);
      if (!found) {
        notFound = n;
        break;
      }
      lookIn =
        found instanceof QueryFieldStruct ? found.queryStruct : undefined;
    }
    if (found === undefined) {
      const pathErr = path.length > 1 ? ` in ${path.join('.')}` : '';
      throw new Error(`${notFound} not found${pathErr}`);
    }
    return found;
  }

  // structs referenced in queries are converted to fields.
  getQueryFieldByName(name: string[]): QueryField {
    const field = this.getFieldByName(name);
    if (field instanceof QueryFieldStruct) {
      throw new Error(`Cannot reference ${name.join('.')} as a scalar'`);
    }
    return field;
  }

  getQueryFieldReference(f: RefToField): QueryField {
    const {path, annotation, drillExpression} = f;
    const field = this.getFieldByName(path);
    if (annotation || drillExpression) {
      if (field.parent === undefined) {
        throw new Error(
          'Inconcievable, field reference to orphaned query field'
        );
      }
      // Made a field object from the source, but the annotations were computed by the compiler
      // when it generated the reference, and has both the source and reference annotations included.
      if (field instanceof QueryFieldStruct) {
        const newDef = {...field.fieldDef, annotation, drillExpression};
        return new QueryFieldStruct(
          newDef,
          undefined,
          field.parent,
          field.parent.prepareResultOptions,
          field.referenceId
        );
      } else {
        const newDef = {...field.fieldDef, annotation, drillExpression};
        return field.parent.makeQueryField(newDef, field.referenceId);
      }
    }
    return field;
  }

  getDimensionOrMeasureByName(name: string[]) {
    const field = this.getFieldByName(name);
    if (!field.isAtomic()) {
      throw new Error(`${name} is not an atomic field? Inconceivable!`);
    }
    return field;
  }

  /** returns a query object for the given name */
  getDimensionByName(name: string[]): QueryBasicField {
    const field = this.getFieldByName(name);

    if (isBasicScalar(field)) {
      return field;
    }
    throw new Error(`${name} is not an atomic scalar field? Inconceivable!`);
  }

  /** returns a query object for the given name */
  getStructByName(name: string[]): QueryStruct {
    if (name.length === 0) {
      return this;
    }
    const struct = this.getFieldByName(name);
    if (struct instanceof QueryFieldStruct) {
      return struct.queryStruct;
    }
    throw new Error(`Error: Path to structure not found '${name.join('.')}'`);
  }

  getDistinctKey(): QueryBasicField {
    if (this.structDef.type !== 'record') {
      return this.getDimensionByName(['__distinct_key']);
    } else if (this.parent) {
      return this.parent.getDistinctKey();
    } else {
      throw new Error('Asking a record for a primary key? Inconceivable!');
    }
  }

  applyStructFiltersToTurtleDef(
    turtleDef: TurtleDef | TurtleDefPlusFilters
  ): TurtleDef {
    const pipeline = [...turtleDef.pipeline];
    const annotation = turtleDef.annotation;

    const addedFilters = (turtleDef as TurtleDefPlusFilters).filterList || [];
    pipeline[0] = {
      ...pipeline[0],
      filterList: addedFilters.concat(
        pipeline[0].filterList || [],
        isSourceDef(this.structDef) ? this.structDef.filterList || [] : []
      ),
    };

    const flatTurtleDef: TurtleDef = {
      type: 'turtle',
      name: turtleDef.name,
      pipeline,
      annotation,
      location: turtleDef.location,
    };
    return flatTurtleDef;
  }
}
