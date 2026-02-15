/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import * as Malloy from '@malloydata/malloy-interfaces';
import type {TagSetValue} from '@malloydata/malloy-tag';
import {Tag, TagParser} from '@malloydata/malloy-tag';
import * as Filter from '@malloydata/malloy-filter';

export type ParsedFilter =
  | {kind: 'string'; parsed: Filter.StringFilter | null}
  | {kind: 'number'; parsed: Filter.NumberFilter | null}
  | {kind: 'boolean'; parsed: Filter.BooleanFilter | null}
  | {kind: 'date'; parsed: Filter.TemporalFilter | null}
  | {kind: 'timestamp'; parsed: Filter.TemporalFilter | null}
  | {kind: 'timestamptz'; parsed: Filter.TemporalFilter | null};

export type PathSegment = number | string;
export type Path = PathSegment[];

type ASTAny = ASTNode<unknown>;

type ASTChildren<T> = {
  [Key in keyof T]: LiteralOrNode<T[Key]>;
};

type NonOptionalASTNode<T> = T extends undefined ? never : ASTNode<T>;

type LiteralOrNode<T> = T extends string
  ? T
  : T extends number
    ? T
    : T extends string[]
      ? T
      : T extends boolean
        ? T
        : undefined extends T
          ? NonOptionalASTNode<T> | undefined
          : ASTNode<T>;

abstract class ASTNode<T> {
  /**
   * @internal
   */
  edited = false;

  /**
   * @internal
   */
  public _parent: ASTAny | undefined;

  abstract build(): T;

  /**
   * @internal
   */
  edit() {
    this.edited = true;
    if (this._parent) this._parent.edit();
    return this;
  }

  /**
   * @internal
   */
  abstract findAny(path: Path): ASTAny;

  get as() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const node = this;
    return {
      Query(): ASTQuery {
        if (node instanceof ASTQuery) return node;
        throw new Error('Not an ASTQuery');
      },
      Reference(): ASTReference {
        if (node instanceof ASTReference) return node;
        throw new Error('Not an ASTReference');
      },
      ReferenceQueryArrowSource(): ASTReferenceQueryArrowSource {
        if (node instanceof ASTReferenceQueryArrowSource) return node;
        throw new Error('Not an ASTReferenceQueryArrowSource');
      },
      ParameterValueList(): ASTParameterValueList {
        if (node instanceof ASTParameterValueList) return node;
        throw new Error('Not an ASTParameterValueList');
      },
      FilterOperation(): ASTFilterOperation {
        if (node instanceof ASTFilterOperation) return node;
        throw new Error('Not an ASTFilterOperation');
      },
      FilterOperationList(): ASTFilterOperationList {
        if (node instanceof ASTFilterOperationList) return node;
        throw new Error('Not an ASTFilterOperationList');
      },
      ParameterValue(): ASTParameterValue {
        if (node instanceof ASTParameterValue) return node;
        throw new Error('Not an ASTParameterValue');
      },
      StringLiteralValue(): ASTStringLiteralValue {
        if (node instanceof ASTStringLiteralValue) return node;
        throw new Error('Not an ASTStringLiteralValue');
      },
      NumberLiteralValue(): ASTNumberLiteralValue {
        if (node instanceof ASTNumberLiteralValue) return node;
        throw new Error('Not an ASTNumberLiteralValue');
      },
      ViewOperationList(): ASTViewOperationList {
        if (node instanceof ASTViewOperationList) return node;
        throw new Error('Not an ASTViewOperationList');
      },
      GroupByViewOperation(): ASTGroupByViewOperation {
        if (node instanceof ASTGroupByViewOperation) return node;
        throw new Error('Not an ASTGroupByViewOperation');
      },
      AggregateViewOperation(): ASTAggregateViewOperation {
        if (node instanceof ASTAggregateViewOperation) return node;
        throw new Error('Not an ASTAggregateViewOperation');
      },
      OrderByViewOperation(): ASTOrderByViewOperation {
        if (node instanceof ASTOrderByViewOperation) return node;
        throw new Error('Not an ASTOrderByViewOperation');
      },
      Field(): ASTField {
        if (node instanceof ASTField) return node;
        throw new Error('Not an ASTField');
      },
      ReferenceExpression(): ASTReferenceExpression {
        if (node instanceof ASTReferenceExpression) return node;
        throw new Error('Not an ASTReferenceExpression');
      },
      ReferenceViewDefinition(): ASTReferenceViewDefinition {
        if (node instanceof ASTReferenceViewDefinition) return node;
        throw new Error('Not an ASTReferenceViewDefinition');
      },
      ArrowQueryDefinition(): ASTArrowQueryDefinition {
        if (node instanceof ASTArrowQueryDefinition) return node;
        throw new Error('Not an ASTArrowQueryDefinition');
      },
      ArrowViewDefinition(): ASTArrowViewDefinition {
        if (node instanceof ASTArrowViewDefinition) return node;
        throw new Error('Not an ASTArrowViewDefinition');
      },
      RefinementViewDefinition(): ASTRefinementViewDefinition {
        if (node instanceof ASTRefinementViewDefinition) return node;
        throw new Error('Not an ASTRefinementViewDefinition');
      },
      TimeTruncationExpression(): ASTTimeTruncationExpression {
        if (node instanceof ASTTimeTruncationExpression) return node;
        throw new Error('Not an ASTTimeTruncationExpression');
      },
      FilteredFieldExpression(): ASTFilteredFieldExpression {
        if (node instanceof ASTFilteredFieldExpression) return node;
        throw new Error('Not an ASTFilteredFieldExpression');
      },
      NestViewOperation(): ASTNestViewOperation {
        if (node instanceof ASTNestViewOperation) return node;
        throw new Error('Not an ASTNestViewOperation');
      },
      View(): ASTView {
        if (node instanceof ASTView) return node;
        throw new Error('Not an ASTView');
      },
      SegmentViewDefinition(): ASTSegmentViewDefinition {
        if (node instanceof ASTSegmentViewDefinition) return node;
        throw new Error('Not an ASTSegmentViewDefinition');
      },
      LimitViewOperation(): ASTLimitViewOperation {
        if (node instanceof ASTLimitViewOperation) return node;
        throw new Error('Not an ASTLimitViewOperation');
      },
      AnnotationList(): ASTAnnotationList {
        if (node instanceof ASTAnnotationList) return node;
        throw new Error('Not an ASTAnnotationList');
      },
      Annotation(): ASTAnnotation {
        if (node instanceof ASTAnnotation) return node;
        throw new Error('Not an ASTAnnotation');
      },
    };
  }

  get find() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const node = this;
    return {
      Query(path: Path): ASTQuery {
        return node.findAny(path).as.Query();
      },
      Reference(path: Path): ASTReference {
        return node.findAny(path).as.Reference();
      },
      ReferenceQueryArrowSource(path: Path): ASTReferenceQueryArrowSource {
        return node.findAny(path).as.ReferenceQueryArrowSource();
      },
      ParameterValueList(path: Path): ASTParameterValueList {
        return node.findAny(path).as.ParameterValueList();
      },
      FilterOperation(path: Path): ASTFilterOperation {
        return node.findAny(path).as.FilterOperation();
      },
      FilterOperationList(path: Path): ASTFilterOperationList {
        return node.findAny(path).as.FilterOperationList();
      },
      ParameterValue(path: Path): ASTParameterValue {
        return node.findAny(path).as.ParameterValue();
      },
      StringLiteralValue(path: Path): ASTStringLiteralValue {
        return node.findAny(path).as.StringLiteralValue();
      },
      NumberLiteralValue(path: Path): ASTNumberLiteralValue {
        return node.findAny(path).as.NumberLiteralValue();
      },
      ViewOperationList(path: Path): ASTViewOperationList {
        return node.findAny(path).as.ViewOperationList();
      },
      GroupByViewOperation(path: Path): ASTGroupByViewOperation {
        return node.findAny(path).as.GroupByViewOperation();
      },
      AggregateViewOperation(path: Path): ASTAggregateViewOperation {
        return node.findAny(path).as.AggregateViewOperation();
      },
      OrderByViewOperation(path: Path): ASTOrderByViewOperation {
        return node.findAny(path).as.OrderByViewOperation();
      },
      Field(path: Path): ASTField {
        return node.findAny(path).as.Field();
      },
      ReferenceExpression(path: Path): ASTReferenceExpression {
        return node.findAny(path).as.ReferenceExpression();
      },
      ReferenceViewDefinition(path: Path): ASTReferenceViewDefinition {
        return node.findAny(path).as.ReferenceViewDefinition();
      },
      ArrowQueryDefinition(path: Path): ASTArrowQueryDefinition {
        return node.findAny(path).as.ArrowQueryDefinition();
      },
      ArrowViewDefinition(path: Path): ASTArrowViewDefinition {
        return node.findAny(path).as.ArrowViewDefinition();
      },
      RefinementViewDefinition(path: Path): ASTRefinementViewDefinition {
        return node.findAny(path).as.RefinementViewDefinition();
      },
      TimeTruncationExpression(path: Path): ASTTimeTruncationExpression {
        return node.findAny(path).as.TimeTruncationExpression();
      },
      FilteredFieldExpression(path: Path): ASTFilteredFieldExpression {
        return node.findAny(path).as.FilteredFieldExpression();
      },
      NestViewOperation(path: Path): ASTNestViewOperation {
        return node.findAny(path).as.NestViewOperation();
      },
      View(path: Path): ASTView {
        return node.findAny(path).as.View();
      },
      SegmentViewDefinition(path: Path): ASTSegmentViewDefinition {
        return node.findAny(path).as.SegmentViewDefinition();
      },
      LimitViewOperation(path: Path): ASTLimitViewOperation {
        return node.findAny(path).as.LimitViewOperation();
      },
      AnnotationList(path: Path): ASTAnnotationList {
        return node.findAny(path).as.AnnotationList();
      },
      Annotation(path: Path): ASTAnnotation {
        return node.findAny(path).as.Annotation();
      },
    };
  }

  /**
   * @internal
   */
  get parent() {
    if (this._parent === undefined) {
      throw new Error('This node does not have a parent');
    }
    return this._parent;
  }

  /**
   * @internal
   */
  set parent(parent: ASTAny) {
    this._parent = parent;
  }

  /**
   * @internal
   */
  static schemaTryGet(
    schema: Malloy.Schema,
    name: string,
    path: string[] | undefined
  ) {
    return ASTNode._schemaTryGet(schema, name, path, false);
  }

  /**
   * @internal
   */
  static schemaTryGetDrillField(
    schema: Malloy.Schema,
    name: string,
    path: string[] | undefined
  ) {
    return ASTNode._schemaTryGet(schema, name, path, true);
  }

  /**
   * @internal
   */
  private static _schemaTryGet(
    schema: Malloy.Schema,
    name: string,
    path: string[] | undefined,
    isDrill: boolean
  ) {
    let current = schema.fields;
    for (const part of path ?? []) {
      const field = current.find(f => f.name === part);
      if (field === undefined) {
        throw new Error(`${part} not found`);
      }
      if (field.kind === 'join' || (isDrill && field.kind === 'view')) {
        current = field.schema.fields;
        continue;
      }
      if (field.kind === 'dimension' || field.kind === 'measure') {
        if (field.type.kind === 'record_type') {
          current = field.type.fields.map(f => ({
            kind: field.kind,
            ...f,
          }));
          continue;
        } else if (
          field.type.kind === 'array_type' &&
          field.type.element_type.kind === 'record_type'
        ) {
          current = field.type.element_type.fields.map(f => ({
            kind: field.kind,
            ...f,
          }));
          continue;
        }
      }
      throw new Error(`${part} is not a join, record, or repeated record`);
    }
    const field = current.find(f => f.name === name);
    return field;
  }

  /**
   * @internal
   */
  static schemaGet(
    schema: Malloy.Schema,
    name: string,
    path: string[] | undefined
  ) {
    const field = ASTNode.schemaTryGet(schema, name, path);
    if (field === undefined) {
      throw new Error(`${name} not found`);
    }
    return field;
  }

  /**
   * @internal
   */
  static schemaGetDrillField(
    schema: Malloy.Schema,
    name: string,
    path: string[] | undefined
  ) {
    const field = ASTNode.schemaTryGetDrillField(schema, name, path);
    if (field === undefined) {
      throw new Error(`${name} not found`);
    }
    return field;
  }

  /**
   * @internal
   */
  static schemaMerge(a: Malloy.Schema, b: Malloy.Schema): Malloy.Schema {
    return {
      fields: [...a.fields, ...b.fields],
    };
  }

  static tagFor(a: Malloy.FieldInfo, prefix = '# ') {
    const lines = a.annotations
      ?.map(a => a.value)
      ?.filter(l => l.startsWith(prefix));
    const session = new TagParser();
    for (const l of lines ?? []) {
      session.parse(l);
    }
    return session.finish();
  }

  static fieldWasCalculation(a: Malloy.FieldInfo) {
    if (a.kind !== 'dimension') {
      throw new Error(
        `${a.name} could not be an output field, because it is a ${a.kind}, and only dimensions can appear in output schemas`
      );
    }
    const tag = ASTNode.tagFor(a, '#(malloy) ');
    return tag.has('calculation');
  }
}

function isBasic(
  t: ASTAny | string | number | string[] | boolean
): t is string | number | string[] | boolean {
  return (
    Array.isArray(t) ||
    typeof t === 'string' ||
    typeof t === 'number' ||
    typeof t === 'boolean'
  );
}

abstract class ASTListNode<
  T,
  N extends ASTNode<T> = ASTNode<T>,
> extends ASTNode<T[]> {
  originalChildren: N[];
  constructor(
    protected node: T[],
    protected children: N[]
  ) {
    super();
    this.originalChildren = [...children];
    children.forEach(c => (c.parent = this));
  }

  *iter(): Generator<N, void, unknown> {
    for (let i = 0; i < this.length; i++) {
      yield this.index(i);
    }
  }

  get length() {
    return this.children.length;
  }

  get last() {
    return this.children[this.children.length - 1];
  }

  /**
   * Get the `i`th element of this list
   *
   * @param i The index of the list to get
   * @returns The item at index `i` in this list
   */
  index(i: number) {
    return this.children[i];
  }

  /**
   * @internal
   */
  insert(n: N, index: number) {
    this.edit();
    this.children.splice(index, 0, n);
    n.parent = this;
  }

  /**
   * @internal
   */
  add(n: N) {
    this.edit();
    this.children.push(n);
    n.parent = this;
  }

  /**
   * @internal
   */
  remove(n: N) {
    const idx = this.children.findIndex(o => o === n);
    if (idx === -1) return this;
    this.edit();
    this.children.splice(idx, 1);
  }

  /**
   * @internal
   */
  build(): T[] {
    if (!this.edited) return this.node;
    const ret = this.children.map(c => c.build());
    this.edited = false;
    this.originalChildren = [...this.children];
    this.node = ret;
    return ret;
  }

  /**
   * @internal
   */
  findAny(path: Path): ASTAny {
    if (path.length === 0) {
      return this;
    }
    const [head, ...rest] = path;
    if (typeof head !== 'number') {
      throw new Error(
        `${this.constructor.name} is a ASTListNode and thus cannot contain a ${head}`
      );
    }
    const child = this.children[head];
    return child.findAny(rest);
  }

  /**
   * @internal
   */
  findIndex(predicate: (n: N) => boolean): number {
    return this.children.findIndex(predicate);
  }

  /**
   * @internal
   */
  indexOf(n: N): number {
    return this.children.indexOf(n);
  }
}

abstract class ASTObjectNode<
  T,
  Children extends ASTChildren<T>,
> extends ASTNode<T> {
  constructor(
    protected node: T,
    protected children: Children
  ) {
    super();
    for (const key in children) {
      const child = children[key];
      if (child && !isBasic(child)) {
        child.parent = this;
      }
    }
  }

  /**
   * @internal
   */
  build(): T {
    if (!this.edited) return this.node;
    let ret = this.node;
    for (const key in this.children) {
      const child = this.children[key];
      if (child === undefined) {
        ret = {...ret, [key]: undefined};
      } else if (isBasic(child)) {
        if (this.edited) {
          ret = {...ret, [key]: child};
        }
      } else {
        ret = {...ret, [key]: child.build()};
      }
    }
    this.node = ret;
    this.edited = false;
    return ret;
  }

  /**
   * @internal
   */
  findAny(path: Path): ASTAny {
    if (path.length === 0) {
      return this;
    }
    const [head, ...rest] = path;
    if (typeof head !== 'string') {
      throw new Error(
        `${this.constructor.name} is a ASTListNode and thus cannot contain a ${head}`
      );
    }
    const child = this.children[head];
    if (isBasic(child)) {
      throw new Error(
        `${this.constructor.name}.${head} refers to a basic type, not an ASTNode`
      );
    }
    return child._find(rest);
  }
}

/**
 * AST Object to represent the whole query AST.
 *
 * ```ts
 * const q = new ASTQuery({
 *   source: flightsSourceInfo,
 * });
 * const segment = q.getOrAddDefaultSegment();
 * segment.addGroupBy("carrier");
 * segment.addOrderBy("carrier", Malloy.OrderByDirection.DESC);
 * const malloy = q.toMalloy();
 * const query = q.build();
 * ```
 */
export class ASTQuery
  extends ASTObjectNode<
    Malloy.Query,
    {
      definition: ASTQueryDefinition;
      annotations?: ASTAnnotationList;
    }
  >
  implements IASTAnnotatable
{
  model: Malloy.ModelInfo;

  /**
   * Create a new Query AST object against a given source.
   *
   * @param options.query Optional query to begin with; if none is provided, will
   *                      use an empty query (`{pipeline: {stages: []}}`)
   * @param options.source A source to base the query on. Will set the source name
   *                       in the provided (or default) query to the name of this source.
   */
  constructor(options: {
    query?: Malloy.Query;
    source:
      | Malloy.ModelEntryValueWithSource
      | Malloy.ModelEntryValueWithQuery
      | Malloy.SourceInfo
      | Malloy.QueryInfo;
  });
  /**
   * Create a new Query AST object against a given model.
   *
   * @param options.query Optional query to begin with; if none is provided, will
   *                      use an empty query (`{pipeline: {stages: []}}`)
   * @param options.model A model to use for building this query. Use {@link setSource}
   *                      to configure the source, or set {@link setQueryHead} to run
   *                      a top level query in the model.
   */
  constructor(options: {query?: Malloy.Query; model: Malloy.ModelInfo});
  constructor(options: {
    query?: Malloy.Query;
    model?: Malloy.ModelInfo;
    source?:
      | Malloy.ModelEntryValueWithSource
      | Malloy.ModelEntryValueWithQuery
      | Malloy.SourceInfo
      | Malloy.QueryInfo;
  }) {
    let chosenSource = options.source;
    if (chosenSource === undefined) {
      if (options.model === undefined) {
        throw new Error('Need a model or source');
      }
      if (options.query) {
        const definition = options.query.definition;
        if (
          definition.kind === 'arrow' &&
          definition.source.kind === 'source_reference'
        ) {
          const name = definition.source.name;
          chosenSource = options.model.entries.find(e => e.name === name);
          if (chosenSource === undefined) {
            throw new Error(
              `Model does not contain source or query named ${name}`
            );
          }
        }
      }
      if (chosenSource === undefined) {
        chosenSource = options.model.entries[0];
      }
      if (chosenSource === undefined) {
        throw new Error('Model does not contain any sources or queries');
      }
    }
    const source = sourceOrQueryToModelEntry(chosenSource);
    const query = options.query ?? {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: source.name,
        },
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    const model: Malloy.ModelInfo | undefined = options.model ?? {
      entries: [source],
      anonymous_queries: [],
    };
    super(query, {
      definition: ASTQueryDefinition.from(query.definition),
      annotations:
        query.annotations && new ASTAnnotationList(query.annotations),
    });
    this.model = model;
    if (options.source) {
      this.setSource(options.source.name);
    }
  }

  get definition() {
    return this.children.definition;
  }

  set definition(definition: ASTQueryDefinition) {
    this.edit();
    this.children.definition = definition;
    definition.parent = this;
  }

  get annotations() {
    return this.children.annotations;
  }

  reorderFields(names: string[]) {
    this.definition.reorderFields(names);
  }

  getOrAddAnnotations() {
    if (this.annotations) return this.annotations;
    this.edit();
    const annotations = new ASTAnnotationList([]);
    this.children.annotations = annotations;
    annotations.parent = this;
    return annotations;
  }

  getInheritedTag(prefix: RegExp | string = '# ') {
    return tagFromAnnotations(prefix, this.getInheritedAnnotations());
  }

  getIntrinsicTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getIntrinsicTag(prefix) ?? new Tag();
  }

  getTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getTag(prefix) ?? this.getInheritedTag(prefix);
  }

  setTagProperty(path: Path, value: TagSetValue = null, prefix = '# ') {
    this.getOrAddAnnotations().setTagProperty(path, value, prefix);
  }

  removeTagProperty(path: Path, prefix = '# ') {
    if (!this.getTag().has(...path)) return;
    this.getOrAddAnnotations().removeTagProperty(path, prefix);
  }

  setViewToEmptySegment() {
    if (!(this.definition instanceof ASTArrowQueryDefinition)) {
      throw new Error('Must set source before setting view');
    }
    this.definition = new ASTArrowQueryDefinition({
      kind: 'arrow',
      source: this.definition.source.build(),
      view: {
        kind: 'segment',
        operations: [],
      },
    });
    return this.definition.view.as.SegmentViewDefinition();
  }

  isRunnable() {
    return this.definition.isRunnable();
  }

  isEmpty() {
    return (
      this.definition instanceof ASTArrowQueryDefinition &&
      this.definition.view instanceof ASTSegmentViewDefinition &&
      this.definition.view.operations.length === 0
    );
  }

  /**
   * Gets an {@link ASTSegmentViewDefinition} for the "default" place to add query
   * operations, or creates one if it doesn't exist.
   *
   * ```
   * run: flights ->
   * ```
   * ```ts
   * q.getOrAddDefaultSegment();
   * ```
   * ```
   * run: flights -> { }
   * ```
   *
   * If there is a view at the head, it will refine it:
   * ```
   * run: flights -> by_carrier
   * ```
   * ```ts
   * q.getOrAddDefaultSegment();
   * ```
   * ```
   * run: flights -> by_carrier + { }
   * ```
   */
  public getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    return this.definition.getOrAddDefaultSegment();
  }

  /**
   * Sets the source of this query to be a reference to a source in the model.
   *
   * ```ts
   * q.setSource('flights')
   * ```
   * ```
   * run: flights -> { }
   * ```
   *
   * @param name The name of the source in the model to reference.
   */
  public setSource(name: string) {
    if (this.definition instanceof ASTArrowQueryDefinition) {
      if (
        this.definition.source instanceof ASTReferenceQueryArrowSource &&
        this.definition.source.name === name
      ) {
        return;
      }
    }
    const source = this.model.entries.find(e => e.name === name);
    if (source === undefined) {
      throw new Error(`Source ${name} is not defined in model`);
    }
    this.definition = new ASTArrowQueryDefinition({
      kind: 'arrow',
      source: {
        kind: 'source_reference',
        name,
      },
      view:
        this.definition instanceof ASTArrowQueryDefinition
          ? this.definition.view.build()
          : {
              kind: 'segment',
              operations: [],
            },
    });
  }

  /**
   * Sets the head of this query to be a reference to a top level query.
   *
   * ```ts
   * q.setQueryHead('flights_by_carrier')
   * ```
   * ```
   * run: flights_by_carrier
   * ```
   *
   * @param name The name of the query in the model to reference.
   */
  public setQueryHead(name: string) {
    const query = this.model.entries.find(e => e.name === name);
    if (query === undefined || query.kind !== 'query') {
      throw new Error(`No query named ${name} in the model`);
    }
    this.definition = new ASTReferenceQueryDefinition({
      kind: 'query_reference',
      name,
    });
  }

  /**
   * @internal
   */
  getQueryInfo(name: string): Malloy.QueryInfo {
    const query = this.model.entries.find(e => e.name === name);
    if (query === undefined) {
      throw new Error(`Query ${name} is not defined in model`);
    }
    if (query.kind !== 'query') {
      throw new Error(`Model entry ${name} is not a query`);
    }
    return query;
  }

  /**
   * Emits the current query object as Malloy code
   *
   * ```ts
   * q.setSource('flights')
   * q.setView('by_carrier')
   * q.toMalloy();
   * ```
   * ```
   * run: flights -> by_carrier
   * ```
   *
   * @returns Malloy code for the query
   */
  toMalloy(): string {
    return Malloy.queryToMalloy(this.build());
  }

  /**
   * Build the query into its `Malloy.Query` object form. New JS objects will be
   * created for any subtree which has edits.
   *
   * @returns A `Malloy.Query` representing the current query
   */
  build(): Malloy.Query {
    return super.build();
  }

  /**
   * Set the view of this query; overwrites any other query operations.
   *
   * ```
   * run: flights ->
   * ```
   * ```ts
   * q.setView('by_carrier')
   * ```
   * ```
   * run: flights -> by_carrier
   * ```
   *
   * @param name The name of the view to set as the head of the query pipeline
   */
  setView(name: string): ASTReferenceViewDefinition {
    if (!(this.definition instanceof ASTArrowQueryDefinition)) {
      throw new Error('Must set source before setting view');
    }
    this.definition = new ASTArrowQueryDefinition({
      kind: 'arrow',
      source: this.definition.source.build(),
      view: {
        kind: 'view_reference',
        name,
      },
    });
    return this.definition.view.as.ReferenceViewDefinition();
  }

  private _getInheritedAnnotations(
    definition: ASTQueryDefinition
  ): Malloy.Annotation[] {
    if (definition instanceof ASTReferenceQueryDefinition) {
      const query = this.getQueryInfo(definition.name);
      return query.annotations ?? [];
    } else if (definition instanceof ASTRefinementQueryDefinition) {
      return this._getInheritedAnnotations(definition.base);
    } else if (definition instanceof ASTArrowQueryDefinition) {
      return definition.view.getInheritedAnnotations();
    }
    return [];
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    return this._getInheritedAnnotations(this.definition);
  }
}

export type RawLiteralValue =
  | number
  | string
  | {date: Date; granularity: Malloy.TimestampTimeframe}
  | boolean
  | null;

export interface IASTReference extends ASTAny {
  /**
   * Gets the parameter list for this reference, or creates it if it does not exist.
   *
   * @returns The parameter list `ASTParameterValueList`
   */
  getOrAddParameters(): ASTParameterValueList;

  /**
   * Adds a parameter to this source with with the given name and value
   *
   * This will override an existing parameter with the same name.
   *
   * @param name The name of the parameter to set
   * @param value The value of the parameter to set
   */
  setParameter(
    name: string,
    value: RawLiteralValue | Malloy.LiteralValue
  ): void;

  tryGetParameter(name: string): ASTParameterValue | undefined;

  parameters: ASTParameterValueList | undefined;
  name: string;
  path: string[] | undefined;
}

export class ASTReference
  extends ASTObjectNode<
    Malloy.Reference,
    {
      name: string;
      path?: string[];
      parameters?: ASTParameterValueList;
    }
  >
  implements IASTReference
{
  constructor(public reference: Malloy.Reference) {
    super(reference, {
      name: reference.name,
      path: reference.path,
      parameters:
        reference.parameters && new ASTParameterValueList(reference.parameters),
    });
  }

  get name() {
    return this.children.name;
  }

  set name(value: string) {
    this.edit();
    this.children.name = value;
  }

  get parameters() {
    return this.children.parameters;
  }

  set parameters(parameters: ASTParameterValueList | undefined) {
    this.edit();
    this.children.parameters = parameters;
  }

  get path() {
    return this.children.path;
  }

  /**
   * @internal
   */
  static getOrAddParameters(reference: IASTReference) {
    if (reference.parameters) {
      return reference.parameters;
    }
    reference.edit();
    const parameters = new ASTParameterValueList([]);
    reference.parameters = parameters;
    return parameters;
  }

  /**
   * @internal
   */
  static setParameter(
    reference: IASTReference,
    name: string,
    value: RawLiteralValue | Malloy.LiteralValue
  ) {
    const existing = ASTReference.tryGetParameter(reference, name);
    if (existing !== undefined) {
      existing.value = ASTLiteralValue.from(ASTLiteralValue.makeLiteral(value));
      return;
    }
    return reference.getOrAddParameters().addParameter(name, value);
  }

  /**
   * @internal
   */
  static tryGetParameter(reference: IASTReference, name: string) {
    if (reference.parameters === undefined) return undefined;
    for (const parameter of reference.parameters.iter()) {
      if (parameter.name === name) {
        return parameter;
      }
    }
  }

  public getOrAddParameters(): ASTParameterValueList {
    return ASTReference.getOrAddParameters(this);
  }

  public setParameter(
    name: string,
    value: RawLiteralValue | Malloy.LiteralValue
  ) {
    return ASTReference.setParameter(this, name, value);
  }

  public tryGetParameter(name: string): ASTParameterValue | undefined {
    return ASTReference.tryGetParameter(this, name);
  }
}

type ASTFieldReferenceParent =
  | ASTFilterWithFilterString
  | ASTOrderByViewOperation
  | ASTTimeTruncationExpression
  | ASTFilteredFieldExpression
  | ASTFilterWithLiteralEquality;

export class ASTFieldReference extends ASTReference {
  /**
   * @internal
   */
  get segment(): ASTSegmentViewDefinition {
    const parent = this.parent as ASTFieldReferenceParent;
    if (
      parent instanceof ASTFilteredFieldExpression ||
      parent instanceof ASTTimeTruncationExpression
    ) {
      return parent.field.segment;
    } else if (
      parent instanceof ASTFilterWithFilterString ||
      parent instanceof ASTFilterWithLiteralEquality
    ) {
      return parent.segment;
    } else {
      return parent.list.segment;
    }
  }

  private getReferenceSchema(): Malloy.Schema {
    if (this.parent instanceof ASTOrderByViewOperation) {
      return this.segment.getOutputSchema();
    }
    return this.segment.getInputSchema();
  }

  getFieldInfo() {
    const schema = this.getReferenceSchema();
    return ASTNode.schemaGet(schema, this.name, this.path);
  }
}

export class ASTParameterValueList extends ASTListNode<
  Malloy.ParameterValue,
  ASTParameterValue
> {
  constructor(parameters: Malloy.ParameterValue[]) {
    super(
      parameters,
      parameters.map(p => new ASTParameterValue(p))
    );
  }

  get parameters() {
    return this.children;
  }

  addParameter(name: string, value: RawLiteralValue | Malloy.LiteralValue) {
    // TODO validate that the parameter is valid (name and type)
    this.add(
      new ASTParameterValue({
        name,
        value: ASTLiteralValue.makeLiteral(value),
      })
    );
  }
}

export class ASTParameterValue extends ASTObjectNode<
  Malloy.ParameterValue,
  {
    name: string;
    value: ASTLiteralValue;
  }
> {
  constructor(public parameter: Malloy.ParameterValue) {
    super(parameter, {
      name: parameter.name,
      value: ASTLiteralValue.from(parameter.value),
    });
  }

  get name() {
    return this.children.name;
  }

  get value() {
    return this.children.value;
  }

  set value(value: ASTLiteralValue) {
    this.edit();
    this.children.value = value;
  }
}

export type ASTLiteralValue =
  | ASTStringLiteralValue
  | ASTNumberLiteralValue
  | ASTBooleanLiteralValue
  | ASTDateLiteralValue
  | ASTTimestampLiteralValue
  | ASTFilterExpressionLiteralValue
  | ASTNullLiteralValue;
export const ASTLiteralValue = {
  from(value: Malloy.LiteralValue) {
    switch (value.kind) {
      case 'string_literal':
        return new ASTStringLiteralValue(value);
      case 'number_literal':
        return new ASTNumberLiteralValue(value);
      case 'boolean_literal':
        return new ASTBooleanLiteralValue(value);
      case 'date_literal':
        return new ASTDateLiteralValue(value);
      case 'timestamp_literal':
        return new ASTTimestampLiteralValue(value);
      case 'null_literal':
        return new ASTNullLiteralValue(value);
      case 'filter_expression_literal':
        return new ASTFilterExpressionLiteralValue(value);
    }
  },
  makeLiteral(
    value: RawLiteralValue | Malloy.LiteralValue
  ): Malloy.LiteralValue {
    if (value !== null && typeof value === 'object' && 'kind' in value) {
      return value;
    } else if (typeof value === 'string') {
      return {
        kind: 'string_literal',
        string_value: value,
      };
    } else if (typeof value === 'boolean') {
      return {
        kind: 'boolean_literal',
        boolean_value: value,
      };
    } else if (typeof value === 'number') {
      return {
        kind: 'number_literal',
        number_value: value,
      };
    } else if (value === null) {
      return {
        kind: 'null_literal',
      };
    } else if ('date' in value) {
      const granularity = value.granularity;
      const serialized = serializeDateAsLiteral(value.date);
      if (isDateTimeframe(granularity)) {
        return {
          kind: 'date_literal',
          date_value: serialized,
          granularity: granularity,
        };
      }
      return {
        kind: 'timestamp_literal',
        timestamp_value: serialized,
        granularity: granularity,
      };
    }
    throw new Error('Unknown literal type');
  },
};

export class ASTStringLiteralValue extends ASTObjectNode<
  Malloy.LiteralValueWithStringLiteral,
  {
    kind: 'string_literal';
    string_value: string;
  }
> {
  readonly kind: Malloy.LiteralValueType = 'string_literal';

  constructor(public node: Malloy.LiteralValueWithStringLiteral) {
    super(node, {
      kind: node.kind,
      string_value: node.string_value,
    });
  }

  get fieldType(): Malloy.AtomicType {
    return {
      kind: 'string_type',
    };
  }
}

export class ASTNullLiteralValue extends ASTObjectNode<
  Malloy.LiteralValueWithNullLiteral,
  {
    kind: 'null_literal';
  }
> {
  readonly kind: Malloy.LiteralValueType = 'null_literal';

  constructor(public node: Malloy.LiteralValueWithNullLiteral) {
    super(node, {
      kind: node.kind,
    });
  }

  get fieldType(): undefined {
    return undefined;
  }
}

export class ASTNumberLiteralValue extends ASTObjectNode<
  Malloy.LiteralValueWithNumberLiteral,
  {
    kind: 'number_literal';
    number_value: number;
  }
> {
  readonly kind: Malloy.LiteralValueType = 'number_literal';

  constructor(public node: Malloy.LiteralValueWithNumberLiteral) {
    super(node, {
      kind: node.kind,
      number_value: node.number_value,
    });
  }

  get fieldType(): Malloy.AtomicType {
    return {
      kind: 'number_type',
      subtype: Number.isInteger(this.children.number_value)
        ? 'integer'
        : 'decimal',
    };
  }
}

export class ASTBooleanLiteralValue extends ASTObjectNode<
  Malloy.LiteralValueWithBooleanLiteral,
  {
    kind: 'boolean_literal';
    boolean_value: boolean;
  }
> {
  readonly kind: Malloy.LiteralValueType = 'boolean_literal';

  constructor(public node: Malloy.LiteralValueWithBooleanLiteral) {
    super(node, {
      kind: node.kind,
      boolean_value: node.boolean_value,
    });
  }

  get fieldType(): Malloy.AtomicType {
    return {
      kind: 'boolean_type',
    };
  }
}

export class ASTDateLiteralValue extends ASTObjectNode<
  Malloy.LiteralValueWithDateLiteral,
  {
    kind: 'date_literal';
    date_value: string;
    granularity?: Malloy.DateTimeframe;
  }
> {
  readonly kind: Malloy.LiteralValueType = 'date_literal';

  constructor(public node: Malloy.LiteralValueWithDateLiteral) {
    super(node, {
      kind: node.kind,
      date_value: node.date_value,
      granularity: node.granularity,
    });
  }

  get fieldType(): Malloy.AtomicType {
    return {
      kind: 'date_type',
      timeframe: this.children.granularity,
    };
  }
}

export class ASTTimestampLiteralValue extends ASTObjectNode<
  Malloy.LiteralValueWithTimestampLiteral,
  {
    kind: 'timestamp_literal';
    timestamp_value: string;
    granularity?: Malloy.TimestampTimeframe;
  }
> {
  readonly kind: Malloy.LiteralValueType = 'timestamp_literal';

  constructor(public node: Malloy.LiteralValueWithTimestampLiteral) {
    super(node, {
      kind: node.kind,
      timestamp_value: node.timestamp_value,
      granularity: node.granularity,
    });
  }

  get fieldType(): Malloy.AtomicType {
    return {
      kind: 'timestamp_type',
      timeframe: this.children.granularity,
    };
  }
}

export class ASTFilterExpressionLiteralValue extends ASTObjectNode<
  Malloy.LiteralValueWithFilterExpressionLiteral,
  {
    kind: 'filter_expression_literal';
    filter_expression_value: string;
  }
> {
  readonly kind: Malloy.LiteralValueType = 'filter_expression_literal';

  constructor(public node: Malloy.LiteralValueWithFilterExpressionLiteral) {
    super(node, {
      kind: node.kind,
      filter_expression_value: node.filter_expression_value,
    });
  }

  get fieldType(): undefined {
    return undefined;
  }
}

export class ASTUnimplemented<T> extends ASTNode<T> {
  constructor(private readonly node: T) {
    super();
  }
  get treeEdited(): boolean {
    return false;
  }

  build(): T {
    return this.node;
  }

  findAny(): never {
    throw new Error('Tried to find a node from an unimplemented node type');
  }
}

export interface IASTQueryOrViewDefinition {
  /**
   * Upward propagation of field deletion/rename etc
   * @internal
   */
  propagateUp(f: PropagationFunction): void;
  /**
   * Downward propagation of field deletion/rename etc
   * @internal
   */
  propagateDown(f: PropagationFunction): void;
}

type PropagationFunction = (propagatable: IASTQueryOrViewDefinition) => void;

export interface IASTQueryDefinition extends IASTQueryOrViewDefinition {
  getOrAddDefaultSegment(): ASTSegmentViewDefinition;
  reorderFields(names: string[]): void;
  isRunnable(): boolean;
}

export type ASTQueryArrowSource =
  | ASTReferenceQueryArrowSource
  | ASTRefinementQueryDefinition;
export const ASTQueryArrowSource = {
  from(definition: Malloy.QueryArrowSource) {
    switch (definition.kind) {
      case 'refinement':
        return new ASTRefinementQueryDefinition(definition);
      case 'source_reference':
        return new ASTReferenceQueryArrowSource(definition);
    }
  },
};

export type ASTQueryDefinition =
  | ASTReferenceQueryDefinition
  | ASTArrowQueryDefinition
  | ASTRefinementQueryDefinition;
export const ASTQueryDefinition = {
  from(definition: Malloy.QueryDefinition) {
    switch (definition.kind) {
      case 'arrow':
        return new ASTArrowQueryDefinition(definition);
      case 'query_reference':
        return new ASTReferenceQueryDefinition(definition);
      case 'refinement':
        return new ASTRefinementQueryDefinition(definition);
    }
  },
};

export class ASTArrowQueryDefinition
  extends ASTObjectNode<
    Malloy.QueryDefinitionWithArrow,
    {
      kind: 'arrow';
      source: ASTQueryArrowSource;
      view: ASTViewDefinition;
    }
  >
  implements IASTQueryDefinition
{
  constructor(public node: Malloy.QueryDefinitionWithArrow) {
    super(node, {
      kind: 'arrow',
      source: ASTQueryArrowSource.from(node.source),
      view: ASTViewDefinition.from(node.view),
    });
  }

  get view() {
    return this.children.view;
  }

  set view(view: ASTViewDefinition) {
    this.edit();
    this.children.view = view;
    view.parent = this;
  }

  get source() {
    return this.children.source;
  }

  set source(source: ASTQueryArrowSource) {
    this.edit();
    this.children.source = source;
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    return this.view.getOrAddDefaultSegment();
  }

  getSourceInfo(): Malloy.SourceInfo {
    return this.source.getSourceInfo();
  }

  getOutputSchema(): Malloy.Schema {
    return this.view.getRefinementSchema();
  }

  isRunnable(): boolean {
    return this.view.isRunnable() && this.source.isRunnable();
  }

  /**
   * @internal
   */
  get query() {
    return this.parent.as.Query();
  }

  /**
   * @internal
   */
  propagateUp(f: PropagationFunction): void {
    this.propagateDown(f);
  }

  /**
   * @internal
   */
  propagateDown(f: PropagationFunction): void {
    f(this.view);
    this.view.propagateDown(f);
  }

  reorderFields(names: string[]): void {
    if (this.view instanceof ASTSegmentViewDefinition) {
      this.view.reorderFields(names);
    } else {
      this.query.getOrAddAnnotations().setTagProperty(['field_order'], names);
    }
  }
}

export class ASTRefinementQueryDefinition
  extends ASTObjectNode<
    Malloy.QueryDefinitionWithRefinement,
    {
      kind: 'refinement';
      base: ASTQueryDefinition;
      refinement: ASTViewDefinition;
    }
  >
  implements IASTQueryDefinition
{
  constructor(public node: Malloy.QueryDefinitionWithRefinement) {
    super(node, {
      kind: 'refinement',
      base: ASTQueryDefinition.from(node.base),
      refinement: ASTViewDefinition.from(node.refinement),
    });
  }

  get base() {
    return this.children.base;
  }

  get refinement() {
    return this.children.refinement;
  }

  set refinement(refinement: ASTViewDefinition) {
    this.edit();
    this.children.refinement = refinement;
    refinement.parent = this;
  }

  isRunnable(): boolean {
    return true;
  }

  /**
   * @internal
   */
  get query() {
    return this.parent.as.Query();
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    return this.refinement.getOrAddDefaultSegment();
  }

  getOutputSchema(): Malloy.Schema {
    const base = this.base.getOutputSchema();
    const refinement = this.refinement.getRefinementSchema();
    return ASTQuery.schemaMerge(base, refinement);
  }

  /**
   * @internal
   */
  propagateUp(f: PropagationFunction): void {
    this.propagateDown(f);
  }

  /**
   * @internal
   */
  propagateDown(f: PropagationFunction): void {
    f(this.refinement);
    this.refinement.propagateDown(f);
  }

  reorderFields(names: string[]): void {
    this.query.getOrAddAnnotations().setTagProperty(['field_order'], names);
  }

  getSourceInfo(): Malloy.SourceInfo {
    return this.base.getSourceInfo();
  }
}

export class ASTReferenceQueryDefinition
  extends ASTObjectNode<
    Malloy.QueryDefinitionWithQueryReference,
    {
      kind: 'query_reference';
      name: string;
      path?: string[];
      parameters?: ASTParameterValueList;
    }
  >
  implements IASTQueryDefinition, IASTReference
{
  constructor(public node: Malloy.QueryDefinitionWithQueryReference) {
    super(node, {
      kind: 'query_reference',
      name: node.name,
      path: node.path,
      parameters: node.parameters && new ASTParameterValueList(node.parameters),
    });
  }

  isRunnable(): boolean {
    return true;
  }

  get name() {
    return this.children.name;
  }

  get query() {
    return this.parent.as.Query();
  }

  get parameters() {
    return this.children.parameters;
  }

  set parameters(parameters: ASTParameterValueList | undefined) {
    this.edit();
    this.children.parameters = parameters;
  }

  get path() {
    return this.children.path;
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    const newQuery = new ASTRefinementQueryDefinition({
      kind: 'refinement',
      base: this.build(),
      refinement: {
        kind: 'segment',
        operations: [],
      },
    });
    this.query.definition = newQuery;
    return newQuery.refinement.as.SegmentViewDefinition();
  }

  /**
   * @internal
   */
  propagateUp(_f: PropagationFunction): void {
    return;
  }

  /**
   * @internal
   */
  propagateDown(_f: PropagationFunction): void {
    return;
  }

  reorderFields(names: string[]): void {
    this.query.getOrAddAnnotations().setTagProperty(['field_order'], names);
  }

  public getOrAddParameters(): ASTParameterValueList {
    return ASTReference.getOrAddParameters(this);
  }

  public setParameter(
    name: string,
    value: RawLiteralValue | Malloy.LiteralValue
  ) {
    return ASTReference.setParameter(this, name, value);
  }

  public tryGetParameter(name: string): ASTParameterValue | undefined {
    return ASTReference.tryGetParameter(this, name);
  }

  public getOutputSchema(): Malloy.Schema {
    return this.getSourceInfo().schema;
  }

  getSourceInfo(): Malloy.SourceInfo {
    const model = this.query.model;
    const query = model.entries.find(e => e.name === this.name);
    if (query === undefined) {
      throw new Error(`Query not found with name ${this.name}`);
    }
    return query;
  }
}

export class ASTReferenceQueryArrowSource
  extends ASTObjectNode<
    Malloy.QueryArrowSourceWithSourceReference,
    {
      kind: 'source_reference';
      name: string;
      path?: string[];
      parameters?: ASTParameterValueList;
    }
  >
  implements IASTReference
{
  constructor(public node: Malloy.QueryArrowSourceWithSourceReference) {
    super(node, {
      kind: 'source_reference',
      name: node.name,
      path: node.path,
      parameters: node.parameters && new ASTParameterValueList(node.parameters),
    });
  }

  isRunnable(): boolean {
    return this.areRequiredParametersSet();
  }

  get name() {
    return this.children.name;
  }

  get arrow() {
    return this.parent.as.ArrowQueryDefinition();
  }

  get parameters() {
    return this.children.parameters;
  }

  set parameters(parameters: ASTParameterValueList | undefined) {
    this.edit();
    this.children.parameters = parameters;
  }

  get path() {
    return this.children.path;
  }

  getSourceInfo() {
    const entry = this.arrow.query.model.entries.find(
      entry => entry.name === this.name
    );
    if (entry === undefined) {
      throw new Error(`No query or source named ${this.name}`);
    }
    return entry;
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    const entry = this.getSourceInfo();
    if (entry.kind !== 'query') {
      throw new Error(`Cannot refine source ${this.name}`);
    }
    const newQuery = new ASTRefinementQueryDefinition({
      kind: 'refinement',
      base: {
        ...this.build(),
        kind: 'query_reference',
      },
      refinement: {
        kind: 'segment',
        operations: [],
      },
    });
    this.arrow.source = newQuery;
    return newQuery.refinement.as.SegmentViewDefinition();
  }

  /**
   * @internal
   */
  propagateUp(_f: PropagationFunction): void {
    return;
  }

  /**
   * @internal
   */
  propagateDown(_f: PropagationFunction): void {
    return;
  }

  public getOrAddParameters(): ASTParameterValueList {
    return ASTReference.getOrAddParameters(this);
  }

  public setParameter(
    name: string,
    value: RawLiteralValue | Malloy.LiteralValue
  ) {
    return ASTReference.setParameter(this, name, value);
  }

  public tryGetParameter(name: string): ASTParameterValue | undefined {
    return ASTReference.tryGetParameter(this, name);
  }

  /**
   * @internal
   */
  get query(): ASTQuery {
    return this.parent.parent.as.Query();
  }

  public getSourceParameters(): Malloy.ParameterInfo[] {
    const sourceInfo = this.getSourceInfo();
    if (sourceInfo.kind === 'query') {
      return [];
    }
    return sourceInfo.parameters ?? [];
  }

  areRequiredParametersSet() {
    const sourceParameters = this.getSourceParameters();
    for (const parameterInfo of sourceParameters) {
      if (parameterInfo.default_value !== undefined) continue;
      const parameter = this.tryGetParameter(parameterInfo.name);
      if (parameter === undefined) {
        return false;
      }
    }
    return true;
  }
}

export interface IASTViewDefinition extends IASTQueryOrViewDefinition {
  isRunnable(): boolean;
  getOrAddDefaultSegment(): ASTSegmentViewDefinition;
  getInputSchema(): Malloy.Schema;
  getOutputSchema(): Malloy.Schema;
  getImplicitName(): string | undefined;
  getRefinementSchema(): Malloy.Schema;
  addEmptyRefinement(): ASTSegmentViewDefinition;
  addViewRefinement(name: string, path?: string[]): ASTReferenceViewDefinition;
  convertToNest(name: string);
  isValidViewRefinement(
    name: string,
    path?: string[]
  ): {
    isValidViewRefinement: boolean;
    error?: string;
  };
  getInheritedAnnotations(): Malloy.Annotation[];
}

export type ASTViewDefinition =
  | ASTArrowViewDefinition
  | ASTRefinementViewDefinition
  | ASTSegmentViewDefinition
  | ASTReferenceViewDefinition;
const ASTViewDefinition = {
  from(definition: Malloy.ViewDefinition) {
    switch (definition.kind) {
      case 'arrow':
        return new ASTArrowViewDefinition(definition);
      case 'view_reference':
        return new ASTReferenceViewDefinition(definition);
      case 'segment':
        return new ASTSegmentViewDefinition(definition);
      case 'refinement':
        return new ASTRefinementViewDefinition(definition);
    }
  },
};

function swapViewInParent(node: ASTViewDefinition, view: ASTViewDefinition) {
  const parent = node.parent as
    | ASTArrowQueryDefinition
    | ASTRefinementQueryDefinition
    | ASTView
    | ASTArrowViewDefinition
    | ASTRefinementViewDefinition;
  if (parent instanceof ASTArrowQueryDefinition) {
    parent.view = view;
  } else if (parent instanceof ASTRefinementQueryDefinition) {
    parent.refinement = view;
  } else if (parent instanceof ASTView) {
    parent.definition = view;
  } else if (parent instanceof ASTArrowViewDefinition) {
    if (parent.source === node) {
      parent.source = view;
    } else {
      parent.view = view;
    }
  } else {
    if (parent.base === node) {
      parent.base = view;
    } else {
      parent.refinement = view;
    }
  }
}

function isValidViewRefinement(
  view: ASTViewDefinition,
  name: string,
  path: string[] = []
): {
  isValidViewRefinement: boolean;
  error?: string;
} {
  const schema = view.getInputSchema();
  const field = ASTQuery.schemaGet(schema, name, path);
  if (field === undefined) {
    return {isValidViewRefinement: false, error: `${name} is not defined`};
  } else if (field.kind !== 'view') {
    // TODO scalar refinements
    return {isValidViewRefinement: false, error: `${name} is not a view`};
  }
  const prevOutput = view.getOutputSchema();
  for (const refinementField of field.schema.fields) {
    if (ASTQuery.schemaTryGet(prevOutput, refinementField.name, [])) {
      return {
        isValidViewRefinement: false,
        error: `Cannot refine with ${name} because stage already has an output field named ${refinementField.name}`,
      };
    }
  }
  return {isValidViewRefinement: true};
}

export class ASTReferenceViewDefinition
  extends ASTObjectNode<
    Malloy.ViewDefinitionWithViewReference,
    {
      kind: 'view_reference';
      name: string;
      path?: string[];
      parameters?: ASTParameterValueList;
    }
  >
  implements IASTViewDefinition, IASTReference
{
  constructor(public node: Malloy.ViewDefinitionWithViewReference) {
    super(node, {
      kind: 'view_reference',
      name: node.name,
      path: node.path,
      parameters: node.parameters && new ASTParameterValueList(node.parameters),
    });
  }

  isRunnable(): boolean {
    return true;
  }

  get name() {
    return this.children.name;
  }

  get path() {
    return this.children.path;
  }

  get parameters() {
    return this.children.parameters;
  }

  set parameters(parameters: ASTParameterValueList | undefined) {
    this.edit();
    this.children.parameters = parameters;
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    return this.addEmptyRefinement();
  }

  addEmptyRefinement(): ASTSegmentViewDefinition {
    const newView = ASTRefinementViewDefinition.segmentRefinementOf(
      this.build()
    );
    swapViewInParent(this, newView);
    return newView.refinement.as.SegmentViewDefinition();
  }

  addViewRefinement(name: string, path?: string[]): ASTReferenceViewDefinition {
    const {error} = this.isValidViewRefinement(name, path);
    if (error) {
      throw new Error(error);
    }
    const newView = ASTRefinementViewDefinition.viewRefinementOf(
      this.build(),
      name,
      path
    );
    swapViewInParent(this, newView);
    return newView.refinement.as.ReferenceViewDefinition();
  }

  convertToNest(name: string) {
    const nestedView = ASTViewDefinition.from({
      kind: 'segment',
      operations: [
        {
          kind: 'nest',
          name,
          view: {
            definition: this.build(),
          },
        },
      ],
    });
    swapViewInParent(this, nestedView);
  }

  isValidViewRefinement(
    name: string,
    path?: string[]
  ): {
    isValidViewRefinement: boolean;
    error?: string;
  } {
    return isValidViewRefinement(this, name, path);
  }

  getInputSchema(): Malloy.Schema {
    return getInputSchemaFromViewParent(this.parent as ViewParent);
  }

  getOutputSchema(): Malloy.Schema {
    const parent = this.parent as ViewParent;
    return parent.getOutputSchema();
  }

  getImplicitName(): string | undefined {
    return this.name;
  }

  getViewInfo(): Malloy.FieldInfoWithView {
    const schema = this.getInputSchema();
    const view = ASTNode.schemaGet(schema, this.name, this.path);
    if (view.kind !== 'view') {
      throw new Error('Not a view');
    }
    return view;
  }

  getRefinementSchema(): Malloy.Schema {
    const view = this.getViewInfo();
    return view.schema;
  }

  /**
   * @internal
   */
  propagateUp(f: PropagationFunction): void {
    (this.parent as ViewParent).propagateUp(f);
  }

  /**
   * @internal
   */
  propagateDown(_f: PropagationFunction): void {
    return;
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    const view = this.getViewInfo();
    return view.annotations ?? [];
  }

  public getOrAddParameters(): ASTParameterValueList {
    return ASTReference.getOrAddParameters(this);
  }

  public setParameter(
    name: string,
    value: RawLiteralValue | Malloy.LiteralValue
  ) {
    return ASTReference.setParameter(this, name, value);
  }

  public tryGetParameter(name: string): ASTParameterValue | undefined {
    return ASTReference.tryGetParameter(this, name);
  }
}

export class ASTArrowViewDefinition
  extends ASTObjectNode<
    Malloy.ViewDefinitionWithArrow,
    {
      kind: 'arrow';
      source: ASTViewDefinition;
      view: ASTViewDefinition;
    }
  >
  implements IASTViewDefinition
{
  constructor(public node: Malloy.ViewDefinitionWithArrow) {
    super(node, {
      kind: 'arrow',
      source: ASTViewDefinition.from(node.source),
      view: ASTViewDefinition.from(node.view),
    });
  }

  isRunnable(): boolean {
    return this.source.isRunnable() && this.view.isRunnable();
  }

  get source() {
    return this.children.source;
  }

  set source(source: ASTViewDefinition) {
    this.edit();
    this.children.source = source;
  }

  get view() {
    return this.children.view;
  }

  set view(view: ASTViewDefinition) {
    this.edit();
    this.children.view = view;
    view.parent = this;
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    return this.view.getOrAddDefaultSegment();
  }

  addEmptyRefinement(): ASTSegmentViewDefinition {
    return this.view.addEmptyRefinement();
  }

  addViewRefinement(name: string, path?: string[]): ASTReferenceViewDefinition {
    return this.view.addViewRefinement(name, path);
  }

  convertToNest(name: string) {
    const nestedView = ASTViewDefinition.from({
      kind: 'segment',
      operations: [
        {
          kind: 'nest',
          name,
          view: {
            definition: this.build(),
          },
        },
      ],
    });
    swapViewInParent(this, nestedView);
  }

  getInputSchema(): Malloy.Schema {
    return this.source.getOutputSchema();
  }

  getOutputSchema(): Malloy.Schema {
    return this.view.getRefinementSchema();
  }

  getImplicitName(): string | undefined {
    return this.view.getImplicitName();
  }

  getRefinementSchema(): Malloy.Schema {
    throw new Error('An arrow is not a valid refinement');
  }

  isValidViewRefinement(
    name: string,
    path?: string[]
  ): {
    isValidViewRefinement: boolean;
    error?: string;
  } {
    return isValidViewRefinement(this, name, path);
  }

  /**
   * @internal
   */
  propagateUp(f: PropagationFunction): void {
    this.propagateDown(f);
  }

  /**
   * @internal
   */
  propagateDown(f: PropagationFunction): void {
    f(this.view);
    this.view.propagateDown(f);
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    return [];
  }
}

type ViewParent =
  | ASTArrowQueryDefinition
  | ASTRefinementQueryDefinition
  | ASTView
  | ASTArrowViewDefinition
  | ASTRefinementViewDefinition;

export class ASTRefinementViewDefinition
  extends ASTObjectNode<
    Malloy.ViewDefinitionWithRefinement,
    {
      kind: 'refinement';
      base: ASTViewDefinition;
      refinement: ASTViewDefinition;
    }
  >
  implements IASTViewDefinition
{
  constructor(public node: Malloy.ViewDefinitionWithRefinement) {
    super(node, {
      kind: 'refinement',
      base: ASTViewDefinition.from(node.base),
      refinement: ASTViewDefinition.from(node.refinement),
    });
  }

  isRunnable(): boolean {
    const schema = this.getOutputSchema();
    return schema.fields.length > 0;
  }

  get refinement() {
    return this.children.refinement;
  }

  set refinement(refinement: ASTViewDefinition) {
    this.edit();
    this.children.refinement = refinement;
    refinement.parent = this;
  }

  get base() {
    return this.children.base;
  }

  set base(base: ASTViewDefinition) {
    this.edit();
    this.children.base = base;
  }

  convertToNest(name: string) {
    const nestedView = ASTViewDefinition.from({
      kind: 'segment',
      operations: [
        {
          kind: 'nest',
          name,
          view: {
            definition: this.build(),
          },
        },
      ],
    });
    swapViewInParent(this, nestedView);
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    return this.refinement.getOrAddDefaultSegment();
  }

  addEmptyRefinement(): ASTSegmentViewDefinition {
    return this.refinement.addEmptyRefinement();
  }

  addViewRefinement(name: string, path?: string[]): ASTReferenceViewDefinition {
    return this.refinement.addViewRefinement(name, path);
  }

  getInputSchema(): Malloy.Schema {
    return getInputSchemaFromViewParent(this.parent as ViewParent);
  }

  getOutputSchema(): Malloy.Schema {
    const parent = this.parent as ViewParent;
    return parent.getOutputSchema();
  }

  getRefinementSchema(): Malloy.Schema {
    return ASTNode.schemaMerge(
      this.base.getRefinementSchema(),
      this.refinement.getRefinementSchema()
    );
  }

  getImplicitName(): string | undefined {
    return this.base.getImplicitName();
  }

  isValidViewRefinement(
    name: string,
    path?: string[]
  ): {
    isValidViewRefinement: boolean;
    error?: string;
  } {
    return isValidViewRefinement(this, name, path);
  }

  /**
   * @internal
   */
  propagateUp(f: PropagationFunction): void {
    (this.parent as ViewParent).propagateUp(f);
  }

  /**
   * @internal
   */
  propagateDown(f: PropagationFunction): void {
    f(this.base);
    f(this.refinement);
    this.base.propagateDown(f);
    this.refinement.propagateDown(f);
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    return this.base.getInheritedAnnotations();
  }

  /**
   * @internal
   */
  static viewRefinementOf(
    view: Malloy.ViewDefinition,
    name: string,
    path?: string[]
  ) {
    return new ASTRefinementViewDefinition({
      kind: 'refinement',
      base: view,
      refinement: {
        kind: 'view_reference',
        name,
        path,
      },
    });
  }

  /**
   * @internal
   */
  static segmentRefinementOf(view: Malloy.ViewDefinition) {
    return new ASTRefinementViewDefinition({
      kind: 'refinement',
      base: view,
      refinement: {
        kind: 'segment',
        operations: [],
      },
    });
  }
}

export class ASTSegmentViewDefinition
  extends ASTObjectNode<
    Malloy.ViewDefinitionWithSegment,
    {
      kind: 'segment';
      operations: ASTViewOperationList;
    }
  >
  implements IASTViewDefinition
{
  constructor(public node: Malloy.ViewDefinitionWithSegment) {
    super(node, {
      kind: 'segment',
      operations: new ASTViewOperationList(node.operations),
    });
  }

  isRunnable(): boolean {
    let hasValidNest = false;
    for (const operation of this.operations.iter()) {
      if (
        operation instanceof ASTAggregateViewOperation ||
        operation instanceof ASTGroupByViewOperation
      ) {
        return true;
      } else if (operation instanceof ASTNestViewOperation) {
        if (!operation.view.definition.isRunnable()) {
          return false;
        }
        hasValidNest = true;
      }
    }
    return hasValidNest;
  }

  get operations() {
    return this.children.operations;
  }

  convertToNest(name: string) {
    const nestedView = ASTViewDefinition.from({
      kind: 'segment',
      operations: [
        {
          kind: 'nest',
          name,
          view: {
            definition: this.build(),
          },
        },
      ],
    });
    swapViewInParent(this, nestedView);
  }

  /**
   * @internal
   */
  renameOrderBys(oldName: string, newName: string) {
    for (const operation of this.operations.iter()) {
      if (operation instanceof ASTOrderByViewOperation) {
        if (operation.name === oldName) {
          operation.setField(newName);
        }
      }
    }
  }

  /**
   * @internal
   */
  propagateUp(f: PropagationFunction): void {
    (this.parent as ViewParent).propagateUp(f);
  }

  /**
   * @internal
   */
  propagateDown(_f: PropagationFunction): void {
    return;
  }

  /**
   * @internal
   */
  removeOrderBys(name: string): void {
    for (const operation of this.operations.iter()) {
      if (operation instanceof ASTOrderByViewOperation) {
        if (operation.name === name) {
          operation.delete();
        }
      }
    }
  }

  reorderFields(names: string[]): void {
    const leadingOperations: ASTViewOperation[] = [];
    const trailingOperations: ASTViewOperation[] = [];
    const opsByName: {
      [name: string]:
        | ASTAggregateViewOperation
        | ASTGroupByViewOperation
        | ASTNestViewOperation;
    } = {};
    let seenAnyNamed = false;
    for (const operation of this.operations.iter()) {
      if (
        operation instanceof ASTAggregateViewOperation ||
        operation instanceof ASTGroupByViewOperation ||
        operation instanceof ASTNestViewOperation
      ) {
        if (names.includes(operation.name)) {
          opsByName[operation.name] = operation;
          seenAnyNamed = true;
          continue;
        }
      }
      if (seenAnyNamed) {
        trailingOperations.push(operation);
      } else {
        leadingOperations.push(operation);
      }
    }
    const middleOperations: ASTViewOperation[] = [];
    for (const name of names) {
      const operation = opsByName[name];
      if (operation === undefined) {
        throw new Error(`No field named ${name}`);
      }
      middleOperations.push(operation);
    }
    const operations = [
      ...leadingOperations,
      ...middleOperations,
      ...trailingOperations,
    ];
    this.operations.items = operations;
  }

  public renameField(
    field:
      | ASTAggregateViewOperation
      | ASTGroupByViewOperation
      | ASTNestViewOperation,
    name: string
  ) {
    if (field.name === name) return;
    const output = this.getOutputSchema();
    if (ASTNode.schemaTryGet(output, name, [])) {
      throw new Error(`Output already has a field named ${name}`);
    }
    const oldName = field.name;
    field.name = name;
    this.propagateUp(v => {
      if (v instanceof ASTSegmentViewDefinition) {
        v.renameOrderBys(oldName, name);
      }
    });
  }

  /**
   * Adds an order by to the segment. Will override the direction of an existing order by
   * if one is present for the same field.
   *
   * ```
   * run: flights -> { group_by: carrier }
   * ```
   * ```ts
   * q.getOrAddDefaultSegment().addOrderBy("carrier", Malloy.OrderByDirection.DESC);
   * ```
   * ```
   * run: flights -> {
   *   group_by: carrier
   *   order_by: carrier desc
   * }
   * ```
   *
   * The order by item is added after an existing order by operation if one is present,
   * or to a new order by operation at the end of the query.
   *
   * @param name The name of the field to order by.
   * @param direction The order by direction (ascending or descending).
   */
  public addOrderBy(
    name: string,
    direction?: Malloy.OrderByDirection
  ): ASTOrderByViewOperation {
    // Ensure output schema has a field with this name
    const outputSchema = this.getOutputSchema();
    try {
      ASTNode.schemaGet(outputSchema, name, []);
    } catch {
      throw new Error(`No such field ${name} in stage output`);
    }
    // first see if there is already an order by for this field
    for (const operation of this.operations.iter()) {
      if (operation instanceof ASTOrderByViewOperation) {
        if (operation.name === name) {
          operation.direction = direction;
          return operation;
        }
      }
    }
    const operation = new ASTOrderByViewOperation({
      kind: 'order_by',
      field_reference: {name},
      direction,
    });
    // add a new order by operation
    this.addOperation(operation);
    return operation;
  }

  /**
   * Adds an empty nest to this segment, with the given name.
   * @param name The name of the new nest.
   *
   * The new nest is always added to the end of the query in a new nest block.
   *
   * ```
   * run: flights -> { group_by: carrier }
   * ```
   * ```ts
   * q.getOrAddDefaultSegment().addEmptyNest("by_origin");
   * ```
   * ```
   * run: flights -> {
   *   group_by: carrier
   *   nest: by_origin is { }
   * }
   * ```
   *
   * @returns The {@link ASTNestViewOperation} that was created.
   *
   */
  public addEmptyNest(name: string): ASTNestViewOperation {
    const nest = new ASTNestViewOperation({
      kind: 'nest',
      name,
      view: {
        definition: {
          kind: 'segment',
          operations: [],
        },
      },
    });
    this.addOperation(nest);
    return nest;
  }

  private firstIndexOfOperationType(type: Malloy.ViewOperationType) {
    return this.operations.findIndex(o => o.kind === type);
  }

  private DEFAULT_INSERTION_ORDER: Malloy.ViewOperationType[] = [
    'group_by',
    'aggregate',
    'drill',
    'where',
    'having',
    'nest',
    'order_by',
    'calculate',
    'limit',
  ];

  private findInsertionPoint(kind: Malloy.ViewOperationType): number {
    const firstOfType = this.firstIndexOfOperationType(kind);
    if (firstOfType > -1) {
      let i = firstOfType;
      while (this.operations.index(i) && this.operations.index(i).kind === kind)
        i++;
      return i;
    }
    const indexInOrder = this.DEFAULT_INSERTION_ORDER.indexOf(kind);
    if (indexInOrder === -1) {
      throw new Error(
        `Operation ${kind} is not supported for \`findInsertionPoint\``
      );
    }
    const laterOperations = this.DEFAULT_INSERTION_ORDER.slice(
      indexInOrder + 1
    );
    for (const laterType of laterOperations) {
      const firstOfType = this.firstIndexOfOperationType(laterType);
      if (firstOfType > -1) return firstOfType;
    }
    return this.operations.length;
  }

  public getFieldNamed(
    name: string
  ):
    | ASTGroupByViewOperation
    | ASTAggregateViewOperation
    | ASTNestViewOperation
    | ASTCalculateViewOperation
    | undefined {
    const field = this.tryGetFieldNamed(name);
    if (field === undefined) throw new Error('No such field');
    return field;
  }

  public hasFieldNamed(name: string): boolean {
    return this.tryGetFieldNamed(name) !== undefined;
  }

  public hasField(name: string, path?: string[]): boolean {
    return this.tryGetField(name, path) !== undefined;
  }

  public getField(
    name: string,
    path?: string[]
  ):
    | ASTGroupByViewOperation
    | ASTAggregateViewOperation
    | ASTNestViewOperation
    | ASTCalculateViewOperation {
    const field = this.tryGetField(name, path);
    if (field === undefined) {
      throw new Error('No such field');
    }
    return field;
  }

  // TODO what constitutes "having a field" -- does "dep_time.month" count as dep_time?
  // does flight_count {where: carrier = 'CA' } count as flight_count?
  public tryGetField(
    name: string,
    path?: string[]
  ):
    | ASTGroupByViewOperation
    | ASTAggregateViewOperation
    | ASTNestViewOperation
    | ASTCalculateViewOperation
    | undefined {
    for (const operation of this.operations.iter()) {
      if (
        operation instanceof ASTGroupByViewOperation ||
        operation instanceof ASTAggregateViewOperation
      ) {
        const reference = operation.field.getReference();
        if (
          reference &&
          reference.name === name &&
          pathsMatch(reference.path, path)
        ) {
          return operation;
        }
      } else if (operation instanceof ASTNestViewOperation) {
        if (operation.view instanceof ASTReferenceViewDefinition) {
          return operation;
        }
      } else if (operation instanceof ASTCalculateViewOperation) {
        const reference = operation.expression.field.getReference();
        if (
          reference &&
          reference.name === name &&
          pathsMatch(reference.path, path)
        ) {
          return operation;
        }
      }
    }
    return undefined;
  }

  public tryGetFieldNamed(
    name: string
  ):
    | ASTGroupByViewOperation
    | ASTAggregateViewOperation
    | ASTNestViewOperation
    | ASTCalculateViewOperation
    | undefined {
    for (const operation of this.operations.iter()) {
      if (
        operation instanceof ASTGroupByViewOperation ||
        operation instanceof ASTAggregateViewOperation ||
        operation instanceof ASTNestViewOperation ||
        operation instanceof ASTCalculateViewOperation
      ) {
        if (operation.name === name) {
          return operation;
        }
      }
    }
    return undefined;
  }

  public getGroupBy(name: string) {
    for (const operation of this.operations.iter()) {
      if (operation instanceof ASTGroupByViewOperation) {
        if (operation.name === name) {
          return operation;
        }
      }
    }
  }

  public removeGroupBy(name: string) {
    this.getGroupBy(name)?.delete();
    return this;
  }

  /**
   * Adds a group by field with the given name to this segment.
   *
   * ```
   * run: flights -> { }
   * ```
   * ```ts
   * q.getOrAddDefaultSegment().addGroupBy("carrier");
   * ```
   * ```
   * run: flights -> { group_by: carrier }
   * ```
   *
   * If there is already a group by clause, the new field will be added
   * to that clause (or the first one if there are multiple).
   *
   * ```
   * run: flights -> { group_by: carrier }
   * ```
   * ```ts
   * q.getOrAddDefaultSegment().addGroupBy("origin_code");
   * ```
   * ```
   * run: flights -> {
   *   group_by:
   *     carrier
   *     origin_code
   * }
   * ```
   *
   * If there is no group by clause, it will be added
   *   1) before the first aggregate clause if there is one, or
   *   2) before the first nest clause if there is one, or
   *   3) before the first order by clause if ther is one, or
   *   4) at the end of the query
   *
   * ```
   * run: flights -> {
   *   order_by: flight_count
   *   aggregate: flight_count
   * }
   * ```
   * ```ts
   * q.getOrAddDefaultSegment().addGroupBy("carrier");
   * ```
   * ```
   * run: flights -> {
   *   order_by: flight_count
   *   group_by: carrier
   *   aggregate: flight_count
   * }
   * ```
   *
   * @param name The name of the dimension to group by.
   * @param path Join path for this dimension.
   */
  public addGroupBy(name: string, path: string[] = [], rename?: string) {
    const item = this.makeField(name, path, rename, 'dimension');
    this.addOperation(item);
    return item;
  }

  public addDrill(drill: Malloy.DrillOperation) {
    const item = new ASTDrillViewOperation({
      kind: 'drill',
      ...drill,
    });
    this.addOperation(item);
    return item;
  }

  public addWhere(name: string, filter: ParsedFilter): ASTWhereViewOperation;
  public addWhere(name: string, filterString: string): ASTWhereViewOperation;
  public addWhere(
    name: string,
    path: string[],
    filter: ParsedFilter
  ): ASTWhereViewOperation;
  public addWhere(
    name: string,
    path: string[],
    filterString: string
  ): ASTWhereViewOperation;
  public addWhere(
    name: string,
    arg2: string[] | string | ParsedFilter,
    arg3?: string | ParsedFilter
  ): ASTWhereViewOperation {
    const path = Array.isArray(arg2) ? arg2 : [];
    const filter = arg3 === undefined ? (arg2 as string | ParsedFilter) : arg3;
    const filterString =
      typeof filter === 'string' ? filter : serializeFilter(filter);
    const schema = this.getInputSchema();
    // Validate name
    const field = ASTQuery.schemaGet(schema, name, path);
    // Validate filter
    validateFilter(field, filter);
    const item = new ASTWhereViewOperation({
      kind: 'where',
      filter: {
        kind: 'filter_string',
        expression: {
          kind: 'field_reference',
          name,
          path,
        },
        filter: filterString,
      },
    });
    this.addOperation(item);
    return item;
  }

  public addHaving(name: string, filter: ParsedFilter): ASTHavingViewOperation;
  public addHaving(name: string, filterString: string): ASTHavingViewOperation;
  public addHaving(
    name: string,
    path: string[],
    filter: ParsedFilter
  ): ASTHavingViewOperation;
  public addHaving(
    name: string,
    path: string[],
    filterString: string
  ): ASTHavingViewOperation;
  public addHaving(
    name: string,
    arg2: string[] | string | ParsedFilter,
    arg3?: string | ParsedFilter
  ): ASTHavingViewOperation {
    const path = Array.isArray(arg2) ? arg2 : [];
    const filter = arg3 === undefined ? (arg2 as string | ParsedFilter) : arg3;
    const filterString =
      typeof filter === 'string' ? filter : serializeFilter(filter);
    const schema = this.getInputSchema();
    // Validate name
    const field = ASTQuery.schemaGet(schema, name, path);
    // Validate filter
    validateFilter(field, filter);
    const item = new ASTHavingViewOperation({
      kind: 'having',
      filter: {
        kind: 'filter_string',
        expression: {
          kind: 'field_reference',
          name,
          path,
        },
        filter: filterString,
      },
    });
    this.addOperation(item);
    return item;
  }

  addCalculateMovingAverage(
    outputName: string,
    inputName: string,
    inputPath: string[],
    rowsPreceding: number,
    rowsFollowing: number
  ): ASTCalculateViewOperation {
    const item = new ASTCalculateViewOperation({
      kind: 'calculate',
      name: outputName,
      field: {
        expression: {
          kind: 'moving_average',
          field_reference: {name: inputName, path: inputPath},
          rows_preceding: rowsPreceding,
          rows_following: rowsFollowing,
        },
      },
    });
    this.addOperation(item);
    return item;
  }

  private addTimeGroupBy(
    name: string,
    path: string[],
    timeframe: Malloy.TimestampTimeframe,
    type: 'date_type' | 'timestamp_type' | 'timestamptz_type'
  ): ASTGroupByViewOperation {
    const schema = this.getInputSchema();
    const fieldInfo = ASTNode.schemaGet(schema, name, path);
    if (fieldInfo === undefined) {
      throw new Error(`No such field ${name}`);
    }
    if (fieldInfo.kind !== 'dimension') {
      throw new Error(`Cannot group by non-dimension ${name}`);
    }
    if (fieldInfo.type.kind !== type) {
      throw new Error(`${name} is not a ${type}`);
    }
    const item = new ASTGroupByViewOperation({
      kind: 'group_by',
      field: {
        expression: {
          kind: 'time_truncation',
          field_reference: {name, path},
          truncation: timeframe,
        },
      },
    });
    this.addOperation(item);
    return item;
  }

  public addDateGroupBy(
    name: string,
    path: string[],
    timeframe: Malloy.DateTimeframe
  ): ASTGroupByViewOperation;
  public addDateGroupBy(
    name: string,
    timeframe: Malloy.DateTimeframe
  ): ASTGroupByViewOperation;
  public addDateGroupBy(
    name: string,
    arg2: string[] | Malloy.DateTimeframe,
    arg3?: Malloy.DateTimeframe
  ): ASTGroupByViewOperation {
    const timeframe =
      arg3 === undefined ? (arg2 as Malloy.DateTimeframe) : arg3;
    const path = arg3 === undefined ? [] : (arg2 as string[]);
    return this.addTimeGroupBy(name, path, timeframe, 'date_type');
  }

  public addTimestampGroupBy(
    name: string,
    path: string[],
    timeframe: Malloy.TimestampTimeframe
  ): ASTGroupByViewOperation;
  public addTimestampGroupBy(
    name: string,
    timeframe: Malloy.TimestampTimeframe
  ): ASTGroupByViewOperation;
  public addTimestampGroupBy(
    name: string,
    arg2: string[] | Malloy.TimestampTimeframe,
    arg3?: Malloy.TimestampTimeframe
  ): ASTGroupByViewOperation {
    const timeframe =
      arg3 === undefined ? (arg2 as Malloy.TimestampTimeframe) : arg3;
    const path = arg3 === undefined ? [] : (arg2 as string[]);
    return this.addTimeGroupBy(name, path, timeframe, 'timestamp_type');
  }

  public addTimestamptzGroupBy(
    name: string,
    path: string[],
    timeframe: Malloy.TimestampTimeframe
  ): ASTGroupByViewOperation;
  public addTimestamptzGroupBy(
    name: string,
    timeframe: Malloy.TimestampTimeframe
  ): ASTGroupByViewOperation;
  public addTimestamptzGroupBy(
    name: string,
    arg2: string[] | Malloy.TimestampTimeframe,
    arg3?: Malloy.TimestampTimeframe
  ): ASTGroupByViewOperation {
    const timeframe =
      arg3 === undefined ? (arg2 as Malloy.TimestampTimeframe) : arg3;
    const path = arg3 === undefined ? [] : (arg2 as string[]);
    return this.addTimeGroupBy(name, path, timeframe, 'timestamptz_type');
  }

  /**
   * Adds an aggregate item with the given name to this segment.
   *
   * ```
   * run: flights -> { }
   * ```
   * ```ts
   * q.getOrAddDefaultSegment().addAggregate("flight_count");
   * ```
   * ```
   * run: flights -> { aggregate: flight_count }
   * ```
   *
   * Added
   *   1) at the end of an existing aggregate clause if ther is one, or
   *   2) before the first nest clause if there is one, or
   *   3) before the first order by clause if ther is one, or
   *   4) at the end of the query
   *
   * @param name The name of the measure to aggregate.
   * @param path The join path of the measure to aggregate.
   * @param rename A new name for this measure
   */
  public addAggregate(name: string, path: string[] = [], rename?: string) {
    const item = this.makeField(name, path, rename, 'measure');
    this.addOperation(item);
    return item;
  }

  /**
   * Adds a nest item with the given name to this segment.
   *
   * ```
   * run: flights -> { }
   * ```
   * ```ts
   * q.getOrAddDefaultSegment().addNest("by_carrier");
   * ```
   * ```
   * run: flights -> { nest: by_carrier }
   * ```
   *
   * Added
   *   1) at the end of an existing nest clause if there is one, or
   *   2) before the first order by clause if ther is one, or
   *   3) at the end of the query
   *
   * @param name The name of the view to nest.
   * @param rename A new name for this view in the query
   */
  public addNest(name: string, rename?: string) {
    const item = this.makeField(name, [], rename, 'view');
    this.addOperation(item);
    return item;
  }

  private makeField(
    name: string,
    path: string[],
    rename: string | undefined,
    type: 'dimension'
  ): ASTGroupByViewOperation;
  private makeField(
    name: string,
    path: string[],
    rename: string | undefined,
    type: 'measure'
  ): ASTAggregateViewOperation;
  private makeField(
    name: string,
    path: string[],
    rename: string | undefined,
    type: 'view'
  ): ASTNestViewOperation;
  private makeField(
    name: string,
    path: string[],
    rename: string | undefined,
    type: 'dimension' | 'measure' | 'view'
  ) {
    const schema = this.getInputSchema();
    const fieldInfo = ASTNode.schemaGet(schema, name, path);
    if (fieldInfo === undefined) {
      throw new Error(`No such field ${name}`);
    }
    if (fieldInfo.kind !== type) {
      const action = fieldTypeToAction(type);
      const typeName = fieldTypeName(type);
      throw new Error(`Cannot ${action} non-${typeName} ${name}`);
    }
    if (type === 'dimension') {
      return ASTGroupByViewOperation.fromReference(name, path, rename);
    } else if (type === 'measure') {
      return ASTAggregateViewOperation.fromReference(name, path, rename);
    } else {
      return ASTNestViewOperation.fromReference(name, path, rename);
    }
  }

  private addOperation(
    item:
      | ASTGroupByViewOperation
      | ASTAggregateViewOperation
      | ASTNestViewOperation
      | ASTWhereViewOperation
      | ASTHavingViewOperation
      | ASTOrderByViewOperation
      | ASTDrillViewOperation
      | ASTCalculateViewOperation
  ) {
    if (
      item instanceof ASTGroupByViewOperation ||
      item instanceof ASTAggregateViewOperation ||
      item instanceof ASTNestViewOperation ||
      item instanceof ASTCalculateViewOperation
    ) {
      if (this.hasFieldNamed(item.name)) {
        throw new Error(`Query already has a field named ${item.name}`);
      }
    }
    const whereToInsert = this.findInsertionPoint(item.kind);
    this.operations.insert(item, whereToInsert);
    return item;
  }

  /**
   * @internal
   */
  getRefinementSchema(): Malloy.Schema {
    const fields: Malloy.FieldInfo[] = [];
    for (const operation of this.operations.iter()) {
      if (
        operation instanceof ASTGroupByViewOperation ||
        operation instanceof ASTAggregateViewOperation ||
        operation instanceof ASTNestViewOperation ||
        operation instanceof ASTCalculateViewOperation
      ) {
        // TODO convert measures into dimensions for output
        fields.push(operation.getFieldInfo());
      }
    }
    return {fields};
  }

  /**
   * Sets the limit for this segment. Overrides an existing limit.
   *
   * ```
   * run: flights -> { group_by: carrier }
   * ```
   * ```ts
   * q.getOrAddDefaultSegment().setLimit(10);
   * ```
   * ```
   * run: flights -> {
   *   group_by: carrier
   *   limit: 10
   * }
   * ```
   *
   * @param limit The limit to set. Must be an integer.
   */
  public setLimit(limit: number) {
    ASTLimitViewOperation.validateLimit(limit);
    const limitOp: ASTLimitViewOperation | undefined = [
      ...this.operations.iter(),
    ].find(ASTViewOperation.isLimit);
    if (limitOp) {
      limitOp.limit = limit;
    } else {
      this.operations.add(
        new ASTLimitViewOperation({
          kind: 'limit',
          limit,
        })
      );
    }
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    return this;
  }

  addEmptyRefinement(): ASTSegmentViewDefinition {
    const view = ASTRefinementViewDefinition.segmentRefinementOf(this.build());
    swapViewInParent(this, view);
    return view.refinement.as.SegmentViewDefinition();
  }

  addViewRefinement(name: string, path?: string[]): ASTReferenceViewDefinition {
    const {error} = this.isValidViewRefinement(name, path);
    if (error) {
      throw new Error(error);
    }
    const view = ASTRefinementViewDefinition.viewRefinementOf(
      this.build(),
      name,
      path
    );
    swapViewInParent(this, view);
    return view.refinement.as.ReferenceViewDefinition();
  }

  getInputSchema(): Malloy.Schema {
    return getInputSchemaFromViewParent(this.parent as ViewParent);
  }

  getOutputSchema(): Malloy.Schema {
    const parent = this.parent as ViewParent;
    return parent.getOutputSchema();
  }

  getImplicitName(): string | undefined {
    return undefined;
  }

  isValidViewRefinement(
    name: string,
    path?: string[]
  ): {
    isValidViewRefinement: boolean;
    error?: string;
  } {
    return isValidViewRefinement(this, name, path);
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    return [];
  }
}

export class ASTViewOperationList extends ASTListNode<
  Malloy.ViewOperation,
  ASTViewOperation
> {
  constructor(operations: Malloy.ViewOperation[]) {
    super(
      operations,
      operations.map(p => ASTViewOperation.from(p))
    );
  }

  get items() {
    return this.children;
  }

  /**
   * @internal
   */
  set items(operations: ASTViewOperation[]) {
    this.edit();
    this.children = operations;
  }

  /**
   * @internal
   */
  get segment() {
    return this.parent.as.SegmentViewDefinition();
  }
}

export type ASTViewOperation =
  | ASTGroupByViewOperation
  | ASTAggregateViewOperation
  | ASTOrderByViewOperation
  | ASTNestViewOperation
  | ASTLimitViewOperation
  | ASTWhereViewOperation
  | ASTDrillViewOperation
  | ASTHavingViewOperation
  | ASTCalculateViewOperation;
export const ASTViewOperation = {
  from(value: Malloy.ViewOperation): ASTViewOperation {
    switch (value.kind) {
      case 'group_by':
        return new ASTGroupByViewOperation(value);
      case 'aggregate':
        return new ASTAggregateViewOperation(value);
      case 'order_by':
        return new ASTOrderByViewOperation(value);
      case 'nest':
        return new ASTNestViewOperation(value);
      case 'limit':
        return new ASTLimitViewOperation(value);
      case 'where':
        return new ASTWhereViewOperation(value);
      case 'drill':
        return new ASTDrillViewOperation(value);
      case 'having':
        return new ASTHavingViewOperation(value);
      case 'calculate':
        return new ASTCalculateViewOperation(value);
    }
  },
  isLimit(x: ASTViewOperation): x is ASTLimitViewOperation {
    return x instanceof ASTLimitViewOperation;
  },
};

export interface IASTAnnotatable {
  getOrAddAnnotations(): ASTAnnotationList;
  getInheritedTag(prefix: RegExp | string): Tag;
  getIntrinsicTag(prefix: RegExp | string): Tag;
  getTag(prefix: RegExp | string): Tag;
  setTagProperty(path: Path, value: TagSetValue, prefix: string): void;
  removeTagProperty(path: Path, prefix: string): void;
}

export class ASTOrderByViewOperation extends ASTObjectNode<
  Malloy.ViewOperationWithOrderBy,
  {
    kind: 'order_by';
    field_reference: ASTFieldReference;
    direction?: Malloy.OrderByDirection;
  }
> {
  readonly kind: Malloy.ViewOperationType = 'order_by';
  constructor(public node: Malloy.ViewOperationWithOrderBy) {
    super(node, {
      kind: 'order_by',
      field_reference: new ASTFieldReference(node.field_reference),
      direction: node.direction,
    });
  }

  get fieldReference() {
    return this.children.field_reference;
  }

  get name() {
    return this.fieldReference.name;
  }

  get direction() {
    return this.children.direction;
  }

  set direction(direction: Malloy.OrderByDirection | undefined) {
    if (this.direction === direction) return;
    this.edit();
    this.children.direction = direction;
  }

  get list() {
    return this.parent.as.ViewOperationList();
  }

  delete() {
    const list = this.list;
    list.remove(this);
  }

  setField(name: string) {
    const schema = this.list.segment.getOutputSchema();
    ASTNode.schemaGet(schema, name, []);
    this.edit();
    this.children.field_reference = new ASTFieldReference({name});
  }

  setDirection(direction: Malloy.OrderByDirection | undefined) {
    this.direction = direction;
  }
}

export class ASTGroupByViewOperation
  extends ASTObjectNode<
    Malloy.ViewOperationWithGroupBy,
    {
      kind: 'group_by';
      name?: string;
      field: ASTField;
    }
  >
  implements IASTAnnotatable
{
  readonly kind: Malloy.ViewOperationType = 'group_by';
  constructor(public node: Malloy.ViewOperationWithGroupBy) {
    super(node, {
      kind: 'group_by',
      name: node.name,
      field: new ASTField(node.field),
    });
  }

  get field() {
    return this.children.field;
  }

  get name() {
    const name = this.children.name ?? this.field.name;
    if (name === undefined) {
      throw new Error('Group by does not have a name');
    }
    return name;
  }

  set name(name: string) {
    if (this.name === name) return;
    this.edit();
    if (this.field.name === name) {
      this.children.name = undefined;
    } else {
      this.children.name = name;
    }
  }

  /**
   * @internal
   */
  get list() {
    return this.parent.as.ViewOperationList();
  }

  /**
   * Renames the group by item. If the field's name matches the given name,
   * removes the `name is` part.
   *
   * ```
   * run: flights -> { group_by: carrier }
   * ```
   * ```ts
   * groupBy.rename("carrier_2");
   * ```
   * ```
   * run: flights -> { group_by: carrier2 is carrier }
   * ```
   *
   * ```
   * run: flights -> { group_by: renamed is carrier }
   * ```
   * ```ts
   * groupBy.rename("carrier");
   * ```
   * ```
   * run: flights -> { group_by: carrier }
   * ```
   *
   *
   * @param name The new name
   */
  rename(name: string) {
    this.list.segment.renameField(this, name);
  }

  /**
   * Delete this group by item.
   *
   * Possible side effects:
   *   - If this was the last item in the group by operation, the whole
   *     operation is removed.
   *   - Any order by that references this group by item will be removed.
   *
   * ```
   * run: flights -> {
   *   group_by: carrier
   *   aggregate: flight_count
   *   order by:
   *     flight_count desc
   *     carrier asc
   * }
   * ```
   * ```ts
   * groupBy.delete();
   * ```
   * ```
   * run: flights -> {
   *   aggregate: flight_count
   *   order by: flight_count desc
   * }
   * ```
   *
   */
  delete() {
    this.list.remove(this);
    this.list.segment.propagateUp(v => {
      if (v instanceof ASTSegmentViewDefinition) {
        v.removeOrderBys(this.name);
      }
    });
  }

  getFieldInfo(): Malloy.FieldInfo {
    return {
      kind: 'dimension',
      name: this.name,
      type: this.field.type,
    };
  }

  private get annotations() {
    return this.field.annotations;
  }

  private set annotations(annotations: ASTAnnotationList | undefined) {
    this.edit();
    this.field.annotations = annotations;
  }

  getOrAddAnnotations() {
    return this.field.getOrAddAnnotations();
  }

  getInheritedTag(prefix: RegExp | string = '# ') {
    return tagFromAnnotations(prefix, this.field.getInheritedAnnotations());
  }

  getIntrinsicTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getIntrinsicTag(prefix) ?? new Tag();
  }

  getTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getTag(prefix) ?? this.getInheritedTag(prefix);
  }

  setTagProperty(path: Path, value: TagSetValue = null, prefix = '# ') {
    this.getOrAddAnnotations().setTagProperty(path, value, prefix);
  }

  removeTagProperty(path: Path, prefix = '# ') {
    if (!this.getTag().has(...path)) return;
    this.getOrAddAnnotations().removeTagProperty(path, prefix);
  }

  /**
   * @internal
   */
  static fromReference(
    name: string,
    path: string[] | undefined,
    rename: string | undefined
  ) {
    return new ASTGroupByViewOperation({
      kind: 'group_by',
      name: rename,
      field: {
        expression: {
          kind: 'field_reference',
          name,
          path,
        },
      },
    });
  }
}

export class ASTAggregateViewOperation
  extends ASTObjectNode<
    Malloy.ViewOperationWithAggregate,
    {
      kind: 'aggregate';
      name?: string;
      field: ASTField;
    }
  >
  implements IASTAnnotatable
{
  readonly kind: Malloy.ViewOperationType = 'aggregate';
  constructor(public node: Malloy.ViewOperationWithAggregate) {
    super(node, {
      kind: 'aggregate',
      name: node.name,
      field: new ASTField(node.field),
    });
  }

  get field() {
    return this.children.field;
  }

  get name() {
    const name = this.children.name ?? this.field.name;
    if (name === undefined) {
      throw new Error('Aggregate does not have a name');
    }
    return name;
  }

  set name(name: string) {
    if (this.name === name) return;
    this.edit();
    if (this.field.name === name) {
      this.children.name = undefined;
    } else {
      this.children.name = name;
    }
  }

  get annotations() {
    return this.field.annotations;
  }

  /**
   * Renames the aggregate item. If the field's name matches the given name,
   * removes the `name is` part.
   *
   * ```
   * run: flights -> { aggregate: flight_count }
   * ```
   * ```ts
   * aggregate.rename("flight_count_2");
   * ```
   * ```
   * run: flights -> { aggregate: flight_count2 is flight_count }
   * ```
   *
   * ```
   * run: flights -> { aggregate: renamed is flight_count }
   * ```
   * ```ts
   * aggregate.rename("flight_count");
   * ```
   * ```
   * run: flights -> { aggregate: flight_count }
   * ```
   *
   *
   * @param name The new name
   */
  rename(name: string) {
    this.list.segment.renameField(this, name);
  }

  /**
   * Removes this aggregate item from the query and replaces it with a smoothed
   * calculation of the same field.
   */
  convertToCalculateMovingAverage(
    name: string,
    rows_preceding: number,
    rows_following = 0,
    partition_fields: string[] = []
  ): ASTCalculateViewOperation {
    if (!(this.field.expression instanceof ASTReferenceExpression)) {
      throw new Error(
        'Cannot convert aggregate to smoothed metric unless it is a field reference'
      );
    }

    this.list.remove(this);

    const calculateItem = new ASTCalculateViewOperation({
      kind: 'calculate',
      name: name,
      field: {
        expression: {
          kind: 'moving_average',
          field_reference: {
            name: this.field.expression.name,
            path: this.field.expression.path,
          },
          rows_preceding,
          rows_following,
          partition_fields: partition_fields.map(fieldName => ({
            name: fieldName,
          })),
        },
      },
    });
    this.list.add(calculateItem);
    return calculateItem;
  }

  /**
   * @internal
   */
  get list() {
    return this.parent.as.ViewOperationList();
  }

  delete() {
    this.list.remove(this);
    this.list.segment.propagateUp(v => {
      if (v instanceof ASTSegmentViewDefinition) {
        v.removeOrderBys(this.name);
      }
    });
  }

  getFieldInfo(): Malloy.FieldInfo {
    return {
      annotations: [
        {
          value: Tag.withPrefix('#(malloy) ').set(['calculation']).toString(),
        },
      ],
      kind: 'dimension',
      name: this.name,
      type: this.field.type,
    };
  }

  getOrAddAnnotations() {
    return this.field.getOrAddAnnotations();
  }

  getInheritedTag(prefix: RegExp | string = '# ') {
    return tagFromAnnotations(prefix, this.field.getInheritedAnnotations());
  }

  getIntrinsicTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getIntrinsicTag(prefix) ?? new Tag();
  }

  getTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getTag(prefix) ?? this.getInheritedTag(prefix);
  }

  setTagProperty(path: Path, value: TagSetValue = null, prefix = '# ') {
    this.getOrAddAnnotations().setTagProperty(path, value, prefix);
  }

  removeTagProperty(path: Path, prefix = '# ') {
    if (!this.getTag().has(...path)) return;
    this.getOrAddAnnotations().removeTagProperty(path, prefix);
  }

  addWhere(
    name: string,
    path: string[],
    filterString: string
  ): ASTFilteredFieldExpression;
  addWhere(
    name: string,
    path: string[],
    filter: ParsedFilter
  ): ASTFilteredFieldExpression;
  addWhere(name: string, filterString: string): ASTFilteredFieldExpression;
  addWhere(name: string, filter: ParsedFilter): ASTFilteredFieldExpression;
  addWhere(
    name: string,
    arg2: string[] | string | ParsedFilter,
    arg3?: string | ParsedFilter
  ): ASTFilteredFieldExpression {
    const path = Array.isArray(arg2) ? arg2 : [];
    const filter = arg3 === undefined ? (arg2 as string | ParsedFilter) : arg3;
    const filterString =
      typeof filter === 'string' ? filter : serializeFilter(filter);
    const schema = this.list.segment.getInputSchema();
    const field = ASTQuery.schemaGet(schema, name, path);
    // Validate filter
    validateFilter(field, filter);
    const where: Malloy.FilterOperation = {
      filter: {
        kind: 'filter_string',
        expression: {
          kind: 'field_reference',
          name,
          path,
        },
        filter: filterString,
      },
    };
    if (this.field.expression instanceof ASTFilteredFieldExpression) {
      this.field.expression.where.add(new ASTFilterOperation(where));
      return this.field.expression;
    } else if (this.field.expression instanceof ASTReferenceExpression) {
      const existing = this.field.expression.build();
      this.field.expression = new ASTFilteredFieldExpression({
        kind: 'filtered_field',
        field_reference: {
          name: existing.name,
          path: existing.path,
          parameters: existing.parameters,
        },
        where: [where],
      });
      return this.field.expression;
    } else {
      throw new Error('This kind of expression does not support addWhere');
    }
  }

  /**
   * @internal
   */
  static fromReference(
    name: string,
    path: string[] | undefined,
    rename: string | undefined
  ) {
    return new ASTAggregateViewOperation({
      kind: 'aggregate',
      name: rename,
      field: {
        expression: {
          kind: 'field_reference',
          name,
          path,
        },
      },
    });
  }
}

export class ASTField
  extends ASTObjectNode<
    Malloy.Field,
    {
      expression: ASTExpression;
      annotations?: ASTAnnotationList;
    }
  >
  implements IASTAnnotatable
{
  constructor(public node: Malloy.Field) {
    super(node, {
      expression: ASTExpression.from(node.expression),
      annotations: node.annotations && new ASTAnnotationList(node.annotations),
    });
  }

  get expression() {
    return this.children.expression;
  }

  set expression(expression: ASTExpression) {
    this.edit();
    this.children.expression = expression;
    expression.parent = this;
  }

  get name() {
    return this.expression.name;
  }

  get type() {
    const type = this.expression.fieldType;
    if (type === undefined) {
      throw new Error('Field expression does not have a type');
    }
    return type;
  }

  get annotations() {
    return this.children.annotations;
  }

  set annotations(annotations: ASTAnnotationList | undefined) {
    this.edit();
    this.children.annotations = annotations;
  }

  // Returns a Malloy reference that this field points to
  getReference() {
    if (this.expression instanceof ASTLiteralValueExpression) {
      return undefined;
    }
    return this.expression.getReference();
  }

  getOrAddAnnotations() {
    if (this.annotations) return this.annotations;
    this.edit();
    const annotations = new ASTAnnotationList([]);
    this.children.annotations = annotations;
    annotations.parent = this;
    return annotations;
  }

  getInheritedTag(prefix: RegExp | string = '# ') {
    return tagFromAnnotations(prefix, this.getInheritedAnnotations());
  }

  getIntrinsicTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getIntrinsicTag(prefix) ?? new Tag();
  }

  getTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getTag(prefix) ?? this.getInheritedTag(prefix);
  }

  setTagProperty(path: Path, value: TagSetValue = null, prefix = '# ') {
    this.getOrAddAnnotations().setTagProperty(path, value, prefix);
  }

  removeTagProperty(path: Path, prefix = '# ') {
    if (!this.getTag().has(...path)) return;
    this.getOrAddAnnotations().removeTagProperty(path, prefix);
  }

  /**
   * @internal
   */
  get segment() {
    const groupByOrAggregate = this.parent as
      | ASTGroupByViewOperation
      | ASTAggregateViewOperation;
    const operationList = groupByOrAggregate.list;
    return operationList.segment;
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    return this.expression.getInheritedAnnotations();
  }
}

export type ASTExpression =
  | ASTReferenceExpression
  | ASTFilteredFieldExpression
  | ASTTimeTruncationExpression
  | ASTLiteralValueExpression
  | ASTMovingAverageExpression;
export const ASTExpression = {
  from(value: Malloy.Expression): ASTExpression {
    switch (value.kind) {
      case 'field_reference':
        return new ASTReferenceExpression(value);
      case 'filtered_field':
        return new ASTFilteredFieldExpression(value);
      case 'time_truncation':
        return new ASTTimeTruncationExpression(value);
      case 'literal_value':
        return new ASTLiteralValueExpression(value);
      case 'moving_average':
        return new ASTMovingAverageExpression(value);
    }
  },
};

// TODO would be nice for this to extend ASTFieldReference?
export class ASTReferenceExpression
  extends ASTObjectNode<
    Malloy.ExpressionWithFieldReference,
    {
      kind: 'field_reference';
      name: string;
      path?: string[];
      parameters?: ASTParameterValueList;
    }
  >
  implements IASTReference
{
  readonly kind: Malloy.ExpressionType = 'field_reference';

  constructor(public node: Malloy.ExpressionWithFieldReference) {
    super(node, {
      kind: node.kind,
      name: node.name,
      path: node.path,
      parameters: node.parameters && new ASTParameterValueList(node.parameters),
    });
  }

  get name() {
    return this.children.name;
  }

  get parameters() {
    return this.children.parameters;
  }

  set parameters(parameters: ASTParameterValueList | undefined) {
    this.edit();
    this.children.parameters = parameters;
  }

  /**
   * @internal
   */
  get segment() {
    const parent = this.parent;
    if (parent instanceof ASTField) {
      return parent.segment;
    } else if (
      parent instanceof ASTFilterWithFilterString ||
      parent instanceof ASTFilterWithLiteralEquality
    ) {
      return parent.segment;
    } else {
      throw new Error('Invalid expression parent');
    }
  }

  get path() {
    return this.children.path;
  }

  getReference() {
    return this.build();
  }

  getFieldInfo(): Malloy.FieldInfoWithDimension | Malloy.FieldInfoWithMeasure {
    const schema = this.segment.getInputSchema();
    const isDrill =
      this.parent instanceof ASTFilterWithLiteralEquality &&
      this.parent.parent instanceof ASTDrillViewOperation;
    const def = isDrill
      ? ASTNode.schemaGetDrillField(schema, this.name, this.path)
      : ASTNode.schemaGet(schema, this.name, this.path);
    if (def.kind !== 'dimension' && def.kind !== 'measure') {
      throw new Error('Invalid field for ASTReferenceExpression');
    }
    return def;
  }

  get fieldType() {
    return this.getFieldInfo().type;
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    const field = this.getFieldInfo();
    return field.annotations ?? [];
  }

  public getOrAddParameters(): ASTParameterValueList {
    return ASTReference.getOrAddParameters(this);
  }

  public setParameter(
    name: string,
    value: RawLiteralValue | Malloy.LiteralValue
  ) {
    return ASTReference.setParameter(this, name, value);
  }

  public tryGetParameter(name: string): ASTParameterValue | undefined {
    return ASTReference.tryGetParameter(this, name);
  }
}

export class ASTTimeTruncationExpression extends ASTObjectNode<
  Malloy.ExpressionWithTimeTruncation,
  {
    kind: 'time_truncation';
    field_reference: ASTFieldReference;
    truncation: Malloy.TimestampTimeframe;
  }
> {
  readonly kind: Malloy.ExpressionType = 'time_truncation';

  constructor(public node: Malloy.ExpressionWithTimeTruncation) {
    super(node, {
      kind: node.kind,
      field_reference: new ASTFieldReference(node.field_reference),
      truncation: node.truncation,
    });
  }

  getReference() {
    return this.fieldReference.build();
  }

  get fieldReference() {
    return this.children.field_reference;
  }

  get truncation() {
    return this.children.truncation;
  }

  set truncation(truncation: Malloy.TimestampTimeframe) {
    this.edit();
    this.children.truncation = truncation;
  }

  get name() {
    return this.fieldReference.name;
  }

  /**
   * @internal
   */
  get field() {
    return this.parent.as.Field();
  }

  getFieldInfo(): Malloy.FieldInfoWithDimension | Malloy.FieldInfoWithMeasure {
    const schema = this.field.segment.getInputSchema();
    const def = ASTNode.schemaGet(schema, this.name, this.fieldReference.path);
    if (def.kind !== 'dimension' && def.kind !== 'measure') {
      throw new Error('Invalid field for ASTReferenceExpression');
    }
    return def;
  }

  get fieldType() {
    const def = this.getFieldInfo();
    if (def.type.kind === 'date_type') {
      return {
        ...def.type,
        timeframe: timestampTimeframeToDateTimeframe(this.truncation),
      };
    } else if (
      def.type.kind === 'timestamp_type' ||
      def.type.kind === 'timestamptz_type'
    ) {
      return {...def.type, timeframe: this.truncation};
    }
    throw new Error('This type of field cannot have a time truncation');
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    const field = this.getFieldInfo();
    return field.annotations ?? [];
  }
}

export class ASTLiteralValueExpression extends ASTObjectNode<
  Malloy.ExpressionWithLiteralValue,
  {
    kind: 'literal_value';
    literal_value: ASTLiteralValue;
  }
> {
  readonly kind: Malloy.ExpressionType = 'time_truncation';

  constructor(public node: Malloy.ExpressionWithLiteralValue) {
    super(node, {
      kind: node.kind,
      literal_value: ASTLiteralValue.from(node.literal_value),
    });
  }

  get name() {
    return undefined;
  }

  get literalValue() {
    return this.children.literal_value;
  }

  get fieldType() {
    return this.literalValue.fieldType;
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    return [];
  }

  getFieldInfo() {
    return undefined;
  }
}

export class ASTFieldReferenceList extends ASTListNode<
  Malloy.Reference,
  ASTFieldReference
> {
  constructor(fields: Malloy.Reference[]) {
    super(
      fields,
      fields.map(p => new ASTFieldReference(p))
    );
  }
}

export class ASTMovingAverageExpression extends ASTObjectNode<
  Malloy.ExpressionWithMovingAverage,
  {
    kind: 'moving_average';
    field_reference: ASTFieldReference;
    rows_preceding?: number;
    rows_following?: number;
    partition_fields: ASTFieldReferenceList;
  }
> {
  readonly kind: Malloy.ExpressionType = 'moving_average';

  constructor(public node: Malloy.ExpressionWithMovingAverage) {
    super(node, {
      kind: node.kind,
      field_reference: new ASTFieldReference(node.field_reference),
      rows_preceding: node.rows_preceding,
      rows_following: node.rows_following,
      partition_fields: new ASTFieldReferenceList(node.partition_fields || []),
    });
  }
  getReference() {
    return this.fieldReference.build();
  }
  get fieldReference() {
    return this.children.field_reference;
  }
  get rowsPreceding() {
    return this.children.rows_preceding;
  }
  set rowsPreceding(rows: number | undefined) {
    this.edit();
    this.children.rows_preceding = rows;
  }
  get rowsFollowing() {
    return this.children.rows_following;
  }
  set rowsFollowing(rows: number | undefined) {
    this.edit();
    this.children.rows_following = rows;
  }
  get name() {
    return this.fieldReference.name;
  }
  get field() {
    return this.parent.as.Field();
  }
  get partitionFields() {
    return this.children.partition_fields;
  }
  setPartitionFields(references: Malloy.Reference[]) {
    this.children.partition_fields = new ASTFieldReferenceList(references);
  }
  getFieldInfo() {
    const schema = this.field.segment.getInputSchema();
    const def = ASTNode.schemaGet(schema, this.name, this.fieldReference.path);
    if (def.kind !== 'dimension' && def.kind !== 'measure') {
      throw new Error('Invalid field for ASTReferenceExpression');
    }
    return def;
  }
  get fieldType() {
    return this.getFieldInfo().type;
  }
  getInheritedAnnotations(): Malloy.Annotation[] {
    const field = this.getFieldInfo();
    return field.annotations ?? [];
  }
}

export class ASTFilterOperation extends ASTObjectNode<
  Malloy.FilterOperation,
  {filter: ASTFilter}
> {
  constructor(node: Malloy.FilterOperation) {
    super(node, {
      filter: ASTFilter.from(node.filter),
    });
  }

  get filter() {
    return this.children.filter;
  }

  get list() {
    return this.parent.as.FilterOperationList();
  }

  delete() {
    this.list.remove(this);
  }
}

export class ASTFilterOperationList extends ASTListNode<
  Malloy.FilterOperation,
  ASTFilterOperation
> {
  constructor(wheres: Malloy.FilterOperation[]) {
    super(
      wheres,
      wheres.map(p => new ASTFilterOperation(p))
    );
  }

  get expression() {
    return this.parent.as.FilteredFieldExpression();
  }
}

export class ASTFilteredFieldExpression extends ASTObjectNode<
  Malloy.ExpressionWithFilteredField,
  {
    kind: 'filtered_field';
    field_reference: ASTFieldReference;
    where: ASTFilterOperationList;
  }
> {
  readonly kind: Malloy.ExpressionType = 'filtered_field';

  constructor(public node: Malloy.ExpressionWithFilteredField) {
    super(node, {
      kind: node.kind,
      field_reference: new ASTFieldReference(node.field_reference),
      where: new ASTFilterOperationList(node.where),
    });
  }

  getReference() {
    return this.fieldReference.build();
  }

  get fieldReference() {
    return this.children.field_reference;
  }

  get name() {
    return this.fieldReference.name;
  }

  get where() {
    return this.children.where;
  }

  /**
   * @internal
   */
  get field() {
    return this.parent.as.Field();
  }

  getFieldInfo(): Malloy.FieldInfoWithMeasure {
    const schema = this.field.segment.getInputSchema();
    const def = ASTNode.schemaGet(schema, this.name, this.fieldReference.path);
    if (def.kind !== 'measure') {
      throw new Error('Invalid field for ASTFilteredFieldExpression');
    }
    return def;
  }

  get fieldType() {
    return this.getFieldInfo().type;
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    const field = this.getFieldInfo();
    return field.annotations ?? [];
  }
}

function timestampTimeframeToDateTimeframe(
  timeframe: Malloy.TimestampTimeframe
): Malloy.DateTimeframe {
  switch (timeframe) {
    case 'day':
    case 'week':
    case 'month':
    case 'year':
    case 'quarter':
      return timeframe;
    default:
      throw new Error('Invalid date timeframe');
  }
}

export class ASTNestViewOperation
  extends ASTObjectNode<
    Malloy.ViewOperationWithNest,
    {
      kind: 'nest';
      name?: string;
      view: ASTView;
    }
  >
  implements IASTAnnotatable
{
  readonly kind: Malloy.ViewOperationType = 'nest';
  constructor(public node: Malloy.ViewOperationWithNest) {
    super(node, {
      kind: 'nest',
      name: node.name,
      view: new ASTView(node.view),
    });
  }

  get view() {
    return this.children.view;
  }

  get annotations() {
    return this.view.annotations;
  }

  get name() {
    const name = this.children.name ?? this.view.name;
    if (name === undefined) {
      throw new Error('Nest does not have a name');
    }
    return name;
  }

  set name(name: string) {
    if (this.name === name) return;
    this.edit();
    if (this.view.name === name) {
      this.children.name = undefined;
    } else {
      this.children.name = name;
    }
  }

  /**
   * @internal
   */
  get list() {
    return this.parent.as.ViewOperationList();
  }

  getOrAddAnnotations() {
    return this.view.getOrAddAnnotations();
  }

  getInheritedTag(prefix: RegExp | string = '# ') {
    return tagFromAnnotations(prefix, this.view.getInheritedAnnotations());
  }

  getIntrinsicTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getIntrinsicTag(prefix) ?? new Tag();
  }

  getTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getTag(prefix) ?? this.getInheritedTag(prefix);
  }

  setTagProperty(path: Path, value: TagSetValue = null, prefix = '# ') {
    this.getOrAddAnnotations().setTagProperty(path, value, prefix);
  }

  removeTagProperty(path: Path, prefix = '# ') {
    if (!this.getTag().has(...path)) return;
    this.getOrAddAnnotations().removeTagProperty(path, prefix);
  }

  delete() {
    this.list.remove(this);
  }

  /**
   * Renames the nest item. If the view's name matches the given name,
   * removes the `name is` part.
   *
   * ```
   * run: flights -> { nest: by_carrier }
   * ```
   * ```ts
   * nest.rename("by_carrier_2");
   * ```
   * ```
   * run: flights -> { nest: by_carrier_2 is by_carrier }
   * ```
   *
   * ```
   * run: flights -> { nest: by_carrier_2 is by_carrier }
   * ```
   * ```ts
   * nest.rename("by_carrier");
   * ```
   * ```
   * run: flights -> { nest: by_carrier }
   * ```
   *
   * ```
   * run: flights -> {
   *   nest: by_carrier is {
   *     group_by: carrier
   *   }
   * }
   * ```
   * ```ts
   * nest.rename("by_carrier_2");
   * ```
   * ```
   * run: flights -> {
   *   nest: by_carrier_2 is {
   *     group_by: carrier
   *   }
   * }
   * ```
   *
   * @param name The new name
   */
  rename(name: string) {
    this.list.segment.renameField(this, name);
  }

  getFieldInfo(): Malloy.FieldInfo {
    return {
      kind: 'view',
      name: this.name,
      definition: this.view.build(),
      schema: this.view.getOutputSchema(),
    };
  }

  /**
   * @internal
   */
  static fromReference(
    name: string,
    path: string[] | undefined,
    rename: string | undefined
  ) {
    return new ASTNestViewOperation({
      kind: 'nest',
      name: rename,
      view: {
        definition: {
          kind: 'view_reference',
          name,
          path,
        },
      },
    });
  }
}

export class ASTWhereViewOperation extends ASTObjectNode<
  Malloy.ViewOperationWithWhere,
  {
    kind: 'where';
    filter: ASTFilter;
  }
> {
  readonly kind: Malloy.ViewOperationType = 'where';
  constructor(public node: Malloy.ViewOperationWithWhere) {
    super(node, {
      kind: 'where',
      filter: ASTFilter.from(node.filter),
    });
  }

  get filter() {
    return this.children.filter;
  }

  /**
   * @internal
   */
  get list() {
    return this.parent.as.ViewOperationList();
  }

  delete() {
    this.list.remove(this);
  }
}

export class ASTDrillViewOperation extends ASTObjectNode<
  Malloy.ViewOperationWithDrill,
  {
    kind: 'drill';
    filter: ASTFilter;
  }
> {
  readonly kind: Malloy.ViewOperationType = 'drill';
  constructor(public node: Malloy.ViewOperationWithDrill) {
    super(node, {
      kind: 'drill',
      filter: ASTFilter.from(node.filter),
    });
  }

  get filter() {
    return this.children.filter;
  }

  /**
   * @internal
   */
  get list() {
    return this.parent.as.ViewOperationList();
  }

  delete() {
    this.list.remove(this);
  }
}

export class ASTHavingViewOperation extends ASTObjectNode<
  Malloy.ViewOperationWithHaving,
  {
    kind: 'having';
    filter: ASTFilter;
  }
> {
  readonly kind: Malloy.ViewOperationType = 'having';
  constructor(public node: Malloy.ViewOperationWithHaving) {
    super(node, {
      kind: 'having',
      filter: ASTFilter.from(node.filter),
    });
  }

  get filter() {
    return this.children.filter;
  }

  /**
   * @internal
   */
  get list() {
    return this.parent.as.ViewOperationList();
  }

  delete() {
    this.list.remove(this);
  }
}

export class ASTCalculateViewOperation extends ASTObjectNode<
  Malloy.ViewOperationWithCalculate,
  {
    kind: 'calculate';
    field: ASTField;
    name: string;
  }
> {
  readonly kind: Malloy.ViewOperationType = 'calculate';
  constructor(public node: Malloy.ViewOperationWithCalculate) {
    super(node, {
      kind: 'calculate',
      field: new ASTField(node.field),
      name: node.name,
    });
  }

  get expression() {
    return this.children.field.expression as ASTMovingAverageExpression;
  }
  set expression(expression: ASTMovingAverageExpression) {
    this.edit();
    this.children.field.expression = expression;
    expression.parent = this;
  }
  get name() {
    return this.node.name;
  }
  set name(name: string) {
    if (this.name === name) return;
    this.edit();
    this.node.name = name;
  }

  getFieldInfo(): Malloy.FieldInfo {
    return {
      annotations: [
        {
          value: Tag.withPrefix('#(malloy) ').set(['calculation']).toString(),
        },
      ],
      kind: 'calculate',
      name: this.name,
      type: this.expression.fieldType,
    };
  }

  /**
   * @internal
   */
  get list() {
    return this.parent.as.ViewOperationList();
  }
  delete() {
    this.list.remove(this);
  }
}

export type ASTFilter =
  | ASTFilterWithFilterString
  | ASTFilterWithLiteralEquality;
export const ASTFilter = {
  from(filter: Malloy.Filter) {
    switch (filter.kind) {
      case 'filter_string':
        return new ASTFilterWithFilterString(filter);
      case 'literal_equality':
        return new ASTFilterWithLiteralEquality(filter);
    }
  },
  getSegment(filter: ASTFilter) {
    const grand = filter.parent as
      | ASTFilterOperation
      | ASTWhereViewOperation
      | ASTDrillViewOperation
      | ASTHavingViewOperation;
    if (grand instanceof ASTFilterOperation) {
      return grand.list.expression.field.segment;
    } else {
      return grand.list.segment;
    }
  },
};

export class ASTFilterWithFilterString extends ASTObjectNode<
  Malloy.FilterWithFilterString,
  {
    kind: 'filter_string';
    expression: ASTExpression;
    filter: string;
  }
> {
  readonly kind: Malloy.FilterType = 'filter_string';
  constructor(public node: Malloy.FilterWithFilterString) {
    super(node, {
      kind: 'filter_string',
      expression: ASTExpression.from(node.expression),
      filter: node.filter,
    });
  }

  get expression() {
    return this.children.expression;
  }

  get filterString() {
    return this.children.filter;
  }

  set filterString(filter: string) {
    this.edit();
    this.children.filter = filter;
  }

  setFilterString(filterString: string) {
    const kind = this.getFilterType();
    parseFilter(this.filterString, kind);
    this.filterString = filterString;
  }

  get segment() {
    return ASTFilter.getSegment(this);
  }

  getFieldInfo() {
    const field = this.expression.getFieldInfo();
    if (
      field === undefined ||
      (field.kind !== 'dimension' && field.kind !== 'measure')
    ) {
      throw new Error('Invalid field type for filter with filter string');
    }
    return field;
  }

  getFilterType(): Filter.FilterableType | 'other' {
    const fieldInfo = this.getFieldInfo();
    return getFilterType(fieldInfo);
  }

  setFilter(filter: ParsedFilter) {
    const kind = this.getFilterType();
    if (kind !== filter.kind) {
      throw new Error(
        `Invalid filter: expected type ${kind}, got ${filter.kind}`
      );
    }
    this.filterString = serializeFilter(filter);
  }

  getFilter(): ParsedFilter {
    const kind = this.getFilterType();
    return parseFilter(this.filterString, kind);
  }
}

export class ASTFilterWithLiteralEquality extends ASTObjectNode<
  Malloy.FilterWithLiteralEquality,
  {
    kind: 'literal_equality';
    expression: ASTExpression;
    value: ASTLiteralValue;
  }
> {
  readonly kind: Malloy.FilterType = 'literal_equality';
  constructor(public node: Malloy.FilterWithLiteralEquality) {
    super(node, {
      kind: 'literal_equality',
      expression: ASTExpression.from(node.expression),
      value: ASTLiteralValue.from(node.value),
    });
  }

  get expression() {
    return this.children.expression;
  }

  get value() {
    return this.children.value;
  }

  get segment() {
    return ASTFilter.getSegment(this);
  }
}

export class ASTView
  extends ASTObjectNode<
    Malloy.View,
    {
      definition: ASTViewDefinition;
      annotations?: ASTAnnotationList;
    }
  >
  implements IASTAnnotatable
{
  constructor(public node: Malloy.View) {
    super(node, {
      definition: ASTViewDefinition.from(node.definition),
      annotations: node.annotations && new ASTAnnotationList(node.annotations),
    });
  }

  get definition() {
    return this.children.definition;
  }

  set definition(definition: ASTViewDefinition) {
    this.edit();
    this.children.definition = definition;
    definition.parent = this;
  }

  get name() {
    return this.definition.getImplicitName();
  }

  public getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    return this.definition.getOrAddDefaultSegment();
  }

  /**
   * @internal
   */
  get nest() {
    return this.parent.as.NestViewOperation();
  }

  getInputSchema(): Malloy.Schema {
    return this.nest.list.segment.getInputSchema();
  }

  getOutputSchema(): Malloy.Schema {
    return this.definition.getRefinementSchema();
  }

  /**
   * @internal
   */
  propagateUp(f: PropagationFunction): void {
    this.propagateDown(f);
  }

  /**
   * @internal
   */
  propagateDown(f: PropagationFunction): void {
    f(this.definition);
    this.definition.propagateDown(f);
  }

  reorderFields(names: string[]): void {
    if (this.definition instanceof ASTSegmentViewDefinition) {
      this.definition.reorderFields(names);
    } else {
      this.getOrAddAnnotations().setTagProperty(['field_order'], names);
    }
  }

  get annotations() {
    return this.children.annotations;
  }

  getOrAddAnnotations() {
    if (this.annotations) return this.annotations;
    this.edit();
    const annotations = new ASTAnnotationList([]);
    this.children.annotations = annotations;
    annotations.parent = this;
    return annotations;
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    return this.definition.getInheritedAnnotations();
  }

  getInheritedTag(prefix: RegExp | string = '# ') {
    return tagFromAnnotations(prefix, this.getInheritedAnnotations());
  }

  getIntrinsicTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getIntrinsicTag(prefix) ?? new Tag();
  }

  getTag(prefix: RegExp | string = '# ') {
    return this.annotations?.getTag(prefix) ?? this.getInheritedTag(prefix);
  }

  setTagProperty(path: Path, value: TagSetValue = null, prefix = '# ') {
    this.getOrAddAnnotations().setTagProperty(path, value, prefix);
  }

  removeTagProperty(path: Path, prefix = '# ') {
    if (!this.getTag().has(...path)) return;
    this.getOrAddAnnotations().removeTagProperty(path, prefix);
  }
}

export class ASTLimitViewOperation extends ASTObjectNode<
  Malloy.ViewOperationWithLimit,
  {
    kind: 'limit';
    limit: number;
  }
> {
  readonly kind: Malloy.ViewOperationType = 'limit';

  get limit() {
    return this.children.limit;
  }

  set limit(limit: number) {
    ASTLimitViewOperation.validateLimit(limit);
    this.edit();
    this.children.limit = limit;
  }

  constructor(public node: Malloy.ViewOperationWithLimit) {
    super(node, {
      kind: node.kind,
      limit: node.limit,
    });
  }

  /**
   * @internal
   */
  get list() {
    return this.parent.as.ViewOperationList();
  }

  delete() {
    this.list.remove(this);
  }

  /**
   * @internal
   */
  static validateLimit(limit: number) {
    if (!Number.isInteger(limit)) {
      throw new Error('Limit must be an integer');
    }
  }
}

function fieldTypeToAction(type: Malloy.FieldInfoType): string {
  switch (type) {
    case 'dimension':
      return 'group by';
    case 'measure':
      return 'aggregate';
    case 'view':
      return 'nest';
    case 'join':
      return 'join';
    case 'calculate':
      return 'calculate';
  }
}

function fieldTypeName(type: Malloy.FieldInfoType): string {
  return type;
}

type ASTAnnotationListParent = ASTQuery | ASTField | ASTView;

export class ASTAnnotationList extends ASTListNode<
  Malloy.Annotation,
  ASTAnnotation
> {
  constructor(annotations: Malloy.Annotation[]) {
    super(
      annotations,
      annotations.map(p => new ASTAnnotation(p))
    );
  }

  get items() {
    return this.children;
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    const parent = this.parent as ASTAnnotationListParent;
    return parent.getInheritedAnnotations();
  }

  getIntrinsicTag(prefix: RegExp | string = '# '): Tag {
    return tagFromAnnotations(prefix, this.items);
  }

  getTag(prefix: RegExp | string = '# '): Tag {
    const extending = inheritedTag(this.getInheritedAnnotations());
    return tagFromAnnotations(prefix, this.items, extending);
  }

  get annotations() {
    return this.children.map(astAnnotation => astAnnotation.node);
  }

  setTagProperty(path: Path, value: TagSetValue = null, prefix = '# ') {
    let firstMatch: ASTAnnotation | undefined = undefined;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const annotation = this.index(i);
      if (!annotation.hasPrefix(prefix)) continue;
      firstMatch = annotation;
      if (annotation.hasIntrinsicTagProperty(path)) {
        annotation.setTagProperty(path, value);
        return;
      }
    }
    if (firstMatch) {
      firstMatch.setTagProperty(path, value);
    } else {
      this.add(
        new ASTAnnotation({
          value: new Tag({prefix}).set(path, value).toString(),
        })
      );
    }
  }

  removeTagProperty(path: Path, prefix = '# ') {
    let firstMatch: ASTAnnotation | undefined = undefined;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const annotation = this.index(i);
      if (!annotation.hasPrefix(prefix)) continue;
      firstMatch = annotation;
      if (annotation.hasIntrinsicTagProperty(path)) {
        annotation.removeTagProperty(path);
        return;
      }
    }
    if (firstMatch) {
      firstMatch.removeTagProperty(path);
    } else {
      this.add(
        new ASTAnnotation({value: new Tag({prefix}).unset(...path).toString()})
      );
    }
  }
}

export class ASTAnnotation extends ASTObjectNode<
  Malloy.Annotation,
  {
    value: string;
  }
> {
  get value() {
    return this.children.value;
  }

  set value(value: string) {
    this.edit();
    this.children.value = value;
  }

  constructor(public node: Malloy.Annotation) {
    super(node, {
      value: node.value,
    });
  }

  /**
   * @internal
   */
  get list() {
    return this.parent.as.AnnotationList();
  }

  get index() {
    return this.list.indexOf(this);
  }

  delete() {
    this.list.remove(this);
  }

  getIntrinsicTag(): Tag {
    const session = new TagParser();
    session.parse(this.value);
    return session.finish();
  }

  getTag(): Tag {
    const inherited =
      this.index === 0
        ? inheritedTag(this.list.getInheritedAnnotations())
        : this.list.index(this.index - 1).getTag();
    const session = new TagParser(inherited);
    session.parse(this.value);
    return session.finish();
  }

  hasPrefix(prefix: string) {
    return this.value.startsWith(prefix);
  }

  hasIntrinsicTagProperty(path: Path) {
    return this.getIntrinsicTag().has(...path);
  }

  setTagProperty(path: Path, value: TagSetValue) {
    this.value = this.getIntrinsicTag().set(path, value).toString();
  }

  removeTagProperty(path: Path) {
    this.value = this.getTag()
      .unset(...path)
      .toString();
  }
}

function inheritedTag(annotations: Malloy.Annotation[]): Tag {
  const session = new TagParser();
  for (const a of annotations) {
    session.parse(a.value);
  }
  return session.finish();
}

function tagFromAnnotations(
  prefix: string | RegExp,
  annotations: Malloy.Annotation[] = [],
  inherited?: Tag
) {
  const lines = annotations.map(a => a.value);
  const filteredLines = lines.filter(l =>
    typeof prefix === 'string' ? l.startsWith(prefix) : l.match(prefix)
  );
  const session = new TagParser(inherited);
  for (const l of filteredLines) {
    session.parse(l);
  }
  return session.finish();
}

function serializeFilter(filter: ParsedFilter) {
  switch (filter.kind) {
    case 'string':
      return Filter.StringFilterExpression.unparse(filter.parsed);
    case 'number':
      return Filter.NumberFilterExpression.unparse(filter.parsed);
    case 'boolean':
      return Filter.BooleanFilterExpression.unparse(filter.parsed);
    case 'timestamp':
    case 'timestamptz':
    case 'date':
      return Filter.TemporalFilterExpression.unparse(filter.parsed);
  }
}

function parseFilter(
  filterString: string,
  kind: Filter.FilterableType | 'other'
) {
  function handleError(logs: Filter.FilterLog[]) {
    const errors = logs.filter(l => l.severity === 'error');
    if (errors.length === 0) return;
    throw new Error(`Invalid Malloy filter string: ${errors[0].message}`);
  }
  switch (kind) {
    case 'string': {
      const result = Filter.StringFilterExpression.parse(filterString);
      handleError(result.log);
      return {kind, parsed: result.parsed};
    }
    case 'number': {
      const result = Filter.NumberFilterExpression.parse(filterString);
      handleError(result.log);
      return {kind, parsed: result.parsed};
    }
    case 'boolean': {
      const result = Filter.BooleanFilterExpression.parse(filterString);
      handleError(result.log);
      return {kind, parsed: result.parsed};
    }
    case 'timestamp':
    case 'timestamptz':
    case 'date': {
      const result = Filter.TemporalFilterExpression.parse(filterString);
      handleError(result.log);
      return {kind, parsed: result.parsed};
    }
    case 'other':
      throw new Error('Not implemented');
  }
}

function sourceOrQueryToModelEntry(
  entry:
    | Malloy.ModelEntryValueWithSource
    | Malloy.ModelEntryValueWithQuery
    | Malloy.SourceInfo
    | Malloy.QueryInfo
): Malloy.ModelEntryValueWithSource | Malloy.ModelEntryValueWithQuery {
  if ('kind' in entry) {
    return entry;
  } else {
    return {...entry, kind: 'source'};
  }
}

function isDateTimeframe(
  timeframe: Malloy.TimestampTimeframe
): timeframe is Malloy.DateTimeframe {
  switch (timeframe) {
    case 'year':
    case 'quarter':
    case 'month':
    case 'week':
    case 'day':
      return true;
    default:
      return false;
  }
}

function digits(value: number, digits: number) {
  return value.toString().padStart(digits, '0');
}

function serializeDateAsLiteral(date: Date): string {
  const year = digits(date.getUTCFullYear(), 4);
  const month = digits(date.getUTCMonth() + 1, 2);
  const day = digits(date.getUTCDate(), 2);
  const hour = digits(date.getUTCHours(), 2);
  const minute = digits(date.getUTCMinutes(), 2);
  const second = digits(date.getUTCSeconds(), 2);
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function pathsMatch(a: string[] | undefined, b: string[] | undefined): boolean {
  const aOrEmpty = a ?? [];
  const bOrEmpty = b ?? [];
  return (
    aOrEmpty.length === bOrEmpty.length &&
    aOrEmpty.every((s, i) => s === bOrEmpty[i])
  );
}

function getFilterType(
  fieldInfo: Malloy.FieldInfoWithDimension | Malloy.FieldInfoWithMeasure
): Filter.FilterableType | 'other' {
  switch (fieldInfo.type.kind) {
    case 'string_type':
      return 'string';
    case 'boolean_type':
      return 'boolean';
    case 'number_type':
      return 'number';
    case 'date_type':
      return 'date';
    case 'timestamp_type':
      return 'timestamp';
    case 'timestamptz_type':
      return 'timestamp';
    default:
      return 'other';
  }
}

function validateFilter(
  field: Malloy.FieldInfo,
  filter: string | ParsedFilter
) {
  if (field.kind !== 'dimension' && field.kind !== 'measure') {
    throw new Error(`Cannot filter by field of type ${field.kind}`);
  }
  const type = getFilterType(field);
  if (typeof filter === 'string') {
    parseFilter(filter, type);
  } else {
    if (filter.kind !== type) {
      throw new Error(
        `Invalid filter for field ${field.name}; expected type ${type}, but got ${filter.kind}`
      );
    }
  }
}

function getInputSchemaFromViewParent(parent: ViewParent) {
  if (parent instanceof ASTArrowQueryDefinition) {
    return parent.getSourceInfo().schema;
  } else if (parent instanceof ASTRefinementQueryDefinition) {
    throw new Error('unimplemented');
  } else {
    return parent.getInputSchema();
  }
}
