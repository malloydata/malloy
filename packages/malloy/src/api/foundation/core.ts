/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {LogMessage} from '../../lang';
import type {
  CompiledQuery,
  DocumentLocation,
  BooleanFieldDef,
  JSONFieldDef,
  NumberFieldDef,
  StringFieldDef,
  FilterCondition,
  Query as InternalQuery,
  ModelDef,
  DocumentPosition as ModelDocumentPosition,
  NamedQueryDef,
  StructDef,
  TurtleDef,
  NativeUnsupportedFieldDef,
  ImportLocation,
  Annotation,
  NamedModelObject,
  SQLSourceDef,
  AtomicFieldDef,
  DateFieldDef,
  ATimestampFieldDef,
  SourceDef,
  Argument,
  QuerySourceDef,
  TableSourceDef,
  SourceComponentInfo,
  DocumentReference,
} from '../../model';
import {
  fieldIsIntrinsic,
  QueryModel,
  expressionIsCalculation,
  isAtomicFieldType,
  isSourceDef,
  isJoined,
  isRecordOrRepeatedRecord,
  buildInternalGraph,
} from '../../model';
import {makeDigest} from '../../model/utils';
import type {Dialect} from '../../dialect';
import {getDialect} from '../../dialect';
import type {Connection, LookupConnection} from '../../connection/types';
import type {BuildGraph, BuildNode} from './types';
import type {Tag} from '@malloydata/malloy-tag';
import type {MalloyTagParse, TagParseSpec} from '../../annotation';
import {
  addModelScope,
  annotationToTag,
  annotationToTaglines,
} from '../../annotation';
import {locationContainsPosition} from '../../lang/utils';
import {ReferenceList} from '../../lang/reference-list';
import type {Taggable} from '../../taggable';
import type {CompileQueryOptions} from './types';

type ComponentSourceDef = TableSourceDef | SQLSourceDef | QuerySourceDef;
function isSourceComponent(source: StructDef): source is ComponentSourceDef {
  return (
    source.type === 'table' ||
    source.type === 'sql_select' ||
    source.type === 'query_source'
  );
}

// =============================================================================
// Entity - Base class for Explore and Field types
// =============================================================================

abstract class Entity {
  private readonly _name: string;
  protected readonly _parent?: Explore;
  private readonly _source?: Entity;

  constructor(name: string, parent?: Explore, source?: Entity) {
    this._name = name;
    this._parent = parent;
    this._source = source;
  }

  public get source(): Entity | undefined {
    return this._source;
  }

  public get name(): string {
    return this._name;
  }

  public get sourceClasses(): string[] {
    const sourceClasses: string[] = [];
    if (this.source) {
      sourceClasses.push(this.source.name);
    }
    sourceClasses.push(this.name);
    return sourceClasses;
  }

  public get fieldPath(): string[] {
    const path: string[] = [this.name];
    let f: Entity | undefined = this._parent;
    while (f) {
      path.unshift(f.name);
      f = f._parent;
    }
    return path;
  }

  public hasParentExplore(): this is Field {
    return this._parent !== undefined;
  }

  isExplore(): this is Explore {
    return this instanceof Explore;
  }

  isQuery(): this is Query {
    return this instanceof QueryField;
  }

  public abstract isIntrinsic(): boolean;

  public abstract get location(): DocumentLocation | undefined;
}

// =============================================================================
// Enums
// =============================================================================

/**
 * The relationship of an `Explore` to its source.
 */
export enum SourceRelationship {
  /**
   * The `Explore` is nested data within the source's rows.
   */
  Nested = 'nested',

  /**
   * The `Explore` is the base table.
   */
  BaseTable = 'base_table',

  /**
   * The `Explore` is joined to its source
   */
  Cross = 'cross',
  One = 'one',
  Many = 'many',

  // TODO document this
  Inline = 'inline',
}

export enum AtomicFieldType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Date = 'date',
  Timestamp = 'timestamp',
  Timestamptz = 'timestamptz',
  Json = 'json',
  NativeUnsupported = 'sql native',
  Error = 'error',
}

export enum DateTimeframe {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Quarter = 'quarter',
  Year = 'year',
}

export enum TimestampTimeframe {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Quarter = 'quarter',
  Year = 'year',
  Second = 'second',
  Hour = 'hour',
  Minute = 'minute',
}

export enum JoinRelationship {
  OneToOne = 'one_to_one',
  OneToMany = 'one_to_many',
  ManyToOne = 'many_to_one',
}

// =============================================================================
// Types
// =============================================================================

export type Field = AtomicField | QueryField | ExploreField;

export type SerializedExplore = {
  _structDef: StructDef;
  sourceExplore?: SerializedExplore;
  _parentExplore?: SerializedExplore;
};

export type SortableField = {field: Field; dir: 'asc' | 'desc' | undefined};

export type PreparedResultJSON = {
  query: CompiledQuery;
  modelDef: ModelDef;
};

// =============================================================================
// Explore
// =============================================================================

export class Explore extends Entity implements Taggable {
  protected readonly _structDef: StructDef;
  protected readonly _parentExplore?: Explore;
  private _fieldMap: Map<string, Field> | undefined;
  private sourceExplore: Explore | undefined;
  private _allFieldsWithOrder: SortableField[] | undefined;

  constructor(structDef: StructDef, parentExplore?: Explore, source?: Explore) {
    super(structDef.as || structDef.name, parentExplore, source);
    this._structDef = structDef;
    this._parentExplore = parentExplore;
    this.sourceExplore = source;
  }

  public get source(): Explore | undefined {
    return this.sourceExplore;
  }

  public isIntrinsic(): boolean {
    if (isAtomicFieldType(this._structDef.type)) {
      return !('e' in this._structDef);
    }
    return false;
  }

  public isExploreField(): this is ExploreField {
    return false;
  }

  tagParse(spec?: TagParseSpec): MalloyTagParse {
    return annotationToTag(this._structDef.annotation, spec);
  }

  getTaglines(prefix?: RegExp): string[] {
    return annotationToTaglines(this._structDef.annotation, prefix);
  }

  private parsedModelTag?: Tag;
  public get modelTag(): Tag {
    this.parsedModelTag ||= annotationToTag(
      this._structDef.modelAnnotation
    ).tag;
    return this.parsedModelTag;
  }

  /**
   * @return The name of the entity.
   */
  public get name(): string {
    return this.structDef.as || this.structDef.name;
  }

  public getQueryByName(name: string): PreparedQuery {
    const structRef = this.sourceStructDef;
    if (!structRef) {
      throw new Error(
        `Cannot get query by name from a struct of type ${this.structDef.type}`
      );
    }
    const view = structRef.fields.find(f => (f.as ?? f.name) === name);
    if (view === undefined) {
      throw new Error(`No such view named \`${name}\``);
    }
    if (view.type !== 'turtle') {
      throw new Error(`\`${name}\` is not a view`);
    }
    const internalQuery: InternalQuery = {
      type: 'query',
      structRef,
      pipeline: view.pipeline,
    };
    return new PreparedQuery(
      internalQuery,
      this.getSingleExploreModel(),
      [],
      name
    );
  }

  private get modelDef(): ModelDef {
    if (!isSourceDef(this.structDef)) {
      throw new Error(
        `Cannot create pseudo model for struct type ${this.structDef.type}`
      );
    }
    return {
      name: 'generated_model',
      exports: [],
      contents: {[this.structDef.name]: this.structDef},
      queryList: [],
      dependencies: {},
    };
  }

  public getSingleExploreModel(): Model {
    return new Model(this.modelDef, [], []);
  }

  private get fieldMap(): Map<string, Field> {
    if (this._fieldMap === undefined) {
      const sourceFields = this.source?.fieldMap || new Map();
      this._fieldMap = new Map(
        this.structDef.fields.map(fieldDef => {
          const name = fieldDef.as || fieldDef.name;
          const sourceField = sourceFields.get(fieldDef.name);
          if (isJoined(fieldDef)) {
            return [name, new ExploreField(fieldDef, this, sourceField)];
          } else if (fieldDef.type === 'turtle') {
            return [name, new QueryField(fieldDef, this, sourceField)];
          } else {
            if (fieldDef.type === 'string') {
              return [name, new StringField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'number') {
              return [name, new NumberField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'date') {
              // TODO this is a hack
              if (
                fieldDef.timeframe &&
                ['day_of_month', 'day_of_week', 'day_of_year'].includes(
                  fieldDef.timeframe
                )
              ) {
                return [
                  name,
                  new NumberField(
                    {...fieldDef, type: 'number'},
                    this,
                    sourceField
                  ),
                ];
              }
              return [name, new DateField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'timestamp') {
              return [name, new TimestampField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'timestamptz') {
              return [name, new TimestampField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'boolean') {
              return [name, new BooleanField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'json') {
              return [name, new JSONField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'sql native') {
              return [name, new UnsupportedField(fieldDef, this, sourceField)];
            }
          }
        }) as [string, Field][]
      );
    }
    return this._fieldMap;
  }

  public get allFields(): Field[] {
    return [...this.fieldMap.values()];
  }

  public get allFieldsWithOrder(): SortableField[] {
    if (!this._allFieldsWithOrder) {
      const orderByFields = [
        ...(this.sourceStructDef?.resultMetadata?.orderBy?.map(f => {
          if (typeof f.field === 'string') {
            const a = {
              field: this.fieldMap.get(f.field as string)!,
              dir: f.dir,
            };
            return a;
          }

          throw new Error('Does not support mapping order by from number.');
        }) || []),
      ];

      const orderByFieldSet = new Set(orderByFields.map(f => f.field.name));
      this._allFieldsWithOrder = [
        ...orderByFields,
        ...this.allFields
          .filter(f => !orderByFieldSet.has(f.name))
          .map<SortableField>(field => {
            return {
              field,
              dir: 'asc',
            };
          }),
      ];
    }

    return this._allFieldsWithOrder;
  }

  public get intrinsicFields(): Field[] {
    return [...this.fieldMap.values()].filter(f => f.isIntrinsic());
  }

  public get dimensions(): SortableField[] {
    return [...this.allFieldsWithOrder].filter(
      f => f.field.isAtomicField() && f.field.sourceWasDimension()
    );
  }

  public getFieldByName(fieldName: string): Field {
    const field = this.fieldMap.get(fieldName);
    if (field === undefined) {
      throw new Error(`No such field ${fieldName}.`);
    }
    return field;
  }

  public getFieldByNameIfExists(fieldName: string): Field | undefined {
    return this.fieldMap.get(fieldName);
  }

  public get primaryKey(): string | undefined {
    return this.sourceStructDef?.primaryKey;
  }

  public get parentExplore(): Explore | undefined {
    return this._parentExplore;
  }

  public hasParentExplore(): this is ExploreField {
    return this instanceof ExploreField;
  }

  get filters(): FilterCondition[] {
    if (isSourceDef(this.structDef)) {
      return this.structDef.resultMetadata?.filterList || [];
    }
    return [];
  }

  get limit(): number | undefined {
    return this.sourceStructDef?.resultMetadata?.limit;
  }

  public get structDef(): StructDef {
    return this._structDef;
  }

  public get queryTimezone(): string | undefined {
    return this.sourceStructDef?.queryTimezone;
  }

  public get sourceStructDef(): SourceDef | undefined {
    if (isSourceDef(this.structDef)) {
      return this.structDef;
    }
  }

  public toJSON(): SerializedExplore {
    return {
      _structDef: this._structDef,
      sourceExplore: this.sourceExplore?.toJSON(),
      _parentExplore: this._parentExplore?.toJSON(),
    };
  }

  public static fromJSON(main_explore: SerializedExplore): Explore {
    const parentExplore =
      main_explore._parentExplore !== undefined
        ? Explore.fromJSON(main_explore._parentExplore)
        : undefined;
    const sourceExplore =
      main_explore.sourceExplore !== undefined
        ? Explore.fromJSON(main_explore.sourceExplore)
        : undefined;
    return new Explore(main_explore._structDef, parentExplore, sourceExplore);
  }

  public get location(): DocumentLocation | undefined {
    return this.structDef.location;
  }

  private collectSourceComponents(structDef: StructDef): SourceComponentInfo[] {
    const sources: SourceComponentInfo[] = [];

    if (structDef.type === 'composite') {
      for (const source of structDef.sources) {
        sources.push(...this.collectSourceComponents(source));
      }
      return sources;
    }
    if (isSourceComponent(structDef)) {
      if (structDef.type === 'table') {
        sources.push({
          type: 'table',
          tableName: structDef.tablePath,
          componentID: `${structDef.connection}:${structDef.tablePath}`,
          sourceID: `${structDef.connection}:${structDef.tablePath}`,
        });
      } else if (structDef.type === 'sql_select') {
        sources.push({
          type: 'sql',
          selectStatement: structDef.selectStr,
          componentID: `${structDef.connection}:${structDef.selectStr}`,
          sourceID: `${structDef.connection}:${structDef.selectStr}`,
        });
      } else if (structDef.type === 'query_source') {
        let sql: string;
        try {
          const preparedQuery = new PreparedQuery(
            structDef.query,
            this.getSingleExploreModel(),
            []
          );
          const preparedResult = preparedQuery.getPreparedResult();
          sql = preparedResult.sql;
        } catch (error) {
          sql = `-- Could not compile SQL for query ${
            structDef.query.name || 'unnamed query'
          }: ${error instanceof Error ? error.message : String(error)}`;
        }

        const componentID = `${structDef.connection}:${sql}`;

        sources.push({
          type: 'sql',
          selectStatement: sql,
          componentID: componentID,
          sourceID: componentID,
        });
      }
    } else {
      return [];
    }

    for (const field of structDef.fields) {
      if (isJoined(field)) {
        sources.push(...this.collectSourceComponents(field));
      }
    }
    return sources;
  }

  /**
   * THIS IS A HIGHLY EXPERIMENTAL API AND MAY VANISH OR CHANGE WITHOUT NOTICE
   */
  public getSourceComponents(): SourceComponentInfo[] {
    const uniqueSources: Record<string, SourceComponentInfo> = {};
    if (isSourceDef(this.structDef)) {
      const allSources = this.collectSourceComponents(this.structDef);

      for (const source of allSources) {
        if (source.componentID) {
          uniqueSources[source.componentID] = source;
        } else if (source.sourceID) {
          uniqueSources[source.sourceID] = source;
        }
      }
    }

    return Object.values(uniqueSources);
  }
}

// =============================================================================
// AtomicField and subclasses
// =============================================================================

export class AtomicField extends Entity implements Taggable {
  protected fieldTypeDef: AtomicFieldDef;
  protected parent: Explore;

  constructor(
    fieldTypeDef: AtomicFieldDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldTypeDef.as || fieldTypeDef.name, parent, source);
    this.fieldTypeDef = fieldTypeDef;
    this.parent = parent;
  }

  public get type(): AtomicFieldType {
    switch (this.fieldTypeDef.type) {
      case 'string':
        return AtomicFieldType.String;
      case 'boolean':
        return AtomicFieldType.Boolean;
      case 'date':
        return AtomicFieldType.Date;
      case 'timestamp':
        return AtomicFieldType.Timestamp;
      case 'timestamptz':
        return AtomicFieldType.Timestamptz;
      case 'number':
        return AtomicFieldType.Number;
      case 'json':
        return AtomicFieldType.Json;
      case 'sql native':
        return AtomicFieldType.NativeUnsupported;
      case 'error':
        return AtomicFieldType.Error;
      case 'record':
      case 'array':
        throw new Error(`MTOY TODO IMPLEMENT Atomic ${this.fieldTypeDef.type}`);
      default: {
        const x: never = this.fieldTypeDef;
        throw new Error(`Can't make an atomic field from ${x}`);
      }
    }
  }

  tagParse(spec?: TagParseSpec) {
    spec = addModelScope(spec, this.parent.modelTag);
    return annotationToTag(this.fieldTypeDef.annotation, spec);
  }

  getTaglines(prefix?: RegExp) {
    return annotationToTaglines(this.fieldTypeDef.annotation, prefix);
  }

  public isIntrinsic(): boolean {
    return fieldIsIntrinsic(this.fieldTypeDef);
  }

  public isQueryField(): this is QueryField {
    return false;
  }

  public isExploreField(): this is ExploreField {
    return false;
  }

  public isAtomicField(): this is AtomicField {
    return true;
  }

  public isCalculation(): boolean {
    return expressionIsCalculation(this.fieldTypeDef.expressionType);
  }

  public get sourceField(): Field {
    throw new Error();
  }

  public get sourceClasses(): string[] {
    const sourceField = this.fieldTypeDef.name || this.fieldTypeDef.as;
    return sourceField ? [sourceField] : [];
  }

  public get referenceId(): string | undefined {
    return this.fieldTypeDef.resultMetadata?.referenceId;
  }

  public sourceWasMeasure(): boolean {
    return this.fieldTypeDef.resultMetadata?.fieldKind === 'measure';
  }

  public sourceWasMeasureLike(): boolean {
    return (
      this.fieldTypeDef.resultMetadata?.fieldKind === 'measure' ||
      this.fieldTypeDef.resultMetadata?.fieldKind === 'struct'
    );
  }

  public sourceWasDimension(): boolean {
    return this.fieldTypeDef.resultMetadata?.fieldKind === 'dimension';
  }

  public hasParentExplore(): this is Field {
    return true;
  }

  public isString(): this is StringField {
    return this instanceof StringField;
  }

  public isNumber(): this is NumberField {
    return this instanceof NumberField;
  }

  public isDate(): this is DateField {
    return this instanceof DateField;
  }

  public isBoolean(): this is BooleanField {
    return this instanceof BooleanField;
  }

  public isJSON(): this is JSONField {
    return this instanceof JSONField;
  }

  public isTimestamp(): this is TimestampField {
    return this instanceof TimestampField;
  }

  public isUnsupported(): this is UnsupportedField {
    return this instanceof UnsupportedField;
  }

  get parentExplore(): Explore {
    return this.parent;
  }

  get expression(): string {
    const dot = '.';
    const resultMetadata = this.fieldTypeDef.resultMetadata;
    return (
      resultMetadata?.sourceExpression ||
      (resultMetadata?.sourceField.includes(dot)
        ? resultMetadata?.sourceField
        : this.name)
    );
  }

  public get location(): DocumentLocation | undefined {
    return this.fieldTypeDef.location;
  }
}

export class DateField extends AtomicField {
  private fieldDateDef: DateFieldDef;
  constructor(
    fieldDateDef: DateFieldDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldDateDef, parent, source);
    this.fieldDateDef = fieldDateDef;
  }

  get timeframe(): DateTimeframe | undefined {
    if (this.fieldDateDef.timeframe === undefined) {
      return undefined;
    }
    switch (this.fieldDateDef.timeframe) {
      case 'day':
        return DateTimeframe.Day;
      case 'week':
        return DateTimeframe.Week;
      case 'month':
        return DateTimeframe.Month;
      case 'quarter':
        return DateTimeframe.Quarter;
      case 'year':
        return DateTimeframe.Year;
    }
  }
}

export class TimestampField extends AtomicField {
  private fieldTimestampDef: ATimestampFieldDef;
  constructor(
    fieldTimestampDef: ATimestampFieldDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldTimestampDef, parent, source);
    this.fieldTimestampDef = fieldTimestampDef;
  }

  get timeframe(): TimestampTimeframe | undefined {
    if (this.fieldTimestampDef.timeframe === undefined) {
      return undefined;
    }
    switch (this.fieldTimestampDef.timeframe) {
      case 'day':
        return TimestampTimeframe.Day;
      case 'week':
        return TimestampTimeframe.Week;
      case 'month':
        return TimestampTimeframe.Month;
      case 'quarter':
        return TimestampTimeframe.Quarter;
      case 'year':
        return TimestampTimeframe.Year;
      case 'second':
        return TimestampTimeframe.Second;
      case 'hour':
        return TimestampTimeframe.Hour;
      case 'minute':
        return TimestampTimeframe.Minute;
    }
  }
}

export class NumberField extends AtomicField {
  private fieldNumberDef: NumberFieldDef;
  constructor(
    fieldNumberDef: NumberFieldDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldNumberDef, parent, source);
    this.fieldNumberDef = fieldNumberDef;
  }
}

export class BooleanField extends AtomicField {
  private fieldBooleanDef: BooleanFieldDef;
  constructor(
    fieldBooleanDef: BooleanFieldDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldBooleanDef, parent, source);
    this.fieldBooleanDef = fieldBooleanDef;
  }
}

export class JSONField extends AtomicField {
  private fieldJSONDef: JSONFieldDef;
  constructor(
    fieldJSONDef: JSONFieldDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldJSONDef, parent, source);
    this.fieldJSONDef = fieldJSONDef;
  }
}

export class UnsupportedField extends AtomicField {
  private fieldUnsupportedDef: NativeUnsupportedFieldDef;
  constructor(
    fieldUnsupportedDef: NativeUnsupportedFieldDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldUnsupportedDef, parent, source);
    this.fieldUnsupportedDef = fieldUnsupportedDef;
  }
  get rawType(): string | undefined {
    return this.fieldUnsupportedDef.rawType;
  }
}

export class StringField extends AtomicField {
  private fieldStringDef: StringFieldDef;
  constructor(
    fieldStringDef: StringFieldDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldStringDef, parent, source);
    this.fieldStringDef = fieldStringDef;
  }
}

// =============================================================================
// Query and QueryField
// =============================================================================

export class Query extends Entity {
  protected turtleDef: TurtleDef;
  private sourceQuery?: Query;

  constructor(turtleDef: TurtleDef, parent?: Explore, source?: Query) {
    super(turtleDef.as || turtleDef.name, parent, source);
    this.turtleDef = turtleDef;
  }

  public get source(): Query | undefined {
    return this.sourceQuery;
  }

  public isIntrinsic(): boolean {
    return false;
  }

  public get location(): DocumentLocation | undefined {
    return this.turtleDef.location;
  }
}

export class QueryField extends Query implements Taggable {
  protected parent: Explore;

  constructor(turtleDef: TurtleDef, parent: Explore, source?: Query) {
    super(turtleDef, parent, source);
    this.parent = parent;
  }

  tagParse(spec?: TagParseSpec) {
    spec = addModelScope(spec, this.parent.modelTag);
    return annotationToTag(this.turtleDef.annotation, spec);
  }

  getTaglines(prefix?: RegExp) {
    return annotationToTaglines(this.turtleDef.annotation, prefix);
  }

  public isQueryField(): this is QueryField {
    return true;
  }

  public isExploreField(): this is ExploreField {
    return false;
  }

  public isAtomicField(): this is AtomicField {
    return false;
  }

  public get sourceClasses(): string[] {
    const sourceField = this.turtleDef.name || this.turtleDef.as;
    return sourceField ? [sourceField] : [];
  }

  public hasParentExplore(): this is Field {
    return true;
  }

  get parentExplore(): Explore {
    return this.parent;
  }

  get expression(): string {
    return this.name;
  }
}

// =============================================================================
// ExploreField
// =============================================================================

export class ExploreField extends Explore {
  protected _parentExplore: Explore;

  constructor(structDef: StructDef, parentExplore: Explore, source?: Explore) {
    super(structDef, parentExplore, source);
    this._parentExplore = parentExplore;
  }

  public get joinRelationship(): JoinRelationship {
    if (isJoined(this.structDef)) {
      switch (this.structDef.join) {
        case 'one':
          return JoinRelationship.OneToOne;
        case 'many':
        case 'cross':
          return JoinRelationship.ManyToOne;
      }
    }
    throw new Error('A source field must have a join relationship.');
  }

  public get isRecord(): boolean {
    return this.joinRelationship === JoinRelationship.OneToOne;
  }

  public get isArray(): boolean {
    return this.joinRelationship !== JoinRelationship.OneToOne;
  }

  override tagParse(spec?: TagParseSpec) {
    spec = addModelScope(spec, this._parentExplore.modelTag);
    return annotationToTag(this._structDef.annotation, spec);
  }

  public isQueryField(): this is QueryField {
    return false;
  }

  public isExploreField(): this is ExploreField {
    return true;
  }

  public isAtomicField(): this is AtomicField {
    return false;
  }

  public get parentExplore(): Explore {
    return this._parentExplore;
  }

  public get sourceClasses(): string[] {
    const sourceField = this.structDef.name || this.structDef.as;
    return sourceField ? [sourceField] : [];
  }

  public get queryTimezone(): string | undefined {
    if (isRecordOrRepeatedRecord(this._structDef)) {
      return this._structDef.queryTimezone;
    }
    return super.queryTimezone;
  }
}

// =============================================================================
// Model
// =============================================================================

export class Model implements Taggable {
  private readonly references: ReferenceList;
  private _queryModel?: QueryModel;

  constructor(
    private modelDef: ModelDef,
    readonly problems: LogMessage[],
    readonly fromSources: string[],
    existingQueryModel?: QueryModel
  ) {
    this.references = new ReferenceList(
      fromSources[0] ?? '',
      modelDef.references ?? []
    );
    this._queryModel = existingQueryModel;
  }

  get queryModel(): QueryModel {
    if (!this._queryModel) {
      this._queryModel = new QueryModel(this.modelDef);
    }
    return this._queryModel;
  }

  /**
   * Returns the cached QueryModel if it exists, without creating one.
   * Used internally to share QueryModel between Model instances when
   * the model wasn't modified (only queries were added).
   */
  getExistingQueryModel(): QueryModel | undefined {
    return this._queryModel;
  }

  tagParse(spec?: TagParseSpec): MalloyTagParse {
    return annotationToTag(this.modelDef.annotation, spec);
  }

  getTaglines(prefix?: RegExp) {
    return annotationToTaglines(this.modelDef.annotation, prefix);
  }

  /**
   * Retrieve a document reference for the token at the given position within
   * the document that produced this model.
   *
   * @param position A position within the document.
   * @return A `DocumentReference` at that position if one exists.
   */
  public getReference(
    position: ModelDocumentPosition
  ): DocumentReference | undefined {
    return this.references.find(position);
  }

  /**
   * Retrieve an import for the token at the given position within
   * the document that produced this model.
   *
   * @param position A position within the document.
   * @return An `ImportLocation` at that position if one exists.
   */
  public getImport(
    position: ModelDocumentPosition
  ): ImportLocation | undefined {
    return this.modelDef.imports?.find(i =>
      locationContainsPosition(i.location, position)
    );
  }

  /**
   * Retrieve a prepared query by the name of a query at the top level of the model.
   *
   * @param queryName Name of the query to retrieve.
   * @return A prepared query.
   */
  public getPreparedQueryByName(queryName: string): PreparedQuery {
    const query = this.modelDef.contents[queryName];
    if (query?.type === 'query') {
      return new PreparedQuery(query, this, this.problems, queryName);
    }

    throw new Error('Given query name does not refer to a named query.');
  }

  /**
   * Retrieve a prepared query by the index of an unnamed query at the top level of a model.
   *
   * @param index The index of the query to retrieve.
   * @return A prepared query.
   */
  public getPreparedQueryByIndex(index: number): PreparedQuery {
    if (index < 0) {
      throw new Error(`Invalid index ${index}.`);
    } else if (index >= this.modelDef.queryList.length) {
      throw new Error(`Query index ${index} is out of bounds.`);
    }
    return new PreparedQuery(
      this.modelDef.queryList[index],
      this,
      this.problems
    );
  }

  /**
   * Retrieve a prepared query for the final unnamed query at the top level of a model.
   *
   * @return A prepared query.
   */
  public get preparedQuery(): PreparedQuery {
    return this.getPreparedQuery();
  }

  /**
   * Retrieve a prepared query for the final unnamed query at the top level of a model.
   *
   * @return A prepared query.
   */
  public getPreparedQuery(): PreparedQuery {
    if (this.modelDef.queryList.length === 0) {
      throw new Error('Model has no queries.');
    }
    return new PreparedQuery(
      this.modelDef.queryList[this.modelDef.queryList.length - 1],
      this,
      this.problems
    );
  }

  /**
   * Retrieve an `Explore` from the model by name.
   *
   * @param name The name of the `Explore` to retrieve.
   * @return An `Explore`.
   */
  public getExploreByName(name: string): Explore {
    const struct = this.modelDef.contents[name];
    if (struct && isSourceDef(struct)) {
      return new Explore(struct);
    }
    throw new Error("'name' is not an explore");
  }

  /**
   * Get an array of `Explore`s contained in the model.
   *
   * @return An array of `Explore`s contained in the model.
   */
  public get explores(): Explore[] {
    return Object.values(this.modelDef.contents)
      .filter(isSourceDef)
      .map(structDef => new Explore(structDef));
  }

  /**
   * Get an array of `NamedQueryDef`s contained in the model.
   *
   * @return An array of `NamedQueryDef`s contained in the model.
   */
  public get namedQueries(): NamedQueryDef[] {
    const isNamedQueryDef = (
      object: NamedModelObject
    ): object is NamedQueryDef => object.type === 'query';

    return Object.values(this.modelDef.contents).filter(isNamedQueryDef);
  }

  public get exportedExplores(): Explore[] {
    return this.explores.filter(explore =>
      this.modelDef.exports.includes(explore.name)
    );
  }

  public get _modelDef(): ModelDef {
    return this.modelDef;
  }

  /**
   * Get a named query from the model.
   *
   * @param name The name of the query to retrieve.
   * @return A `NamedQuery` for the requested query.
   * @throws Error if the name does not refer to a named query.
   */
  public getNamedQuery(name: string): NamedQuery {
    const query = this.modelDef.contents[name];
    if (query?.type === 'query') {
      return new NamedQuery(query as NamedQueryDef, this);
    }
    throw new Error(`'${name}' does not refer to a named query.`);
  }

  /**
   * Get all named queries in the model as `NamedQuery` instances.
   *
   * @return An array of `NamedQuery` instances.
   */
  public getNamedQueries(): NamedQuery[] {
    const queries: NamedQuery[] = [];
    for (const [, obj] of Object.entries(this.modelDef.contents)) {
      if (obj?.type === 'query') {
        queries.push(new NamedQuery(obj as NamedQueryDef, this));
      }
    }
    return queries;
  }

  /**
   * Get all queries marked with #@ persist annotation.
   *
   * @return An array of `NamedQuery` instances for queries with persist annotation.
   */
  public getPersistQueries(): NamedQuery[] {
    return this.getNamedQueries().filter(q => {
      const parsed = q.tagParse({prefix: /^#@ /});
      return parsed.tag.has('persist');
    });
  }

  /**
   * Get the build graphs for all #@ persist queries.
   *
   * Each graph contains queries for a single connection. Queries in the same
   * level can be built in parallel, levels must be built sequentially.
   *
   * Graphs are returned in file order. Builders can group by connectionName
   * to parallelize across different database connections.
   *
   * @param connections Connection lookup for computing digests.
   * @return Array of BuildGraphs, ordered by file position.
   */
  public async getBuildGraphs(
    connections: LookupConnection<Connection>
  ): Promise<BuildGraph[]> {
    const persistQueries = this.getPersistQueries();
    const persistQueryNames = persistQueries.map(q => q.name);

    if (persistQueryNames.length === 0) {
      return [];
    }

    // Build internal graph (sync, model layer)
    const internalGraph = buildInternalGraph(persistQueryNames, this.modelDef);

    // Compute digests and collect connection info (async - needs connection lookup)
    const digestMap = this.queryModel.persistedQueryDigests;
    const connectionMap: Record<string, string> = {}; // name -> connectionName
    for (const level of internalGraph) {
      for (const node of level) {
        const namedQuery = this.getNamedQuery(node.name);
        const sql = namedQuery.getPreparedResult().sql;
        const connectionName = namedQuery.connectionName;
        connectionMap[node.name] = connectionName;
        const connection = await connections.lookupConnection(connectionName);
        digestMap[node.name] = makeDigest(connection.getDigest(), sql);
      }
    }

    // Find leaf nodes (queries not depended upon by any other persist query)
    const dependedUpon = new Set<string>();
    for (const level of internalGraph) {
      for (const node of level) {
        for (const dep of node.dependsOn) {
          dependedUpon.add(dep);
        }
      }
    }

    // Build leaf nodes, preserving file order
    const leafNodes: Array<{node: BuildNode; connectionName: string}> = [];
    for (const level of internalGraph) {
      for (const node of level) {
        if (!dependedUpon.has(node.name)) {
          leafNodes.push({
            connectionName: connectionMap[node.name],
            node: {
              id: {
                name: node.name,
                queryDigest: digestMap[node.name],
              },
              dependsOn: node.dependsOn.map(dep => ({
                name: dep,
                queryDigest: digestMap[dep],
              })),
            },
          });
        }
      }
    }

    // Return one graph per leaf, preserving order
    return leafNodes.map(({connectionName, node}) => ({
      connectionName,
      nodes: [[node]],
    }));
  }

  /**
   * Get the computed query digests (name → digest map).
   * Must be called after getBuildGraphs() which computes the digests.
   *
   * @return Map from query name to digest
   */
  public getQueryDigests(): Record<string, string> {
    return this.queryModel.persistedQueryDigests;
  }
}

// =============================================================================
// NamedQuery
// =============================================================================

/**
 * A named query from a compiled Model.
 *
 * Provides access to query identity, SQL generation, and metadata needed
 * for building and caching query results. This is the primary object for
 * working with named queries in the foundation API.
 */
export class NamedQuery implements Taggable {
  constructor(
    private readonly def: NamedQueryDef,
    private readonly model: Model
  ) {}

  /**
   * The name of this query.
   */
  get name(): string {
    return this.def.name;
  }

  /**
   * The annotation on this query.
   */
  get annotation(): Annotation | undefined {
    return this.def.annotation;
  }

  /**
   * Parse the query's tags.
   */
  tagParse(spec?: TagParseSpec): MalloyTagParse {
    const modelScope = annotationToTag(this.model._modelDef.annotation).tag;
    spec = addModelScope(spec, modelScope);
    return annotationToTag(this.def.annotation, spec);
  }

  /**
   * Get annotation taglines matching an optional prefix.
   */
  getTaglines(prefix?: RegExp): string[] {
    return annotationToTaglines(this.def.annotation, prefix);
  }

  /**
   * The source definition for this query.
   */
  private get sourceDef(): SourceDef {
    const structRef = this.def.structRef;
    const modelDef = this.model._modelDef;
    const source =
      typeof structRef === 'string' ? modelDef.contents[structRef] : structRef;
    if (!isSourceDef(source)) {
      throw new Error('Invalid source for query');
    }
    return source;
  }

  /**
   * The connection name for this query's source.
   */
  get connectionName(): string {
    return this.sourceDef.connection;
  }

  /**
   * The dialect name for this query's source.
   */
  get dialectName(): string {
    return this.sourceDef.dialect;
  }

  /**
   * The dialect for this query's source.
   */
  get dialect(): Dialect {
    return getDialect(this.dialectName);
  }

  /**
   * Get the digest for this query from the QueryModel's digest map.
   * Returns undefined if digests haven't been computed yet.
   */
  getDigest(): string | undefined {
    return this.model.queryModel.persistedQueryDigests[this.name];
  }

  /**
   * Generate the SQL for this query.
   *
   * @param options - Compile options including buildManifest for persistence.
   * @return A PreparedResult containing the generated SQL.
   */
  getPreparedResult(options?: CompileQueryOptions): PreparedResult {
    const queryModel = this.model.queryModel;
    const translatedQuery = queryModel.compileQuery(this.def, options);
    return new PreparedResult(
      {
        ...translatedQuery,
        queryName: this.name,
      },
      this.model._modelDef
    );
  }

  /**
   * Get the underlying query definition.
   */
  get _queryDef(): NamedQueryDef {
    return this.def;
  }

  /**
   * Get the Model this query belongs to.
   */
  get _model(): Model {
    return this.model;
  }
}

// =============================================================================
// PreparedQuery
// =============================================================================

export class PreparedQuery implements Taggable {
  public _query: InternalQuery | NamedQueryDef;

  constructor(
    query: InternalQuery,
    private _model: Model,
    public problems: LogMessage[],
    public name?: string
  ) {
    this._query = query;
  }

  public get _modelDef(): ModelDef {
    return this._model._modelDef;
  }

  tagParse(spec?: TagParseSpec) {
    const modelScope = annotationToTag(this._modelDef.annotation).tag;
    spec = addModelScope(spec, modelScope);
    return annotationToTag(this._query.annotation, spec);
  }

  getTaglines(prefix?: RegExp) {
    return annotationToTaglines(this._query.annotation, prefix);
  }

  /**
   * Generate the SQL for this query.
   *
   * @return A fully-prepared query (which contains the generated SQL).
   */
  public get preparedResult(): PreparedResult {
    return this.getPreparedResult();
  }

  /**
   * Generate the SQL for this query.
   *
   * @return A fully-prepared query (which contains the generated SQL).
   * @param options.eventStream An event stream to use when compiling the SQL
   */
  public getPreparedResult(options?: CompileQueryOptions): PreparedResult {
    const queryModel = this._model.queryModel;
    const translatedQuery = queryModel.compileQuery(this._query, options);
    return new PreparedResult(
      {
        ...translatedQuery,
        queryName: this.name || translatedQuery.queryName,
      },
      this._modelDef
    );
  }

  public get dialect(): string {
    const sourceRef = this._query.structRef;
    const source =
      typeof sourceRef === 'string'
        ? this._modelDef.contents[sourceRef]
        : sourceRef;
    if (!isSourceDef(source)) {
      throw new Error('Invalid source for query');
    }
    return source.dialect;
  }

  /**
   * Get the flattened version of a query -- one that does not have a `pipeHead`.
   * @deprecated Because queries can no longer have `pipeHead`s.
   */
  public getFlattenedQuery(_defaultName: string): PreparedQuery {
    return this;
  }

  /**
   * Get the Model this query belongs to.
   */
  public get model(): Model {
    return this._model;
  }
}

// =============================================================================
// PreparedResult
// =============================================================================

export class PreparedResult implements Taggable {
  protected inner: CompiledQuery;

  constructor(
    query: CompiledQuery,
    protected modelDef: ModelDef
  ) {
    this.inner = query;
  }

  public static fromJson({
    query,
    modelDef,
  }: PreparedResultJSON): PreparedResult {
    if (!query || !modelDef) {
      throw new Error('Missing required properties in JSON data');
    }
    return new PreparedResult(query, modelDef);
  }

  tagParse(spec?: TagParseSpec): MalloyTagParse {
    const modelScope = annotationToTag(this.modelDef.annotation).tag;
    spec = addModelScope(spec, modelScope);
    return annotationToTag(this.inner.annotation, spec);
  }

  getTaglines(prefix?: RegExp) {
    return annotationToTaglines(this.inner.annotation, prefix);
  }

  get annotation(): Annotation | undefined {
    return this.inner.annotation;
  }

  get modelAnnotation(): Annotation | undefined {
    return this.modelDef.annotation;
  }

  get modelTag(): Tag {
    return annotationToTag(this.modelDef.annotation).tag;
  }

  /**
   * @return The name of the connection this query should be run against.
   */
  public get connectionName(): string {
    return this.inner.connectionName;
  }

  public get _rawQuery(): CompiledQuery {
    return this.inner;
  }

  public get _modelDef(): ModelDef {
    return this.modelDef;
  }

  /**
   * @return The SQL that should be run against the SQL runner
   * with the connection name `this.getConnectionName()`.
   */
  public get sql(): string {
    return this.inner.sql;
  }

  /**
   * @return The `Explore` representing the data that will be returned by running this query.
   */
  public get resultExplore(): Explore {
    if (this.inner.structs.length === 0) {
      throw new Error('Malformed query result.');
    }
    const explore = this.inner.structs[this.inner.structs.length - 1];
    const namedExplore = {
      ...explore,
      annotation: this.inner.annotation,
      name: this.inner.queryName || explore.name,
    };
    try {
      return new Explore(namedExplore, this.sourceExplore);
    } catch (error) {
      return new Explore(namedExplore);
    }
  }

  public get sourceExplore(): Explore | undefined {
    const name = this.inner.sourceExplore;
    const explore = this.modelDef.contents[name];
    if (explore && isSourceDef(explore)) {
      return new Explore(explore);
    }
  }

  public get _sourceExploreName(): string {
    return this.inner.sourceExplore;
  }

  public get _sourceArguments(): Record<string, Argument> | undefined {
    return this.inner.sourceArguments;
  }

  public get _sourceFilters(): FilterCondition[] {
    return this.inner.sourceFilters || [];
  }

  /**
   * @return Whether this result has a schema. DDL statements (INSTALL, LOAD,
   * CREATE SECRET, etc.) do not return a schema.
   */
  public get hasSchema(): boolean {
    return this.inner.structs.length > 0;
  }
}
