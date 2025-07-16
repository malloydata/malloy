/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {isBasicScalar, QueryFieldStruct} from './query_field';
import type {FieldInstanceResult} from './field_instance';
import type {
  QueryField,
  QueryFieldString,
  QueryFieldDate,
  QueryFieldTimestamp,
  QueryFieldNumber,
  QueryFieldBoolean,
  QueryFieldJSON,
  QueryFieldUnsupported,
  QueryFieldDistinctKey,
  QueryBasicField,
} from './query_field';
import {QueryQuery} from './malloy_query_index';
import type {ParentQueryModel, QueryModel} from './malloy_query_index';
import type {
  StructDef,
  FieldDef,
  StringFieldDef,
  DateFieldDef,
  TimestampFieldDef,
  NumberFieldDef,
  BooleanFieldDef,
  JSONFieldDef,
  NativeUnsupportedFieldDef,
  JoinFieldDef,
  Argument,
  PrepareResultOptions,
  Parameter,
  RefToField,
  TurtleDef,
  TurtleDefPlusFilters,
} from './malloy_types';
import {
  isSourceDef,
  getIdentifier,
  isBaseTable,
  hasExpression,
  isAtomic,
  isJoinedSource,
} from './malloy_types';
import type {EventStream} from '../runtime_types';
import {annotationToTag} from '../annotation';
import type {Tag} from '@malloydata/malloy-tag';
import type {Dialect, FieldReferenceType} from '../dialect';
import {getDialect} from '../dialect';
import {exprMap} from './utils';
import type {StageWriter} from './stage_writer';
import {shouldMaterialize} from './materialization/utils';
import {exprToSQL} from './expression_compiler';

// QueryFieldFactories interface for dependency injection
export interface QueryFieldFactories {
  createString(
    field: StringFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldString;
  createDate(
    field: DateFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldDate;
  createTimestamp(
    field: TimestampFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldTimestamp;
  createNumber(
    field: NumberFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldNumber;
  createBoolean(
    field: BooleanFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldBoolean;
  createJSON(
    field: JSONFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldJSON;
  createUnsupported(
    field: NativeUnsupportedFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldUnsupported;
  createStruct(
    field: JoinFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldStruct;
  createDistinctKey(
    field: StringFieldDef,
    parent: QueryStruct
  ): QueryFieldDistinctKey;
  createFromDef(field: FieldDef, parent: QueryStruct, ref?: string): QueryField;
}

// Parent interface for QueryStruct
export interface ParentQueryStruct {
  struct: QueryStruct;
}

function identifierNormalize(s: string) {
  return s.replace(/[^a-zA-Z0-9_]/g, '_o_');
}

// Export types for factory parameters
export type QueryStructParams = [
  structDef: StructDef,
  sourceArguments: Record<string, Argument> | undefined,
  parent: ParentQueryStruct | ParentQueryModel,
  prepareResultOptions: PrepareResultOptions,
];

/** Structure object as it is used to build a query */
export class QueryStruct {
  parent: QueryStruct | undefined;
  model: QueryModel;
  nameMap = new Map<string, QueryField>();
  pathAliasMap: Map<string, string>;
  dialect: Dialect;
  connectionName: string;
  recordAlias?: string;

  constructor(
    private fieldFactories: QueryFieldFactories,
    public structDef: StructDef,
    readonly sourceArguments: Record<string, Argument> | undefined,
    parent: ParentQueryStruct | ParentQueryModel,
    readonly prepareResultOptions: PrepareResultOptions
  ) {
    this.setParent(parent);

    if ('model' in parent) {
      this.model = parent.model;
      this.pathAliasMap = new Map<string, string>();
      if (isSourceDef(structDef)) {
        this.connectionName = structDef.connection;
      } else {
        throw new Error('All root StructDefs should be a baseTable');
      }
    } else {
      this.model = this.getModel();
      this.pathAliasMap = this.root().pathAliasMap;
      this.connectionName = this.root().connectionName;
    }

    this.dialect = getDialect(this.findFirstDialect());
    this.addFieldsFromFieldList(structDef.fields);
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

  informOfAliasValue(av: string): void {
    this.recordAlias = av;
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
        this.addFieldToNameMap(
          as,
          QueryQuery.makeQuery(field, this, undefined, false)
        );
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
        this.fieldFactories.createDistinctKey(
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

  sqlChildReference(
    name: string,
    expand: {result: FieldInstanceResult; field: QueryField} | undefined
  ) {
    let parentRef = this.getSQLIdentifier();
    if (expand && isAtomic(this.structDef) && hasExpression(this.structDef)) {
      if (!this.parent) {
        throw new Error(`Cannot expand reference to ${name} without parent`);
      }
      parentRef = exprToSQL(
        expand.field,
        expand.result,
        this.parent,
        this.structDef.e
      );
    }
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
      if (this.recordAlias) {
        return this.recordAlias;
      }
      throw new Error('INTERNAL ERROR, record field alias not pre-computed');
    }

    // if this is an inline object, include the parents alias.
    if (this.structDef.type === 'record' && this.parent) {
      return this.parent.sqlChildReference(
        getIdentifier(this.structDef),
        undefined
      );
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

  needsSymetricCalculation(resultSet: FieldInstanceResult): boolean {
    const joinName = this.getJoinableParent().getIdentifier();
    const join = resultSet.root().joins.get(joinName);
    if (join) {
      return !join.leafiest;
    }
    throw new Error(`Join ${joinName} not found in result set`);
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
   */
  resolveQueryFields() {
    if (this.structDef.type === 'query_source') {
      const resultStruct = this.model
        .loadQuery(this.structDef.query, undefined, this.prepareResultOptions)
        .structs.pop();

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
        v.queryStruct.resolveQueryFields();
      }
    }
  }

  getModel(): QueryModel {
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
    return this.getModel().eventStream;
  }

  setParent(parent: ParentQueryStruct | ParentQueryModel) {
    if ('struct' in parent) {
      this.parent = parent.struct;
    }
    if ('model' in parent) {
      this.model = parent.model;
    } else {
      this.model = this.getModel();
    }
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
        return this.fieldFactories.createStruct(field, this, referenceId);
      case 'string':
        return this.fieldFactories.createString(field, this, referenceId);
      case 'date':
        return this.fieldFactories.createDate(field, this, referenceId);
      case 'timestamp':
        return this.fieldFactories.createTimestamp(field, this, referenceId);
      case 'number':
        return this.fieldFactories.createNumber(field, this, referenceId);
      case 'boolean':
        return this.fieldFactories.createBoolean(field, this, referenceId);
      case 'json':
        return this.fieldFactories.createJSON(field, this, referenceId);
      case 'sql native':
        return this.fieldFactories.createUnsupported(field, this, referenceId);
      case 'turtle':
        return QueryQuery.makeQuery(field, this, undefined, false);
      default:
        throw new Error(
          `unknown field definition ${(JSON.stringify(field), undefined, 2)}`
        );
    }
  }

  structSourceSQL(stageWriter: StageWriter): string {
    switch (this.structDef.type) {
      case 'table':
        return this.dialect.quoteTablePath(this.structDef.tablePath);
      case 'composite':
        // TODO: throw an error here; not simple because we call into this
        // code currently before the composite source is resolved in some cases
        return '{COMPOSITE SOURCE}';
      case 'finalize':
        return this.structDef.name;
      case 'sql_select':
        return `(${this.structDef.selectStr})`;
      case 'nest_source':
        return this.structDef.pipeSQL;
      case 'query_source': {
        // cache derived table.
        if (
          this.prepareResultOptions?.replaceMaterializedReferences &&
          shouldMaterialize(this.structDef.query.annotation)
        ) {
          return stageWriter.addMaterializedQuery(
            getIdentifier(this.structDef),
            this.structDef.query,
            this.prepareResultOptions?.materializedTablePrefix
          );
        } else {
          // returns the stage name.
          return this.model.loadQuery(
            this.structDef.query,
            stageWriter,
            this.prepareResultOptions,
            false,
            true // this is an intermediate stage.
          ).lastStageName;
        }
      }
      default:
        throw new Error(
          `Cannot create SQL StageWriter from '${getIdentifier(
            this.structDef
          )}' type '${this.structDef.type}`
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
        return this.fieldFactories.createStruct(
          newDef,
          field.parent,
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
    let pipeline = turtleDef.pipeline;
    const annotation = turtleDef.annotation;

    const addedFilters = (turtleDef as TurtleDefPlusFilters).filterList || [];
    pipeline = structuredClone(pipeline);
    pipeline[0].filterList = addedFilters.concat(
      pipeline[0].filterList || [],
      isSourceDef(this.structDef) ? this.structDef.filterList || [] : []
    );

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
