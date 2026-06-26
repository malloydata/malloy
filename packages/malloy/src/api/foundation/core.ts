/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {LogMessage} from '../../lang';
import type {
  BuildID,
  CompiledQuery,
  ConstantExpr,
  DocumentLocation,
  BooleanFieldDef,
  JSONFieldDef,
  NumberFieldDef,
  StringFieldDef,
  FilterCondition,
  Expr,
  Given as InternalGiven,
  GivenID,
  GivenTypeDef,
  GivenValue,
  Query as InternalQuery,
  Pipeline,
  ModelDef,
  DocumentPosition as ModelDocumentPosition,
  NamedQueryDef,
  StructDef,
  TurtleDef,
  NativeUnsupportedFieldDef,
  ImportLocation,
  AnnotationsDef,
  ModelAnnotationEntry,
  ModelID,
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
  PersistableSourceDef,
  PrepareResultOptions,
} from '../../model';
import {
  activeName,
  fieldIsIntrinsic,
  QueryModel,
  expressionIsCalculation,
  isAtomicFieldType,
  isSourceDef,
  isJoined,
  isRecordOrRepeatedRecord,
  isPersistableSourceDef,
  getCompiledSQL,
  getModelAnnotations,
  safeRecordGet,
  predicateExprToSQL,
} from '../../model';
import {mkModelDef} from '../../model/utils';
import type {Dialect} from '../../dialect';
import {getDialect} from '../../dialect';
import type {BuildGraph, BuildNode, CompileQueryOptions} from './types';
import {
  findPersistentDependencies,
  minimalBuildGraph,
} from '../../model/persist_utils';
import {
  resolveSourceID,
  sourceNamespaceReference,
  mkBuildID,
} from '../../model/source_def_utils';
import {
  evaluateInlineGivens,
  resolveSuppliedGivens,
} from '../../model/given_binding';
import {Tag} from '@malloydata/malloy-tag';
import type {MalloyTagParse, TagParseSpec} from './annotation';
import {annotationToTag, annotationToTaglines, Annotations} from './annotation';
import type * as Malloy from '@malloydata/malloy-interfaces';
import {
  convertFieldInfos,
  getResultStructMetadataAnnotation,
  toStableAnnotations,
  writeLiteralToTag,
} from '../../to_stable';
import {nodeToLiteralValue} from '../util';
import {locationContainsPosition} from '../../lang/utils';
import {ReferenceList} from '../../lang/reference-list';
import type {Taggable} from './taggable';

type ComponentSourceDef = TableSourceDef | SQLSourceDef | QuerySourceDef;
function isSourceComponent(source: StructDef): source is ComponentSourceDef {
  return (
    source.type === 'table' ||
    source.type === 'sql_select' ||
    source.type === 'query_source'
  );
}

/**
 * A synthetic single-source model for an `Explore` that has no real model in
 * hand — the deserialization (`Explore.fromJSON`) and raw-SQL-block paths.
 * Wraps just the one struct so SQL generation has something to compile
 * against.
 *
 * `modelID` + `modelAnnotations` reconstitute the model-annotation closure:
 * `fromJSON` passes the values captured by `toJSON` so a deserialized Explore
 * folds its model annotations exactly as the live one did. The raw-SQL-block
 * and default paths pass nothing and get an empty map (the honest answer for a
 * genuinely detached struct). The default constant `modelID` (rather than
 * `mkModelDef`'s random one) keeps `fromJSON(x.toJSON())` deep-equal to `x` for
 * the no-annotations case.
 */
const GENERATED_MODEL_ID = 'internal://generated-model';
export function pseudoModelFor(
  structDef: StructDef,
  modelID: ModelID = GENERATED_MODEL_ID,
  modelAnnotations: Record<ModelID, ModelAnnotationEntry> = {}
): ModelDef {
  if (!isSourceDef(structDef)) {
    throw new Error(
      `Cannot create pseudo model for struct type ${structDef.type}`
    );
  }
  const def = mkModelDef('generated_model', modelID);
  def.modelAnnotations = modelAnnotations;
  def.contents[structDef.name] = structDef;
  return def;
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
  /** Owner model id + annotation closure, so a deserialized Explore folds
   *  model annotations as the live one did. */
  modelID: ModelID;
  modelAnnotations: Record<ModelID, ModelAnnotationEntry>;
  sourceExplore?: SerializedExplore;
  _parentExplore?: SerializedExplore;
};

export type SortableField = {field: Field; dir: 'asc' | 'desc' | undefined};

export type PreparedResultJSON = {
  query: CompiledQuery;
  modelDef: ModelDef;
};

/**
 * Identifier-only enumeration of a model's top-level queries.
 * Internal: returned by `Model.queries()`, not exported. Callers pair
 * the names with `getPreparedQueryByName` and the indices `0..unnamed-1`
 * with `getPreparedQueryByIndex` to load any one of them.
 */
interface ModelQueries {
  named: string[];
  unnamed: number;
}

// =============================================================================
// Explore
// =============================================================================

export class Explore extends Entity implements Taggable {
  protected readonly _structDef: StructDef;
  protected readonly _parentExplore?: Explore;
  private readonly _ownerModelDef: ModelDef;
  private _fieldMap: Map<string, Field> | undefined;
  private sourceExplore: Explore | undefined;
  private _allFieldsWithOrder: SortableField[] | undefined;

  constructor(
    modelDef: ModelDef,
    structDef: StructDef,
    parentExplore?: Explore,
    source?: Explore
  ) {
    super(activeName(structDef), parentExplore, source);
    this._ownerModelDef = modelDef;
    this._structDef = structDef;
    this._parentExplore = parentExplore;
    this.sourceExplore = source;
  }

  /** The model this Explore was resolved in. For detached Explores
   *  (`fromJSON`, raw SQL block) this is a synthetic single-source model
   *  with no model annotations. Read by child fields to resolve their own
   *  model annotations. */
  public get _modelDef(): ModelDef {
    return this._ownerModelDef;
  }

  public get source(): Explore | undefined {
    return this.sourceExplore;
  }

  /**
   * THIS IS A HIGHLY EXPERIMENTAL API AND MAY VANISH OR CHANGE WITHOUT NOTICE
   *
   * If this source was created as an unmodified reference to another source, a
   * stable identifier of the source it refers to; undefined when this source
   * defines its own shape. Two sources that refer to the same thing share this
   * id, so it can be compared to tell whether two otherwise un-nameable sources
   * are the same — even when the referenced source can't be named here.
   */
  public get referenceSourceID(): string | undefined {
    return isSourceDef(this._structDef)
      ? this._structDef.referenceID
      : undefined;
  }

  /**
   * THIS IS A HIGHLY EXPERIMENTAL API AND MAY VANISH OR CHANGE WITHOUT NOTICE
   *
   * If this source was created as an unmodified reference to a source that is in
   * this model's namespace (`source: a is b`, or a plain join), return that
   * source as it appears in the namespace — read `.name` for the name it goes by
   * here. Returns undefined when this source defines its own shape (a table,
   * SQL, query, or modified/extended source), or when the referenced source is
   * not in this model's namespace.
   */
  public referencedSource(): Explore | undefined {
    if (!isSourceDef(this._structDef)) return undefined;
    const ref = sourceNamespaceReference(this._ownerModelDef, this._structDef);
    return ref ? new Explore(this._ownerModelDef, ref.source) : undefined;
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

  /** @deprecated Use `.annotations.parseAsTag(route)`. */
  tagParse(spec?: TagParseSpec): MalloyTagParse {
    return annotationToTag(this._structDef.annotations, spec);
  }

  /** @deprecated Use `.annotations.texts(route)`. */
  getTaglines(prefix?: RegExp): string[] {
    return annotationToTaglines(this._structDef.annotations, prefix);
  }

  get annotations(): Annotations {
    return new Annotations(this._structDef.annotations);
  }

  /** The model annotations resolved for this object. */
  get modelAnnotations(): Annotations {
    return new Annotations(getModelAnnotations(this._ownerModelDef));
  }

  private parsedModelTag?: Tag;
  /**
   * @deprecated Use `.modelAnnotations.parseAsTag(route)`.
   */
  public get modelTag(): Tag {
    this.parsedModelTag ||= this.modelAnnotations.parseAsTag().tag;
    return this.parsedModelTag;
  }

  /**
   * @return The name of the entity.
   */
  public get name(): string {
    return activeName(this.structDef);
  }

  public getQueryByName(name: string): PreparedQuery {
    const structRef = this.sourceStructDef;
    if (!structRef) {
      throw new Error(
        `Cannot get query by name from a struct of type ${this.structDef.type}`
      );
    }
    const view = structRef.fields.find(f => activeName(f) === name);
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

  public getSingleExploreModel(): Model {
    return new Model(this._ownerModelDef, [], []);
  }

  private get fieldMap(): Map<string, Field> {
    if (this._fieldMap === undefined) {
      const sourceFields = this.source?.fieldMap || new Map();
      this._fieldMap = new Map(
        this.structDef.fields.map(fieldDef => {
          const name = activeName(fieldDef);
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

  private requireGivensExperiment(method: string): void {
    // Read the resolved model annotations (the import/extend fold) so the flag
    // carries across `extend`, matching getBuildPlan's gate.
    const modelTag = this.modelAnnotations.parseAsTag('!').tag;
    if (!modelTag.has('experimental', 'givens')) {
      throw new Error(
        `Model must have ##! experimental.givens to use ${method}`
      );
    }
  }

  /**
   * THIS IS A HIGHLY EXPERIMENTAL API AND MAY VANISH OR CHANGE WITHOUT NOTICE
   *
   * The source-level access filters — the `where:` predicates that isolate this
   * source's data (RLAC). Unlike `.filters` (drill/result filters), these are the
   * filters marked `isSourceFilter`. Each `FilterCondition` exposes the source
   * text (`.code`), the walkable expression tree (`.e`), and pre-computed field
   * and given references (`.refSummary`) — enough to reconstruct a compound
   * predicate (`or`, cross-column), not just a per-field map.
   *
   * Requires the model to declare `##! experimental.givens`.
   */
  public get accessFilters(): FilterCondition[] {
    this.requireGivensExperiment('accessFilters');
    return (this.sourceStructDef?.filterList ?? []).filter(
      f => f.isSourceFilter
    );
  }

  /**
   * THIS IS A HIGHLY EXPERIMENTAL API AND MAY VANISH OR CHANGE WITHOUT NOTICE
   *
   * Compile this source's access predicate (see `accessFilters`) to a single
   * dialect-appropriate SQL boolean expression for a concrete set of given
   * values — a bare WHERE fragment (no `WHERE` keyword), in the source's own
   * dialect. A host splices this into its own SQL to re-apply the source's row
   * isolation when indexing rows.
   *
   * Columns are qualified with `options.tableAlias` (default `base`, which must
   * be a bare SQL identifier `[A-Za-z_][A-Za-z0-9_]*`); the caller must expose
   * the source's table under that alias. Predicates that reference a
   * joined field — directly (`orders.amount`) or via a local dimension that
   * aliases one — are rejected, since the emitted alias has no entry in the
   * caller's `FROM`; base-relative columns (including nested record columns) are
   * fine. An unsatisfied given (no supplied value and no declaration default)
   * throws, so the predicate fails closed. A source with no access filters
   * returns `'true'` (no restriction); a caller whose policy requires a predicate
   * should check `accessFilters` is non-empty first.
   *
   * Requires the model to declare `##! experimental.givens` (a bare
   * `##! experimental` is not sufficient).
   */
  public accessFilterSQL(options?: {
    givens?: Record<string, GivenValue>;
    tableAlias?: string;
  }): string {
    const filters = this.accessFilters; // also enforces the experiment gate
    const source = this.sourceStructDef;
    if (!source) {
      throw new Error(
        `Cannot get access filter SQL from a struct of type ${this.structDef.type}`
      );
    }
    // The access predicate can only be bound if this model declares every given
    // it references. A detached Explore (created via `fromJSON`/serialization)
    // carries the source and annotations but not the model's given declarations,
    // so binding would otherwise fail deep in the compiler with a confusing
    // "unknown given". Detect that here and fail with an actionable message.
    const modelGivens = this._ownerModelDef.givens ?? {};
    for (const filter of filters) {
      for (const usage of filter.refSummary?.givenUsage ?? []) {
        if (!modelGivens[usage.id]) {
          throw new Error(
            'accessFilterSQL: the access predicate references givens this ' +
              "Explore's model does not declare. This usually means the Explore " +
              'was created via fromJSON/serialization, which does not carry given ' +
              'declarations — obtain the Explore from a compiled Model instead.'
          );
        }
      }
    }
    const resolved = options?.givens
      ? resolveSuppliedGivens(options.givens, this._ownerModelDef)
      : new Map<GivenID, Expr>();
    evaluateInlineGivens(resolved, this._ownerModelDef);
    const result = predicateExprToSQL(
      source,
      filters,
      modelGivens,
      resolved.size > 0 ? resolved : undefined,
      options?.tableAlias ?? 'base'
    );
    if (result.error !== undefined) {
      throw new Error(result.error);
    }
    return result.sql;
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
      modelID: this._ownerModelDef.modelID,
      modelAnnotations: this._ownerModelDef.modelAnnotations,
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
    return new Explore(
      pseudoModelFor(
        main_explore._structDef,
        main_explore.modelID,
        main_explore.modelAnnotations
      ),
      main_explore._structDef,
      parentExplore,
      sourceExplore
    );
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
    super(activeName(fieldTypeDef), parent, source);
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

  /** @deprecated Use `.annotations.parseAsTag(route)`. */
  tagParse(spec?: TagParseSpec) {
    return annotationToTag(this.fieldTypeDef.annotations, spec);
  }

  /** @deprecated Use `.annotations.texts(route)`. */
  getTaglines(prefix?: RegExp) {
    return annotationToTaglines(this.fieldTypeDef.annotations, prefix);
  }

  get annotations(): Annotations {
    return new Annotations(this.fieldTypeDef.annotations);
  }

  /** The model annotations resolved for this field, via its parent. */
  get modelAnnotations(): Annotations {
    return new Annotations(getModelAnnotations(this.parent._modelDef));
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

export class Query extends Entity implements Taggable {
  protected turtleDef: TurtleDef;
  private sourceQuery?: Query;

  constructor(turtleDef: TurtleDef, parent?: Explore, source?: Query) {
    super(activeName(turtleDef), parent, source);
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

  /** @deprecated Use `.annotations.parseAsTag(route)`. */
  tagParse(spec?: TagParseSpec) {
    return annotationToTag(this.turtleDef.annotations, spec);
  }

  /** @deprecated Use `.annotations.texts(route)`. */
  getTaglines(prefix?: RegExp) {
    return annotationToTaglines(this.turtleDef.annotations, prefix);
  }

  get annotations(): Annotations {
    return new Annotations(this.turtleDef.annotations);
  }

  /** The model annotations resolved for this view, via its parent
   *  explore. A bare `Query` with no parent has none. */
  get modelAnnotations(): Annotations {
    const modelDef = this._parent?._modelDef;
    return new Annotations(modelDef && getModelAnnotations(modelDef));
  }
}

export class QueryField extends Query {
  protected parent: Explore;

  constructor(turtleDef: TurtleDef, parent: Explore, source?: Query) {
    super(turtleDef, parent, source);
    this.parent = parent;
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
    super(parentExplore._modelDef, structDef, parentExplore, source);
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
    return annotationToTag(this._structDef.annotations, spec);
  }

  override get annotations(): Annotations {
    return new Annotations(this._structDef.annotations);
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

/**
 * Runtime-aware concerns layered onto a `Model` after it leaves the
 * compiler. `Malloy.compile()` returns a `Model` with no context; a
 * `Runtime.loadModel()` decoration attaches the runtime's context so
 * context-sensitive views (currently `Model.givens` filtering finalized
 * names; in future, tenant overrides / session bindings / etc.) work
 * correctly. New runtime-aware concerns add a field here rather than a
 * parallel constructor parameter.
 */
export interface RuntimeContext {
  /** Surface names of givens locked at the runtime layer (from
   *  `config.finalizeGivens`). Filtered out of `Model.givens` so
   *  introspection-driven UIs don't render editors for them. */
  readonly finalizedGivens?: ReadonlySet<string>;
}

export type ReferenceKind =
  | 'field'
  | 'join'
  | 'explore'
  | 'query'
  | 'sqlBlock'
  | 'given';

const REFERENCE_KIND_BY_IR_TYPE: Record<
  DocumentReference['type'],
  ReferenceKind
> = {
  fieldReference: 'field',
  joinReference: 'join',
  exploreReference: 'explore',
  queryReference: 'query',
  sqlBlockReference: 'sqlBlock',
  givenReference: 'given',
};

/**
 * A reference to a definition found at a position in a Malloy document —
 * the Foundation view returned by {@link Model.referenceAt}. Carries the
 * use-site location (where the reference appears), the definition's
 * location (where to go for "go to definition"), the kind of entity
 * referenced, and an `annotations` view over the definition's annotations.
 *
 * Construct via {@link Model.referenceAt}; direct construction is internal.
 */
export class Reference {
  /** @internal */
  constructor(private readonly _ref: DocumentReference) {}

  /** The name as written at the use site (e.g. `"orders"`). */
  get text(): string {
    return this._ref.text;
  }

  /** What kind of entity this reference points at. */
  get kind(): ReferenceKind {
    return REFERENCE_KIND_BY_IR_TYPE[this._ref.type];
  }

  /** Where this reference appears in source. */
  get location(): DocumentLocation {
    return this._ref.location;
  }

  /** Where the definition is. Omitted for synthetic references that have
   *  no source-level definition site. */
  get definitionLocation(): DocumentLocation | undefined {
    return this._ref.definition.location;
  }

  /** The referent's type as a string (e.g. `"string"` for a string field,
   *  `"source"` for a source). Free-form text from the IR; used by IDE
   *  display to render type hints. */
  get definitionType(): string {
    return this._ref.definition.type;
  }

  /** For given references only: the textual form of the given's default
   *  expression, if one was declared. Undefined for non-given references
   *  and for givens without a default. */
  get defaultText(): string | undefined {
    if (this._ref.type === 'givenReference') {
      return this._ref.definition.defaultText;
    }
    return undefined;
  }

  /** The definition's annotations, as a view. */
  get annotations(): Annotations {
    return new Annotations(this._ref.definition.annotations);
  }
}

export class Model implements Taggable {
  private readonly references: ReferenceList;
  private _queryModel?: QueryModel;
  private readonly contentsMap: Map<string, NamedModelObject>;

  constructor(
    private modelDef: ModelDef,
    readonly problems: LogMessage[],
    readonly fromSources: string[],
    existingQueryModel?: QueryModel,
    /**
     * Runtime-aware context layered onto this Model. `Malloy.compile()`
     * leaves it undefined; `Runtime.loadModel()` paths attach the
     * runtime's context so methods like `Model.givens` filter correctly.
     */
    private readonly runtimeContext?: RuntimeContext
  ) {
    this.references = new ReferenceList(
      fromSources[0] ?? '',
      modelDef.references ?? []
    );
    this._queryModel = existingQueryModel;
    this.contentsMap = new Map(Object.entries(modelDef.contents));
  }

  /** Safe lookup in model contents by name. */
  getContent(name: string): NamedModelObject | undefined {
    return this.contentsMap.get(name);
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

  /**
   * The givens this model surfaces, keyed by caller-facing surface name.
   * Used by whole-model parameter-editor UIs to render input widgets for
   * every given the model can accept.
   */
  public get givens(): ReadonlyMap<string, Given> {
    const out = new Map<string, Given>();
    const givens = this.modelDef.givens;
    if (!givens) return out;
    for (const [surfaceName, entry] of this.contentsMap) {
      if (entry.type !== 'given') continue;
      if (this.runtimeContext?.finalizedGivens?.has(surfaceName)) continue;
      const decl = givens[entry.id];
      if (decl && !decl.inline) {
        out.set(
          surfaceName,
          new Given(surfaceName, entry.id, decl, this.modelDef)
        );
      }
    }
    return out;
  }

  /** This model's own `##` bundle (its self-entry's `ownNotes`). */
  private get _ownModelAnnotations(): AnnotationsDef | undefined {
    return this.modelDef.modelAnnotations[this.modelDef.modelID]?.ownNotes;
  }

  /** @deprecated Use `.annotations.parseAsTag(route)`. */
  tagParse(spec?: TagParseSpec): MalloyTagParse {
    return annotationToTag(this._ownModelAnnotations, spec);
  }

  /** @deprecated Use `.annotations.texts(route)`. */
  getTaglines(prefix?: RegExp) {
    return annotationToTaglines(this._ownModelAnnotations, prefix);
  }

  get annotations(): Annotations {
    return new Annotations(this._ownModelAnnotations);
  }

  /** The model annotations resolved across this model's import/extend lineage. */
  get modelAnnotations(): Annotations {
    return new Annotations(getModelAnnotations(this.modelDef));
  }

  /**
   * Retrieve a reference for the token at the given position within the
   * document that produced this model.
   *
   * @param position A position within the document.
   * @return A {@link Reference} at that position if one exists.
   */
  public referenceAt(position: ModelDocumentPosition): Reference | undefined {
    const ref = this.references.find(position);
    return ref ? new Reference(ref) : undefined;
  }

  /**
   * @deprecated Use {@link referenceAt} — returns a Foundation
   * {@link Reference} view instead of the raw IR. This method returns
   * the IR shape directly and will be removed in a future release.
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
    const query = this.getContent(queryName);
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
    const struct = this.getContent(name);
    if (struct && isSourceDef(struct)) {
      return new Explore(this.modelDef, struct);
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
      .map(structDef => new Explore(this.modelDef, structDef));
  }

  /**
   * Enumerate the model's top-level queries by identifier.
   *
   * Returns the names of named queries (`query: foo is ...`) and the count
   * of unnamed `run:` statements. Pair with {@link getPreparedQueryByName}
   * and {@link getPreparedQueryByIndex} to load any of them — those are the
   * only path to the query itself; this getter exposes only identifiers,
   * not IR.
   */
  public queries(): ModelQueries {
    const named: string[] = [];
    for (const object of Object.values(this.modelDef.contents)) {
      if (object.type === 'query') {
        named.push(object.name);
      }
    }
    return {named, unnamed: this.modelDef.queryList.length};
  }

  /**
   * @deprecated Leaks IR. Use {@link queries} for enumeration and
   *   {@link getPreparedQueryByName} to load a named query.
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
   * Get the build plan for all #@ persist sources.
   *
   * Walks through ALL queries and sources in the model, finding any persistent
   * dependencies they reference (including hidden dependencies from imports).
   *
   * Returns a BuildPlan containing:
   * - `graphs`: Build graphs for root sources only (minimal build set)
   * - `sources`: Map from sourceId to PersistSource (all persist sources)
   *
   * The minimal build set contains only "root" sources - those not depended
   * on by any other persist source. Each root includes its transitive
   * dependencies in the dependsOn field, preserving the tree structure
   * for parallel building.
   *
   * @return BuildPlan with graphs and sources map
   */
  public getBuildPlan(): BuildPlan {
    // Require experimental.persistence compiler flag. Read the resolved model
    // annotations (`.modelAnnotations`, the import/extend fold) rather than this
    // model's own `##` so the flag carries across extend.
    const modelTag = this.modelAnnotations.parseAsTag('!').tag;
    if (!modelTag.has('experimental', 'persistence')) {
      throw new Error(
        'Model must have ##! experimental.persistence to use getBuildPlan()'
      );
    }

    const allDeps: BuildNode[] = [];
    const tagParseLog: LogMessage[] = [];

    // Walk all objects in the model to find persistent dependencies
    for (const obj of Object.values(this.modelDef.contents)) {
      if (obj.type === 'query' || isSourceDef(obj)) {
        allDeps.push(
          ...findPersistentDependencies(obj, this.modelDef, tagParseLog)
        );
      }
    }

    // Also walk queryList (unnamed queries)
    for (const query of this.modelDef.queryList) {
      allDeps.push(
        ...findPersistentDependencies(query, this.modelDef, tagParseLog)
      );
    }

    if (allDeps.length === 0) {
      return {graphs: [], sources: {}, tagParseLog};
    }

    // Find the minimal set of root graphs
    const rootNodes = minimalBuildGraph(allDeps);

    // Build the sources map from all persistent sourceIDs encountered
    const sourcesMap: Record<string, PersistSource> = {};
    const collectSources = (nodes: BuildNode[]) => {
      for (const node of nodes) {
        if (!(node.sourceID in sourcesMap)) {
          const sourceDef = resolveSourceID(this.modelDef, node.sourceID);
          if (sourceDef) {
            sourcesMap[node.sourceID] = new PersistSource(
              new Explore(this.modelDef, sourceDef),
              this
            );
          }
        }
        collectSources(node.dependsOn);
      }
    };
    collectSources(rootNodes);

    // Group root nodes by connection
    const graphsByConnection = new Map<string, BuildNode[]>();
    for (const node of rootNodes) {
      const persistSource = sourcesMap[node.sourceID];
      if (!persistSource) continue;

      const connName = persistSource.connectionName;
      if (!graphsByConnection.has(connName)) {
        graphsByConnection.set(connName, []);
      }
      graphsByConnection.get(connName)!.push(node);
    }

    // Convert to BuildGraph array
    const graphs: BuildGraph[] = [];
    for (const [connectionName, nodes] of graphsByConnection) {
      graphs.push({connectionName, nodes: [nodes]});
    }

    return {graphs, sources: sourcesMap, tagParseLog};
  }
}

// =============================================================================
// Build Plan Types (for persistence)
// =============================================================================

/**
 * The complete build plan for persistent sources in a model.
 *
 * Returned by `Model.getBuildPlan()`. Contains:
 * - `graphs`: Dependency-ordered build graphs grouped by connection
 * - `sources`: Map from sourceId to PersistSource for accessing source details
 */
export interface BuildPlan {
  /** Build graphs grouped by connection, with leveled nodes for parallel execution */
  graphs: BuildGraph[];
  /** Map from sourceId to PersistSource for accessing source details */
  sources: Record<string, PersistSource>;
  /** Errors and warnings from parsing #@ annotations on persistable sources */
  tagParseLog: LogMessage[];
}

// =============================================================================
// PersistSource
// =============================================================================

/**
 * A wrapper around a source that has #@ persist annotation.
 *
 * Only sources backed by queries can be persisted:
 * - `query_source`: `source: x is y -> {...}`
 * - `sql_select`: `source: x is conn.sql("...")`
 *
 * Provides access to source identity, SQL generation, and metadata needed
 * for building and caching source results.
 */
export class PersistSource implements Taggable {
  private readonly persistableDef: PersistableSourceDef;

  constructor(
    private readonly explore: Explore,
    private readonly model: Model
  ) {
    const sd = explore.structDef;
    if (!isSourceDef(sd)) {
      throw new Error('Cannot create PersistSource from non-source type');
    }
    if (!isPersistableSourceDef(sd)) {
      throw new Error(
        `Cannot persist source '${explore.name}' of type '${sd.type}'. ` +
          'Only query_source and sql_select sources can be persisted.'
      );
    }
    this.persistableDef = sd;
  }

  /**
   * The name of this source.
   */
  get name(): string {
    return this.explore.name;
  }

  /**
   * The stable identity of this source: "sourceName@modelURL".
   * Used as lookup key during compilation and in build graphs.
   */
  get sourceID(): string {
    const id = this.persistableDef.sourceID;
    if (!id) {
      throw new Error(
        `PersistSource '${this.name}' has no sourceID. ` +
          'This should not happen - sourceID is set at translation time.'
      );
    }
    return id;
  }

  /**
   * The underlying Explore.
   */
  get _explore(): Explore {
    return this.explore;
  }

  /**
   * @deprecated Hands out raw IR (`AnnotationsDef`). Use `.annotations`
   * (returns the {@link Annotations} view). Slated for removal once
   * external consumers migrate.
   */
  get annotation(): AnnotationsDef | undefined {
    return this.persistableDef.annotations;
  }

  /** @deprecated Use `.annotations.parseAsTag(route)`. */
  tagParse(spec?: TagParseSpec): MalloyTagParse {
    return this.explore.tagParse(spec);
  }

  /** @deprecated Use `.annotations.texts(route)`. */
  getTaglines(prefix?: RegExp): string[] {
    return this.explore.getTaglines(prefix);
  }

  get annotations(): Annotations {
    return this.explore.annotations;
  }

  /** The model annotations resolved for this source. */
  get modelAnnotations(): Annotations {
    return this.explore.modelAnnotations;
  }

  /**
   * The connection name for this source.
   */
  get connectionName(): string {
    return this.persistableDef.connection;
  }

  /**
   * The dialect name for this source.
   */
  get dialectName(): string {
    return this.persistableDef.dialect;
  }

  /**
   * The dialect for this source.
   */
  get dialect(): Dialect {
    return getDialect(this.dialectName);
  }

  /**
   * Compute the BuildID for this source.
   *
   * BuildID is a hash of the connection config and SQL content.
   * Different connection configs or SQL changes produce different BuildIDs.
   *
   * @param connectionDigest - Digest from connection.getDigest()
   * @param sql - The SQL for this source (from getSQL())
   * @return The BuildID for manifest lookup
   */
  makeBuildId(connectionDigest: string, sql: string): BuildID {
    return mkBuildID(connectionDigest, sql);
  }

  /**
   * Get the SQL for this persist source.
   *
   * For sql_select sources, returns the SQL string (with segment expansion).
   * For query_source sources, compiles the inner query to SQL.
   *
   * @param options - Compile options including buildManifest for persistence.
   * @return The SQL string for this source.
   */
  getSQL(options?: CompileQueryOptions): string {
    const sd = this.persistableDef;
    const queryModel = this.model.queryModel;

    if (sd.type === 'sql_select') {
      return getCompiledSQL(
        sd,
        options ?? {},
        (query, opts) => queryModel.compileQuery(query, opts).sql
      );
    } else {
      const compiled = queryModel.compileQuery(sd.query, options);
      return compiled.sql;
    }
  }

  /**
   * Get the underlying persistable source definition.
   */
  get _sourceDef(): PersistableSourceDef {
    return this.persistableDef;
  }

  /**
   * Get the Model this source belongs to.
   */
  get _model(): Model {
    return this.model;
  }
}

// =============================================================================
// PreparedQuery
// =============================================================================

/**
 * Foundation API wrapper for a given declaration. Parallel to Explore /
 * PreparedQuery — exposes a stable, callerable surface over the internal
 * `Given` IR record. Returned from `PreparedQuery.givens`.
 */
export class Given implements Taggable {
  /**
   * @param name        Caller-facing surface name in the model (post-rename
   *                    on import). The key by which the caller passes a
   *                    value to `.run({givens: {[name]: ...}})`.
   * @param id          Global GivenID. Stable across imports and renames.
   * @param _internal   The internal Given declaration record.
   * @param _modelDef   The model this given is declared in, for resolving
   *                    its model annotations.
   */
  constructor(
    readonly name: string,
    readonly id: GivenID,
    private readonly _internal: InternalGiven,
    private readonly _modelDef: ModelDef
  ) {}

  get type(): GivenTypeDef {
    return this._internal.type;
  }

  /** `undefined` when no default — the caller must supply at run time. */
  get default(): ConstantExpr | undefined {
    return this._internal.default;
  }

  get location(): DocumentLocation | undefined {
    return this._internal.location;
  }

  /** @deprecated Use `.annotations.parseAsTag(route)`. */
  tagParse(spec?: TagParseSpec): MalloyTagParse {
    return annotationToTag(this._internal.annotations, spec);
  }

  /** @deprecated Use `.annotations.texts(route)`. */
  getTaglines(prefix?: RegExp): string[] {
    return annotationToTaglines(this._internal.annotations, prefix);
  }

  get annotations(): Annotations {
    return new Annotations(this._internal.annotations);
  }

  /** The model annotations resolved for this given. */
  get modelAnnotations(): Annotations {
    return new Annotations(getModelAnnotations(this._modelDef));
  }
}

/**
 * Internal abstract base for Foundation wrappers around an IR `Pipeline`
 * (an IR object that has a pipeline, annotations, and a source location).
 * Owns the four `Taggable` accessors and a `location` getter, all reading
 * from the wrapped IR. Not exported.
 */
abstract class PipelineBase implements Taggable {
  constructor(protected pipelineDef: Pipeline) {}

  get annotations(): Annotations {
    return new Annotations(this.pipelineDef.annotations);
  }

  /** Resolved model annotations. Abstract because the base has no
   *  model in hand — subclasses that carry one supply the resolution. */
  abstract get modelAnnotations(): Annotations;

  get location(): DocumentLocation | undefined {
    return this.pipelineDef.location;
  }

  /** @deprecated Use `.annotations.parseAsTag(route)`. */
  tagParse(spec?: TagParseSpec): MalloyTagParse {
    return annotationToTag(this.pipelineDef.annotations, spec);
  }

  /** @deprecated Use `.annotations.texts(route)`. */
  getTaglines(prefix?: RegExp): string[] {
    return annotationToTaglines(this.pipelineDef.annotations, prefix);
  }
}

export class PreparedQuery extends PipelineBase {
  constructor(
    query: InternalQuery,
    private _model: Model,
    public problems: LogMessage[],
    public name?: string
  ) {
    super(query);
  }

  public get _query(): InternalQuery | NamedQueryDef {
    return this.pipelineDef as InternalQuery | NamedQueryDef;
  }

  public get _modelDef(): ModelDef {
    return this._model._modelDef;
  }

  /** The model annotations resolved for this query's head. */
  get modelAnnotations(): Annotations {
    return new Annotations(getModelAnnotations(this._modelDef));
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
    // Build the resolved-givens map in two phases:
    //   1. caller-supplied values (resolveSuppliedGivens)
    //   2. inline-given defaults eager-evaluated against the map
    // Result is undefined when no values land — preserves the previous
    // "no givens path" downstream.
    const resolved = options?.givens
      ? resolveSuppliedGivens(options.givens, this._modelDef)
      : new Map<GivenID, Expr>();
    evaluateInlineGivens(resolved, this._modelDef);
    const prepareResultOptions: PrepareResultOptions = {
      ...options,
      resolvedGivens: resolved.size > 0 ? resolved : undefined,
    };
    const translatedQuery = queryModel.compileQuery(
      this._query,
      prepareResultOptions
    );
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
        ? this._model.getContent(sourceRef)
        : sourceRef;
    if (source === undefined || !isSourceDef(source)) {
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

  /**
   * The givens this specific query references, keyed by caller-facing
   * surface name. Used by "run this query" UIs to prompt only for the
   * givens this query actually touches, not every given declared in the
   * model.
   *
   * Computed as `model.givens` filtered by `query.givenUsage` — i.e. the
   * intersection of "what the model surfaces" with "what this query
   * needs." Internal-only givens (referenced but never surfaced) stay
   * invisible because they're not in `model.givens` to begin with.
   */
  public get givens(): ReadonlyMap<string, Given> {
    const out = new Map<string, Given>();
    const usage = this._query.givenUsage;
    if (!usage || usage.length === 0) return out;
    const referenced = new Set(usage.map(g => g.id));
    for (const [name, given] of this._model.givens) {
      if (referenced.has(given.id)) {
        out.set(name, given);
      }
    }
    return out;
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

  /** @deprecated Use `.annotations.parseAsTag(route)`. */
  tagParse(spec?: TagParseSpec): MalloyTagParse {
    return annotationToTag(this.inner.annotations, spec);
  }

  /** @deprecated Use `.annotations.texts(route)`. */
  getTaglines(prefix?: RegExp) {
    return annotationToTaglines(this.inner.annotations, prefix);
  }

  get annotations(): Annotations {
    return new Annotations(this.inner.annotations);
  }

  /** The model annotations resolved for this query's run-head. */
  get modelAnnotations(): Annotations {
    return new Annotations(getModelAnnotations(this.modelDef));
  }

  /**
   * @deprecated Hands out raw IR (`AnnotationsDef`). Use `.annotations`
   * (returns the {@link Annotations} view) for read access. Internal
   * code that needs the IR shape should read `._rawQuery.annotations`
   * directly. Slated for removal once external consumers migrate.
   */
  get annotation(): AnnotationsDef | undefined {
    return this.inner.annotations;
  }

  /**
   * @deprecated Hands out raw IR (`AnnotationsDef`). Internal code that needs
   * the model-level IR shape should call `getModelAnnotations(this.modelDef)`
   * directly. Slated for removal once external consumers migrate.
   */
  get modelAnnotation(): AnnotationsDef | undefined {
    return getModelAnnotations(this.modelDef);
  }

  get modelTag(): Tag {
    return new Annotations(getModelAnnotations(this.modelDef)).parseAsTag().tag;
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
      annotations: this.inner.annotations,
      name: this.inner.queryName || explore.name,
    };
    try {
      return new Explore(this.modelDef, namedExplore, this.sourceExplore);
    } catch (error) {
      return new Explore(this.modelDef, namedExplore);
    }
  }

  public get sourceExplore(): Explore | undefined {
    const name = this.inner.sourceExplore;
    const explore = safeRecordGet(this.modelDef.contents, name);
    if (explore && isSourceDef(explore)) {
      return new Explore(this.modelDef, explore);
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

  /**
   * Convert to the stable Malloy.Result interface format.
   * Pass data to include query results, or omit for schema-only
   * (e.g. headless tag validation).
   */
  public toStableResult(data?: Malloy.Data): Malloy.Result {
    const structs = this.inner.structs;
    const struct = structs[structs.length - 1];
    const schema = {fields: convertFieldInfos(struct, struct.fields)};
    const annotations = toStableAnnotations(this.inner.annotations);
    const metadataAnnot = struct.resultMetadata
      ? getResultStructMetadataAnnotation(struct, struct.resultMetadata)
      : undefined;
    if (metadataAnnot) {
      annotations.push(metadataAnnot);
    }

    const sourceMetadataTag = Tag.withPrefix('#(malloy) ');
    const sourceExplore = this.sourceExplore;
    if (sourceExplore) {
      sourceMetadataTag.set(['source', 'name'], sourceExplore.name);
    }
    if (this._sourceArguments) {
      const args = Object.entries(this._sourceArguments);
      for (let i = 0; i < args.length; i++) {
        const [name, value] = args[i];
        const literal: Malloy.LiteralValue | undefined = nodeToLiteralValue(
          value.value
        );
        if (literal !== undefined) {
          writeLiteralToTag(
            sourceMetadataTag,
            ['source', 'parameters', i, 'value'],
            literal
          );
        }
        sourceMetadataTag.set(['source', 'parameters', i, 'name'], name);
      }
    }
    annotations.push({value: sourceMetadataTag.toString()});

    annotations.push({
      value: Tag.withPrefix('#(malloy) ')
        .set(['query_name'], this.inner.queryName || struct.name)
        .toString(),
    });

    const modelAnnotations = toStableAnnotations(
      getModelAnnotations(this.modelDef)
    );

    return {
      schema,
      data,
      connection_name: this.inner.connectionName,
      annotations: annotations.length > 0 ? annotations : undefined,
      model_annotations:
        modelAnnotations.length > 0 ? modelAnnotations : undefined,
      query_timezone: struct.queryTimezone,
      sql: this.inner.sql,
    };
  }
}
