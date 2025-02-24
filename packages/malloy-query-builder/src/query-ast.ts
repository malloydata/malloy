/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import * as Malloy from '@malloydata/malloy-interfaces';
import {Tag, TagSetValue} from '@malloydata/malloy-tag';
import * as Filter from '@malloydata/malloy-filter';

export type ParsedFilter =
  | {kind: 'string'; clauses: Filter.StringClause[]}
  | {kind: 'number'; clauses: Filter.NumberClause[]}
  | {kind: 'boolean'; clauses: Filter.BooleanClause[]}
  | {kind: 'time'; clauses: Filter.DateClause[]};

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
  abstract find(path: Path): ASTAny;

  /**
   * Returns this node as an `ASTQuery`. Throws if it is not an `ASTQuery`.
   *
   * There are variants of this method for _all_ ASTXYZ nodes `asXYZ`, but they
   * are not shown here so the docs aren't crazy big.
   *
   * @returns Returns this node as an `ASTQuery`.
   */
  asQuery(): ASTQuery {
    if (this instanceof ASTQuery) return this;
    throw new Error('Not an ASTQuery');
  }

  /**
   * Finds the AST node at the given `path`. Throws if it is not an `ASTQuery`.
   *
   * There are variants of this method for _all_ ASTXYZ nodes `findXYZ`, but they
   * are not shown here so the docs aren't crazy big.
   *
   * @param path Path to the desired ASTNode, e.g. `['source', 'parameters', 0]`
   * @returns Returns this node as an `ASTQuery`.
   */
  findQuery(path: Path): ASTQuery {
    return this.find(path).asQuery();
  }

  /**
   * @hidden
   */
  asReference(): ASTReference {
    if (this instanceof ASTReference) return this;
    throw new Error('Not an ASTReference');
  }

  /**
   * @hidden
   */
  findReference(path: Path): ASTReference {
    return this.find(path).asReference();
  }

  /**
   * @hidden
   */
  asSourceReference(): ASTSourceReference {
    if (this instanceof ASTSourceReference) return this;
    throw new Error('Not an ASTSourceReference');
  }

  /**
   * @hidden
   */
  findSourceReference(path: Path): ASTSourceReference {
    return this.find(path).asSourceReference();
  }

  /**
   * @hidden
   */
  asParameterValueList(): ASTParameterValueList {
    if (this instanceof ASTParameterValueList) return this;
    throw new Error('Not an ASTParameterValueList');
  }

  /**
   * @hidden
   */
  findParameterValueList(path: Path): ASTParameterValueList {
    return this.find(path).asParameterValueList();
  }

  /**
   * @hidden
   */
  asWhere(): ASTWhere {
    if (this instanceof ASTWhere) return this;
    throw new Error('Not an ASTWhere');
  }

  /**
   * @hidden
   */
  findWhere(path: Path): ASTWhere {
    return this.find(path).asWhere();
  }

  /**
   * @hidden
   */
  asWhereList(): ASTWhereList {
    if (this instanceof ASTWhereList) return this;
    throw new Error('Not an ASTWhereList');
  }

  /**
   * @hidden
   */
  findWhereList(path: Path): ASTWhereList {
    return this.find(path).asWhereList();
  }

  /**
   * @hidden
   */
  asParameterValue(): ASTParameterValue {
    if (this instanceof ASTParameterValue) return this;
    throw new Error('Not an ASTParameterValue');
  }

  /**
   * @hidden
   */
  findParameterValue(path: Path): ASTParameterValue {
    return this.find(path).asParameterValue();
  }

  /**
   * @hidden
   */
  asStringLiteralValue(): ASTStringLiteralValue {
    if (this instanceof ASTStringLiteralValue) return this;
    throw new Error('Not an ASTStringLiteralValue');
  }

  /**
   * @hidden
   */
  findStringLiteralValue(path: Path): ASTStringLiteralValue {
    return this.find(path).asStringLiteralValue();
  }

  /**
   * @hidden
   */
  asNumberLiteralValue(): ASTNumberLiteralValue {
    if (this instanceof ASTNumberLiteralValue) return this;
    throw new Error('Not an ASTNumberLiteralValue');
  }

  /**
   * @hidden
   */
  findNumberLiteralValue(path: Path): ASTNumberLiteralValue {
    return this.find(path).asNumberLiteralValue();
  }

  /**
   * @hidden
   */
  asViewOperationList(): ASTViewOperationList {
    if (this instanceof ASTViewOperationList) return this;
    throw new Error('Not an ASTViewOperationList');
  }

  /**
   * @hidden
   */
  findViewOperationList(path: Path): ASTViewOperationList {
    return this.find(path).asViewOperationList();
  }

  /**
   * @hidden
   */
  asGroupByViewOperation(): ASTGroupByViewOperation {
    if (this instanceof ASTGroupByViewOperation) return this;
    throw new Error('Not an ASTGroupByViewOperation');
  }

  /**
   * @hidden
   */
  findGroupByViewOperation(path: Path): ASTGroupByViewOperation {
    return this.find(path).asGroupByViewOperation();
  }

  /**
   * @hidden
   */
  asAggregateViewOperation(): ASTAggregateViewOperation {
    if (this instanceof ASTAggregateViewOperation) return this;
    throw new Error('Not an ASTAggregateViewOperation');
  }

  /**
   * @hidden
   */
  findAggregateViewOperation(path: Path): ASTAggregateViewOperation {
    return this.find(path).asAggregateViewOperation();
  }

  /**
   * @hidden
   */
  asOrderByViewOperation(): ASTOrderByViewOperation {
    if (this instanceof ASTOrderByViewOperation) return this;
    throw new Error('Not an ASTOrderByViewOperation');
  }

  /**
   * @hidden
   */
  findOrderByViewOperation(path: Path): ASTOrderByViewOperation {
    return this.find(path).asOrderByViewOperation();
  }

  /**
   * @hidden
   */
  asField(): ASTField {
    if (this instanceof ASTField) return this;
    throw new Error('Not an ASTField');
  }

  /**
   * @hidden
   */
  findField(path: Path): ASTField {
    return this.find(path).asField();
  }

  /**
   * @hidden
   */
  asReferenceExpression(): ASTReferenceExpression {
    if (this instanceof ASTReferenceExpression) return this;
    throw new Error('Not an ASTReferenceExpression');
  }

  /**
   * @hidden
   */
  findReferenceExpression(path: Path): ASTReferenceExpression {
    return this.find(path).asReferenceExpression();
  }

  /**
   * @hidden
   */
  asReferenceViewDefinition(): ASTReferenceViewDefinition {
    if (this instanceof ASTReferenceViewDefinition) return this;
    throw new Error('Not an ASTReferenceViewDefinition');
  }

  /**
   * @hidden
   */
  findReferenceViewDefinition(path: Path): ASTReferenceViewDefinition {
    return this.find(path).asReferenceViewDefinition();
  }

  /**
   * @hidden
   */
  asArrowQueryDefinition(): ASTArrowQueryDefinition {
    if (this instanceof ASTArrowQueryDefinition) return this;
    throw new Error('Not an ASTArrowQueryDefinition');
  }

  /**
   * @hidden
   */
  findArrowQueryDefinition(path: Path): ASTArrowQueryDefinition {
    return this.find(path).asArrowQueryDefinition();
  }

  /**
   * @hidden
   */
  asArrowViewDefinition(): ASTArrowViewDefinition {
    if (this instanceof ASTArrowViewDefinition) return this;
    throw new Error('Not an ASTArrowViewDefinition');
  }

  /**
   * @hidden
   */
  findArrowViewDefinition(path: Path): ASTArrowViewDefinition {
    return this.find(path).asArrowViewDefinition();
  }

  /**
   * @hidden
   */
  asRefinementViewDefinition(): ASTRefinementViewDefinition {
    if (this instanceof ASTRefinementViewDefinition) return this;
    throw new Error('Not an ASTRefinementViewDefinition');
  }

  /**
   * @hidden
   */
  findRefinementViewDefinition(path: Path): ASTRefinementViewDefinition {
    return this.find(path).asRefinementViewDefinition();
  }

  /**
   * @hidden
   */
  asTimeTruncationExpression(): ASTTimeTruncationExpression {
    if (this instanceof ASTTimeTruncationExpression) return this;
    throw new Error('Not an ASTTimeTruncationExpression');
  }

  /**
   * @hidden
   */
  findTimeTruncationExpression(path: Path): ASTTimeTruncationExpression {
    return this.find(path).asTimeTruncationExpression();
  }

  /**
   * @hidden
   */
  asFilteredFieldExpression(): ASTFilteredFieldExpression {
    if (this instanceof ASTFilteredFieldExpression) return this;
    throw new Error('Not an ASTFilteredFieldExpression');
  }

  /**
   * @hidden
   */
  findFilteredFieldExpression(path: Path): ASTFilteredFieldExpression {
    return this.find(path).asFilteredFieldExpression();
  }

  /**
   * @hidden
   */
  asNestViewOperation(): ASTNestViewOperation {
    if (this instanceof ASTNestViewOperation) return this;
    throw new Error('Not an ASTNestViewOperation');
  }

  /**
   * @hidden
   */
  findNestViewOperation(path: Path): ASTNestViewOperation {
    return this.find(path).asNestViewOperation();
  }

  /**
   * @hidden
   */
  asView(): ASTView {
    if (this instanceof ASTView) return this;
    throw new Error('Not an ASTView');
  }

  /**
   * @hidden
   */
  findView(path: Path): ASTView {
    return this.find(path).asView();
  }

  /**
   * @hidden
   */
  asSegmentViewDefinition(): ASTSegmentViewDefinition {
    if (this instanceof ASTSegmentViewDefinition) return this;
    throw new Error('Not an ASTSegmentViewDefinition');
  }

  /**
   * @hidden
   */
  findSegmentViewDefinition(path: Path): ASTSegmentViewDefinition {
    return this.find(path).asSegmentViewDefinition();
  }

  /**
   * @hidden
   */
  asLimitViewOperation(): ASTLimitViewOperation {
    if (this instanceof ASTLimitViewOperation) return this;
    throw new Error('Not an ASTLimitViewOperation');
  }

  /**
   * @hidden
   */
  findLimitViewOperation(path: Path): ASTLimitViewOperation {
    return this.find(path).asLimitViewOperation();
  }

  /**
   * @hidden
   */
  asAnnotationList(): ASTAnnotationList {
    if (this instanceof ASTAnnotationList) return this;
    throw new Error('Not an ASTAnnotationList');
  }

  /**
   * @hidden
   */
  findAnnotationList(path: Path): ASTAnnotationList {
    return this.find(path).asAnnotationList();
  }

  /**
   * @hidden
   */
  asAnnotation(): ASTAnnotation {
    if (this instanceof ASTAnnotation) return this;
    throw new Error('Not an ASTAnnotation');
  }

  /**
   * @hidden
   */
  findAnnotation(path: Path): ASTAnnotation {
    return this.find(path).asAnnotation();
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
  static schemaTryGet(schema: Malloy.Schema, name: string) {
    const parts = name.split('.');
    let current = schema;
    const front = parts.slice(0, -1);
    const last = parts[parts.length - 1];
    for (const part of front) {
      const field = current.fields.find(f => f.name === part);
      if (field === undefined) {
        throw new Error(`${part} not found`);
      }
      if (field.kind !== 'join') {
        throw new Error(`${part} is not a join`);
      }
      current = field.schema;
    }
    const field = current.fields.find(f => f.name === last);
    return field;
  }

  /**
   * @internal
   */
  static schemaGet(schema: Malloy.Schema, name: string) {
    const field = ASTNode.schemaTryGet(schema, name);
    if (field === undefined) {
      throw new Error(`${name} not found`);
    }
    return field;
  }

  /**
   * @internal
   */
  static schemaMerge(a: Malloy.Schema, b: Malloy.Schema): Malloy.Schema {
    // TODO does this need to be smarter
    return {
      fields: [...a.fields, ...b.fields],
    };
  }
}

function isBasic(
  t: ASTAny | string | number | string[]
): t is string | number | string[] {
  return Array.isArray(t) || typeof t === 'string' || typeof t === 'number';
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
  find(path: Path): ASTAny {
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
    return child.find(rest);
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
  find(path: Path): ASTAny {
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
    return child.find(rest);
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
    const query = options?.query ?? {
      definition: {
        kind: 'arrow',
        source_reference: {
          name: options.source?.name ?? 'default', // TODO
        },
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    const source = options?.source;
    const model: Malloy.ModelInfo | undefined =
      options?.model ??
      (source && {
        entries: [
          {
            ...source,
            kind: 'kind' in source ? source.kind : 'source',
          },
        ],
        anonymous_queries: [],
      });
    if (model === undefined) {
      throw new Error('Must provide a model or source');
    }
    super(query, {
      definition: ASTQueryDefinition.from(query.definition),
      annotations:
        query.annotations && new ASTAnnotationList(query.annotations),
    });
    this.model = model;
    if (source) {
      this.setSource(source.name);
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
      source_reference: this.definition.sourceReference.build(),
      view: {
        kind: 'segment',
        operations: [],
      },
    });
    return this.definition.view.asSegmentViewDefinition();
  }

  isRunnable() {
    return this.definition.isRunnable();
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
      if (this.definition.sourceReference.name === name) {
        return;
      }
    }
    // TODO validate
    this.definition = new ASTArrowQueryDefinition({
      kind: 'arrow',
      source_reference: {name},
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
    // TODO validate
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
      source_reference: this.definition.sourceReference.build(),
      view: {
        kind: 'view_reference',
        name,
      },
    });
    return this.definition.view.asReferenceViewDefinition();
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    if (this.definition instanceof ASTReferenceQueryDefinition) {
      const query = this.getQueryInfo(this.definition.name);
      return query.annotations ?? [];
    } else if (this.definition instanceof ASTRefinementQueryDefinition) {
      const query = this.getQueryInfo(this.definition.queryReference.name);
      return query.annotations ?? [];
    } else if (this.definition instanceof ASTArrowQueryDefinition) {
      return this.definition.view.getInheritedAnnotations();
    }
    return [];
  }
}

export type RawLiteralValue = number | string | Date | boolean | null;

export class ASTReference extends ASTObjectNode<
  Malloy.Reference,
  {
    name: string;
    path?: string[];
    parameters?: ASTParameterValueList;
  }
> {
  constructor(public reference: Malloy.Reference) {
    super(reference, {
      name: reference.name,
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

  /**
   * Gets the parameter list for this reference, or creates it if it does not exist.
   *
   * @returns The parameter list `ASTParameterValueList`
   */
  public getOrAddParameters() {
    // TODO ABSTRACT THIS OUT INTO A COMMON METHOD FOR THE DIFFERENT REFERENCE TYPES?
    if (this.children.parameters) {
      return this.children.parameters;
    }
    this.edit();
    const parameters = new ASTParameterValueList([]);
    this.children.parameters = parameters;
    return parameters;
  }

  /**
   * Adds a parameter to this source with with the given name and value
   *
   * This will override an existing parameter with the same name.
   *
   * @param name The name of the parameter to set
   * @param value The value of the parameter to set
   */
  public addParameter(name: string, value: RawLiteralValue) {
    return this.getOrAddParameters().addParameter(name, value);
  }
}

type ASTFieldReferenceParent =
  | ASTFilterWithFilterString
  | ASTOrderByViewOperation
  | ASTTimeTruncationExpression
  | ASTFilteredFieldExpression;

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
    } else if (parent instanceof ASTFilterWithFilterString) {
      const grand = parent.parent as ASTWhere | ASTWhereViewOperation;
      if (grand instanceof ASTWhere) {
        return grand.list.expression.field.segment;
      } else {
        return grand.list.segment;
      }
    } else {
      return parent.list.segment;
    }
  }

  getFieldInfo() {
    const schema = this.segment.getInputSchema();
    // TODO path
    return ASTNode.schemaGet(schema, this.name);
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

  /**
   * Gets the parameter list for this reference, or creates it if it does not exist.
   *
   * @returns The parameter list `ASTParameterValueList`
   */
  public getOrAddParameters() {
    // TODO ABSTRACT THIS OUT INTO A COMMON METHOD FOR THE DIFFERENT REFERENCE TYPES?
    if (this.children.parameters) {
      return this.children.parameters;
    }
    this.edit();
    const parameters = new ASTParameterValueList([]);
    this.children.parameters = parameters;
    return parameters;
  }

  /**
   * Adds a parameter to this source with with the given name and value
   *
   * This will override an existing parameter with the same name.
   *
   * @param name The name of the parameter to set
   * @param value The value of the parameter to set
   */
  public setParameter(name: string, value: RawLiteralValue) {
    return this.getOrAddParameters().addParameter(name, value);
  }

  public tryGetParameter(name: string) {
    if (this.parameters === undefined) return undefined;
    for (const parameter of this.parameters.iter()) {
      if (parameter.name === name) {
        return parameter;
      }
    }
  }
}

export class ASTSourceReference extends ASTReference {
  /**
   * @internal
   */
  get query(): ASTQuery {
    return this.parent.parent.asQuery();
  }

  /**
   * Gets the `Malloy.SourceInfo` for the referenced source
   *
   * @returns The source information for the referenced source
   */
  public getSourceInfo(): Malloy.SourceInfo {
    const info = this.query.model.entries.find(e => e.name === this.name);
    if (info === undefined) {
      throw new Error('No source info found');
    }
    return info;
  }

  public getSourceParameters(): Malloy.ParameterInfo[] {
    return this.getSourceInfo().parameters ?? [];
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

  /**
   * Gets the parameter list for this reference, or creates it if it does not exist.
   *
   * @returns The parameter list `ASTParameterValueList`
   */
  public getOrAddParameters() {
    // TODO ABSTRACT THIS OUT INTO A COMMON METHOD FOR THE DIFFERENT REFERENCE TYPES?
    if (this.children.parameters) {
      return this.children.parameters;
    }
    this.edit();
    const parameters = new ASTParameterValueList([]);
    this.children.parameters = parameters;
    return parameters;
  }

  /**
   * Adds a parameter to this source with with the given name and value
   *
   * This will override an existing parameter with the same name.
   *
   * @param name The name of the parameter to set
   * @param value The value of the parameter to set
   */
  public setParameter(name: string, value: RawLiteralValue) {
    const parameters = this.getOrAddParameters();
    parameters.add(
      new ASTParameterValue({
        name,
        value: LiteralValueAST.makeLiteral(value),
      })
    );
  }

  public tryGetParameter(name: string) {
    if (this.parameters === undefined) return undefined;
    for (const parameter of this.parameters.iter()) {
      if (parameter.name === name) {
        return parameter;
      }
    }
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

  addParameter(name: string, value: RawLiteralValue) {
    this.add(
      new ASTParameterValue({
        name,
        value: LiteralValueAST.makeLiteral(value),
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
      value: LiteralValueAST.from(parameter.value),
    });
  }

  get name() {
    return this.children.name;
  }
}

export type ASTLiteralValue = ASTStringLiteralValue | ASTNumberLiteralValue;
export const LiteralValueAST = {
  from(value: Malloy.LiteralValue) {
    switch (value.kind) {
      case 'string_literal':
        return new ASTStringLiteralValue(value);
      case 'number_literal':
        return new ASTNumberLiteralValue(value);
      default:
        throw new Error(`Unsupported literal value type ${value.kind}`);
    }
  },
  makeLiteral(value: RawLiteralValue): Malloy.LiteralValue {
    if (typeof value === 'string') {
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
    }
    throw new Error('TODO other literal types');
  },
};

// | DateLiteralValueAST
// | TimestampLiteralValueAST
// | BooleanLiteralValueAST
// | NullLiteralValueAST;

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

  find(): never {
    throw new Error('Tried to find a node from an unimplemented node type');
  }
}

export interface IASTQueryDefinition {
  getOrAddDefaultSegment(): ASTSegmentViewDefinition;
  reorderFields(names: string[]): void;
  isRunnable(): boolean;

  /**
   * Upward propagation of name change; change order bys to use a new name for a field.
   * @internal
   */
  renameOrderBys(oldName: string, newName: string): void;
  /**
   * Downward propagation of name change; change order bys to use a new name for a field.
   * @internal
   */
  renameOrderBysInSelf(oldName: string, newName: string): void;
  /**
   * Upward propagation of field deletion
   * @internal
   */
  removeOrderBys(name: string): void;
  /**
   * Downward propagation of field deletion
   * @internal
   */
  removeOrderBysInSelf(name: string): void;
}

export type ASTQueryDefinition =
  | ASTReferenceQueryDefinition
  | ASTArrowQueryDefinition
  | ASTRefinementQueryDefinition;
export const ASTQueryDefinition = {
  from: (definition: Malloy.QueryDefinition) => {
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
      source_reference: ASTSourceReference;
      view: ASTViewDefinition;
    }
  >
  implements IASTQueryDefinition
{
  constructor(public node: Malloy.QueryDefinitionWithArrow) {
    super(node, {
      kind: 'arrow',
      source_reference: new ASTSourceReference(node.source_reference),
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

  get sourceReference() {
    return this.children.source_reference;
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    return this.view.getOrAddDefaultSegment();
  }

  getSourceInfo() {
    return this.sourceReference.getSourceInfo();
  }

  getOutputSchema() {
    return this.view.getRefinementSchema();
  }

  isRunnable(): boolean {
    return (
      this.view.isRunnable() && this.sourceReference.areRequiredParametersSet()
    );
  }

  /**
   * @internal
   */
  get query() {
    return this.parent.asQuery();
  }

  /**
   * @internal
   */
  renameOrderBys(oldName: string, newName: string): void {
    this.renameOrderBysInSelf(oldName, newName);
  }

  /**
   * @internal
   */
  renameOrderBysInSelf(oldName: string, newName: string): void {
    this.view.renameOrderBysInSelf(oldName, newName);
  }

  // TODO abstract this logic of upward/downward propagation
  /**
   * @internal
   */
  removeOrderBys(name: string): void {
    this.removeOrderBysInSelf(name);
  }

  /**
   * @internal
   */
  removeOrderBysInSelf(name: string): void {
    this.view.removeOrderBysInSelf(name);
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
      query_reference: ASTReference;
      refinement: ASTViewDefinition;
    }
  >
  implements IASTQueryDefinition
{
  constructor(public node: Malloy.QueryDefinitionWithRefinement) {
    super(node, {
      kind: 'refinement',
      query_reference: new ASTReference(node.query_reference),
      refinement: ASTViewDefinition.from(node.refinement),
    });
  }

  get queryReference() {
    return this.children.query_reference;
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
    return this.refinement.isRunnable();
  }

  /**
   * @internal
   */
  get query() {
    return this.parent.asQuery();
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    return this.refinement.getOrAddDefaultSegment();
  }

  getOutputSchema() {
    const model = this.query.model;
    const query = model.entries.find(e => e.name === this.queryReference.name);
    if (query === undefined) {
      throw new Error(`Query not found with name ${this.queryReference.name}`);
    }
    const base = query.schema;
    const refinement = this.refinement.getRefinementSchema();
    return ASTQuery.schemaMerge(base, refinement);
  }
  /**
   * @internal
   */
  renameOrderBys(oldName: string, newName: string): void {
    this.renameOrderBysInSelf(oldName, newName);
  }

  /**
   * @internal
   */
  renameOrderBysInSelf(oldName: string, newName: string): void {
    this.refinement.renameOrderBysInSelf(oldName, newName);
  }

  /**
   * @internal
   */
  removeOrderBys(name: string): void {
    this.removeOrderBysInSelf(name);
  }

  /**
   * @internal
   */
  removeOrderBysInSelf(name: string): void {
    this.refinement.removeOrderBysInSelf(name);
  }

  reorderFields(names: string[]): void {
    this.query.getOrAddAnnotations().setTagProperty(['field_order'], names);
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
  implements IASTQueryDefinition
{
  constructor(public node: Malloy.QueryDefinitionWithQueryReference) {
    super(node, {
      kind: 'query_reference',
      name: node.name,
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
    return this.parent.asQuery();
  }

  get parameters() {
    return this.children.parameters;
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    const newQuery = new ASTRefinementQueryDefinition({
      kind: 'refinement',
      query_reference: {
        name: this.name,
        path: undefined, // TODO
        parameters: this.parameters?.build(),
      },
      refinement: {
        kind: 'segment',
        operations: [],
      },
    });
    this.query.definition = newQuery;
    return newQuery.refinement.asSegmentViewDefinition();
  }

  /**
   * @internal
   */
  renameOrderBys(_oldName: string, _newName: string): void {
    return;
  }

  /**
   * @internal
   */
  renameOrderBysInSelf(_oldName: string, _newName: string): void {
    return;
  }

  /**
   * @internal
   */
  removeOrderBys(_name: string): void {
    return;
  }

  /**
   * @internal
   */
  removeOrderBysInSelf(_name: string): void {
    return;
  }

  reorderFields(names: string[]): void {
    this.query.getOrAddAnnotations().setTagProperty(['field_order'], names);
  }
}

export interface IASTViewDefinition {
  isRunnable(): boolean;
  getOrAddDefaultSegment(): ASTSegmentViewDefinition;
  getInputSchema(): Malloy.Schema;
  getOutputSchema(): Malloy.Schema;
  getImplicitName(): string | undefined;
  getRefinementSchema(): Malloy.Schema;
  addEmptyRefinement(): ASTSegmentViewDefinition;
  addViewRefinement(name: string): ASTReferenceViewDefinition; // todo path
  isValidViewRefinement(name: string): {
    isValidViewRefinement: boolean;
    error?: string;
  };
  getInheritedAnnotations(): Malloy.Annotation[];
  /**
   * Upward propagation of name change; change order bys to use a new name for a field.
   * @internal
   */
  renameOrderBys(oldName: string, newName: string): void;
  /**
   * Downward propagation of name change; change order bys to use a new name for a field.
   * @internal
   */
  renameOrderBysInSelf(oldName: string, newName: string): void;
  /**
   * Upward propagation of field deletion
   * @internal
   */
  removeOrderBys(name: string): void;
  /**
   * Downward propagation of field deletion
   * @internal
   */
  removeOrderBysInSelf(name: string): void;
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
  name: string
): {
  isValidViewRefinement: boolean;
  error?: string;
} {
  const schema = view.getInputSchema();
  const field = ASTQuery.schemaGet(schema, name);
  if (field === undefined) {
    return {isValidViewRefinement: false, error: `${name} is not defined`};
  } else if (field.kind !== 'view') {
    // TODO scalar refinements
    return {isValidViewRefinement: false, error: `${name} is not a view`};
  }
  const prevOutput = view.getOutputSchema();
  for (const refinementField of field.schema.fields) {
    if (ASTQuery.schemaTryGet(prevOutput, refinementField.name)) {
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
  implements IASTViewDefinition
{
  constructor(public node: Malloy.ViewDefinitionWithViewReference) {
    super(node, {
      kind: 'view_reference',
      name: node.name,
      parameters: node.parameters && new ASTParameterValueList(node.parameters),
    });
  }

  isRunnable(): boolean {
    return true;
  }

  get name() {
    return this.children.name;
  }

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    const newView = new ASTRefinementViewDefinition({
      kind: 'refinement',
      base: this.build(),
      refinement: {
        kind: 'segment',
        operations: [],
      },
    });
    swapViewInParent(this, newView);
    return newView.refinement.asSegmentViewDefinition();
  }

  addEmptyRefinement(): ASTSegmentViewDefinition {
    const newView = new ASTRefinementViewDefinition({
      kind: 'refinement',
      base: this.build(),
      refinement: {
        kind: 'segment',
        operations: [],
      },
    });
    swapViewInParent(this, newView);
    return newView.refinement.asSegmentViewDefinition();
  }

  addViewRefinement(name: string): ASTReferenceViewDefinition {
    const {error} = this.isValidViewRefinement(name);
    if (error) {
      throw new Error(error);
    }
    const newView = new ASTRefinementViewDefinition({
      kind: 'refinement',
      base: this.build(),
      refinement: {
        kind: 'view_reference',
        name,
      },
    });
    swapViewInParent(this, newView);
    return newView.refinement.asReferenceViewDefinition();
  }

  isValidViewRefinement(name: string): {
    isValidViewRefinement: boolean;
    error?: string;
  } {
    return isValidViewRefinement(this, name);
  }

  getInputSchema(): Malloy.Schema {
    const parent = this.parent as
      | ASTArrowQueryDefinition
      | ASTRefinementQueryDefinition
      | ASTView
      | ASTArrowViewDefinition
      | ASTRefinementViewDefinition;
    if (parent instanceof ASTArrowQueryDefinition) {
      return parent.getSourceInfo().schema;
    } else if (parent instanceof ASTRefinementQueryDefinition) {
      throw new Error('unimplemented');
    } else {
      return parent.getInputSchema();
    }
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
    const view = ASTNode.schemaGet(schema, this.name); // TODO path
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
  renameOrderBys(oldName: string, newName: string): void {
    (this.parent as ViewParent).renameOrderBys(oldName, newName);
  }

  /**
   * @internal
   */
  renameOrderBysInSelf(_oldName: string, _newName: string): void {
    return;
  }

  /**
   * @internal
   */
  removeOrderBys(name: string): void {
    (this.parent as ViewParent).removeOrderBys(name);
  }

  /**
   * @internal
   */
  removeOrderBysInSelf(_name: string): void {
    return;
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    const view = this.getViewInfo();
    return view.annotations ?? [];
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

  addViewRefinement(name: string): ASTReferenceViewDefinition {
    return this.view.addViewRefinement(name);
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

  isValidViewRefinement(name: string): {
    isValidViewRefinement: boolean;
    error?: string;
  } {
    return isValidViewRefinement(this, name);
  }

  /**
   * @internal
   */
  renameOrderBys(oldName: string, newName: string): void {
    this.renameOrderBysInSelf(oldName, newName);
  }

  /**
   * @internal
   */
  renameOrderBysInSelf(oldName: string, newName: string): void {
    this.view.renameOrderBysInSelf(oldName, newName);
  }

  /**
   * @internal
   */
  removeOrderBys(name: string): void {
    this.removeOrderBysInSelf(name);
  }

  /**
   * @internal
   */
  removeOrderBysInSelf(name: string): void {
    this.view.removeOrderBysInSelf(name);
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
    return this.base.isRunnable() && this.refinement.isRunnable();
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

  getOrAddDefaultSegment(): ASTSegmentViewDefinition {
    return this.refinement.getOrAddDefaultSegment();
  }

  addEmptyRefinement(): ASTSegmentViewDefinition {
    return this.refinement.addEmptyRefinement();
  }

  addViewRefinement(name: string): ASTReferenceViewDefinition {
    return this.refinement.addViewRefinement(name);
  }

  getInputSchema(): Malloy.Schema {
    // TODO this is duplicated in a few places
    const parent = this.parent as
      | ASTArrowQueryDefinition
      | ASTRefinementQueryDefinition
      | ASTView
      | ASTArrowViewDefinition
      | ASTRefinementViewDefinition;
    if (parent instanceof ASTArrowQueryDefinition) {
      return parent.getSourceInfo().schema;
    } else if (parent instanceof ASTRefinementQueryDefinition) {
      throw new Error('unimplemented');
    } else {
      return parent.getInputSchema();
    }
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

  isValidViewRefinement(name: string): {
    isValidViewRefinement: boolean;
    error?: string;
  } {
    return isValidViewRefinement(this, name);
  }

  /**
   * @internal
   */
  renameOrderBys(oldName: string, newName: string): void {
    (this.parent as ViewParent).renameOrderBys(oldName, newName);
  }

  /**
   * @internal
   */
  renameOrderBysInSelf(oldName: string, newName: string): void {
    this.base.renameOrderBysInSelf(oldName, newName);
    this.refinement.renameOrderBysInSelf(oldName, newName);
  }

  /**
   * @internal
   */
  removeOrderBys(name: string): void {
    (this.parent as ViewParent).removeOrderBys(name);
  }

  /**
   * @internal
   */
  removeOrderBysInSelf(name: string): void {
    this.base.removeOrderBysInSelf(name);
    this.refinement.removeOrderBysInSelf(name);
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    return this.base.getInheritedAnnotations();
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
    for (const operation of this.operations.iter()) {
      if (
        operation instanceof ASTAggregateViewOperation ||
        operation instanceof ASTGroupByViewOperation ||
        operation instanceof ASTNestViewOperation
      ) {
        return true;
      }
    }
    return false;
  }

  get operations() {
    return this.children.operations;
  }

  /**
   * Downward propagation of name change; change order bys to use a new name for a field.
   * @internal
   */
  renameOrderBysInSelf(oldName: string, newName: string) {
    for (const operation of this.operations.iter()) {
      if (operation instanceof ASTOrderByViewOperation) {
        if (operation.name === oldName) {
          operation.setField(newName);
        }
      }
    }
  }
  /**
   * Upward propagation of name change; change order bys to use a new name for a field.
   * @internal
   */
  renameOrderBys(oldName: string, newName: string) {
    (this.parent as ViewParent).renameOrderBys(oldName, newName);
  }

  /**
   * @internal
   */
  removeOrderBys(name: string): void {
    (this.parent as ViewParent).removeOrderBys(name);
  }

  /**
   * @internal
   */
  removeOrderBysInSelf(name: string): void {
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
    if (ASTNode.schemaTryGet(output, name)) {
      throw new Error(`Output already has a field named ${name}`);
    }
    const oldName = field.name;
    field.name = name;
    this.renameOrderBys(oldName, name);
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
   * The order by item is added to an existing order by operation if one is present,
   * or to a new order by operation at the end of the query.
   *
   * @param name The name of the field to order by.
   * @param direction The order by direction (ascending or descending).
   */
  public addOrderBy(name: string, direction?: Malloy.OrderByDirection) {
    // TODO decide where to add it
    // Ensure output schema has a field with this name
    const outputSchema = this.getOutputSchema();
    try {
      ASTNode.schemaGet(outputSchema, name);
    } catch {
      throw new Error(`No such field ${name} in stage output`);
    }
    // first see if there is already an order by for this field
    for (const operation of this.operations.iter()) {
      if (operation instanceof ASTOrderByViewOperation) {
        if (operation.name === name) {
          operation.direction = direction;
          return;
        }
      }
    }
    // add a new order by operation
    this.operations.add(
      new ASTOrderByViewOperation({
        kind: 'order_by',
        field_reference: {name},
        direction,
      })
    );
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
    // TODO validate name
    // TODO decide whether this by default groups into existing nest operation?
    // TODO pick a better location in the query
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
    this.operations.add(nest);
    return nest;
  }

  private firstIndexOfOperationType(type: Malloy.ViewOperationType) {
    return this.operations.findIndex(o => o.kind === type);
  }

  private DEFAULT_INSERTION_ORDER: Malloy.ViewOperationType[] = [
    'where',
    'group_by',
    'aggregate',
    'nest',
    'order_by',
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
      return firstOfType;
    }
    return this.operations.length;
  }

  public getFieldNamed(
    name: string
  ):
    | ASTGroupByViewOperation
    | ASTAggregateViewOperation
    | ASTNestViewOperation
    | undefined {
    const field = this.tryGetFieldNamed(name);
    if (field === undefined) throw new Error('No such field');
    return field;
  }

  public hasFieldNamed(name: string): boolean {
    return this.tryGetFieldNamed(name) !== undefined;
  }

  public hasField(name: string): boolean {
    return this.tryGetField(name) !== undefined;
  }

  // TODO what constitutes "having a field" -- does "dep_time.month" count as dep_time?
  // does flight_count {where: carrier = 'CA' } count as flight_count?
  public tryGetField(
    name: string
  ):
    | ASTGroupByViewOperation
    | ASTAggregateViewOperation
    | ASTNestViewOperation
    | undefined {
    for (const operation of this.operations.iter()) {
      if (
        operation instanceof ASTGroupByViewOperation ||
        operation instanceof ASTAggregateViewOperation
      ) {
        // TODO paths
        if (operation.field.getReference().name === name) {
          return operation;
        }
      } else if (operation instanceof ASTNestViewOperation) {
        if (operation.view instanceof ASTReferenceViewDefinition) {
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
    | undefined {
    for (const operation of this.operations.iter()) {
      if (
        operation instanceof ASTGroupByViewOperation ||
        operation instanceof ASTAggregateViewOperation ||
        operation instanceof ASTNestViewOperation
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
   */
  public addGroupBy(name: string) {
    const item = this.makeField(name, 'dimension');
    this.addOperation(item);
    return item;
  }

  public addWhere(name: string, filter: ParsedFilter): ASTWhereViewOperation;
  public addWhere(name: string, filterString: string): ASTWhereViewOperation;
  public addWhere(
    name: string,
    filter: string | ParsedFilter
  ): ASTWhereViewOperation {
    const filterString =
      typeof filter === 'string' ? filter : serializeFilter(filter);
    // TODO validate name
    // TODO validate filter string
    const item = new ASTWhereViewOperation({
      kind: 'where',
      filter: {
        kind: 'filter_string',
        field_reference: {name},
        filter: filterString,
      },
    });
    this.addOperation(item);
    return item;
  }

  private addTimeGroupBy(
    name: string,
    timeframe: Malloy.TimestampTimeframe,
    type: 'date_type' | 'timestamp_type'
  ) {
    const schema = this.getInputSchema();
    const fieldInfo = ASTNode.schemaGet(schema, name);
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
          // TODO references here should also be paths?
          field_reference: {name},
          truncation: timeframe,
        },
      },
    });
    this.addOperation(item);
  }

  // TODO these names should really be paths: string[]
  public addDateGroupBy(name: string, timeframe: Malloy.DateTimeframe) {
    this.addTimeGroupBy(name, timeframe, 'date_type');
  }

  public addTimestampGroupBy(name: string, timeframe: Malloy.DateTimeframe) {
    this.addTimeGroupBy(name, timeframe, 'timestamp_type');
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
   */
  public addAggregate(name: string) {
    const item = this.makeField(name, 'measure');
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
   */
  public addNest(name: string) {
    const item = this.makeField(name, 'view');
    this.addOperation(item);
  }

  private makeField(name: string, type: 'dimension'): ASTGroupByViewOperation;
  private makeField(name: string, type: 'measure'): ASTAggregateViewOperation;
  private makeField(name: string, type: 'view'): ASTNestViewOperation;
  private makeField(name: string, type: 'dimension' | 'measure' | 'view') {
    const schema = this.getInputSchema();
    const fieldInfo = ASTNode.schemaGet(schema, name);
    if (fieldInfo === undefined) {
      throw new Error(`No such field ${name}`);
    }
    if (fieldInfo.kind !== type) {
      const action = fieldTypeToAction(type);
      const typeName = fieldTypeName(type);
      throw new Error(`Cannot ${action} non-${typeName} ${name}`);
    }
    if (type === 'dimension') {
      return ASTGroupByViewOperation.fromName(name);
    } else if (type === 'measure') {
      return ASTAggregateViewOperation.fromName(name);
    } else {
      return ASTNestViewOperation.fromName(name);
    }
  }

  private addOperation(
    item:
      | ASTGroupByViewOperation
      | ASTAggregateViewOperation
      | ASTNestViewOperation
      | ASTWhereViewOperation
  ) {
    // TODO ensure output schema doesn't already have this name, and add a parameter here to
    // allow specifying an override name
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
        operation instanceof ASTNestViewOperation
      ) {
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
    // TODO throw if not an integer
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
    const view = new ASTRefinementViewDefinition({
      kind: 'refinement',
      base: this.build(),
      refinement: {
        kind: 'segment',
        operations: [],
      },
    });
    swapViewInParent(this, view);
    return view.refinement.asSegmentViewDefinition();
  }

  addViewRefinement(name: string): ASTReferenceViewDefinition {
    const {error} = this.isValidViewRefinement(name);
    if (error) {
      throw new Error(error);
    }
    const view = new ASTRefinementViewDefinition({
      kind: 'refinement',
      base: this.build(),
      refinement: {
        kind: 'view_reference',
        name,
      },
    });
    swapViewInParent(this, view);
    return view.refinement.asReferenceViewDefinition();
  }

  getInputSchema(): Malloy.Schema {
    // TODO this is duplicated in a few places
    const parent = this.parent as ViewParent;
    if (parent instanceof ASTArrowQueryDefinition) {
      return parent.getSourceInfo().schema;
    } else if (parent instanceof ASTRefinementQueryDefinition) {
      throw new Error('unimplemented');
    } else {
      return parent.getInputSchema();
    }
  }

  getOutputSchema(): Malloy.Schema {
    const parent = this.parent as ViewParent;
    return parent.getOutputSchema();
  }

  getImplicitName(): string | undefined {
    return undefined;
  }

  isValidViewRefinement(name: string): {
    isValidViewRefinement: boolean;
    error?: string;
  } {
    return isValidViewRefinement(this, name);
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
    return this.parent.asSegmentViewDefinition();
  }
}

export type ASTViewOperation =
  | ASTGroupByViewOperation
  | ASTAggregateViewOperation
  | ASTOrderByViewOperation
  | ASTNestViewOperation
  | ASTLimitViewOperation
  | ASTWhereViewOperation;
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
    return this.parent.asViewOperationList();
  }

  delete() {
    const list = this.list;
    list.remove(this);
  }

  setField(name: string) {
    const schema = this.list.segment.getOutputSchema();
    ASTNode.schemaGet(schema, name);
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
    return this.children.name ?? this.field.name;
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
    return this.parent.asViewOperationList();
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
    this.list.segment.removeOrderBys(this.name);
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
  static fromName(name: string) {
    return new ASTGroupByViewOperation({
      kind: 'group_by',
      field: {
        expression: {
          kind: 'field_reference',
          name,
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
    return this.children.name ?? this.field.name;
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
   * @internal
   */
  get list() {
    return this.parent.asViewOperationList();
  }

  delete() {
    this.list.remove(this);
    this.list.segment.removeOrderBys(this.name);
  }

  getFieldInfo(): Malloy.FieldInfo {
    return {
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

  addWhere(name: string, filterString: string): ASTFilteredFieldExpression;
  addWhere(name: string, filter: ParsedFilter): ASTFilteredFieldExpression;
  addWhere(
    name: string,
    filter: string | ParsedFilter
  ): ASTFilteredFieldExpression {
    const filterString =
      typeof filter === 'string' ? filter : serializeFilter(filter);
    const schema = this.list.segment.getInputSchema();
    ASTQuery.schemaGet(schema, name);
    const where: Malloy.Where = {
      filter: {
        kind: 'filter_string',
        field_reference: {name},
        filter: filterString,
      },
    };
    if (this.field.expression instanceof ASTFilteredFieldExpression) {
      this.field.expression.where.add(new ASTWhere(where));
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
  static fromName(name: string) {
    return new ASTAggregateViewOperation({
      kind: 'aggregate',
      field: {
        expression: {
          kind: 'field_reference',
          name,
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
    return this.expression.fieldType;
  }

  get annotations() {
    return this.children.annotations;
  }

  // TODO should you have to call delete annotations? What if you do `annotations = undefined` instead of `annotations = DELETED`?
  set annotations(annotations: ASTAnnotationList | undefined) {
    this.edit();
    this.children.annotations = annotations;
  }

  // Returns a Malloy reference that this field points to
  getReference() {
    return this.expression.getReference();
  }

  getOrAddAnnotations() {
    if (this.annotations) return this.annotations;
    this.edit();
    const annotations = new ASTAnnotationList([]);
    this.children.annotations = annotations;
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
  | ASTTimeTruncationExpression;
export const ASTExpression = {
  from(value: Malloy.Expression): ASTExpression {
    switch (value.kind) {
      case 'field_reference':
        return new ASTReferenceExpression(value);
      case 'filtered_field':
        return new ASTFilteredFieldExpression(value);
      case 'time_truncation':
        return new ASTTimeTruncationExpression(value);
    }
  },
};

// TODO would be nice for this to extend ASTFieldReference?
export class ASTReferenceExpression extends ASTObjectNode<
  Malloy.ExpressionWithFieldReference,
  {
    kind: 'field_reference';
    name: string;
    parameters?: ASTParameterValueList;
  }
> {
  readonly kind: Malloy.ExpressionType = 'field_reference';

  constructor(public node: Malloy.ExpressionWithFieldReference) {
    super(node, {
      kind: node.kind,
      name: node.name,
      parameters: node.parameters && new ASTParameterValueList(node.parameters),
    });
  }

  get name() {
    return this.children.name;
  }

  /**
   * @internal
   */
  get field() {
    return this.parent.asField();
  }

  getReference() {
    return this.build();
  }

  getFieldInfo(): Malloy.FieldInfoWithDimension | Malloy.FieldInfoWithMeasure {
    const schema = this.field.segment.getInputSchema();
    const def = ASTNode.schemaGet(schema, this.name);
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

  get name() {
    return this.fieldReference.name;
  }

  /**
   * @internal
   */
  get field() {
    return this.parent.asField();
  }

  getFieldInfo(): Malloy.FieldInfoWithDimension | Malloy.FieldInfoWithMeasure {
    const schema = this.field.segment.getInputSchema();
    const def = ASTNode.schemaGet(schema, this.name);
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
    } else if (def.type.kind === 'timestamp_type') {
      return {...def.type, timeframe: this.truncation};
    }
    throw new Error('This type of field cannot have a time truncation');
  }

  getInheritedAnnotations(): Malloy.Annotation[] {
    const field = this.getFieldInfo();
    return field.annotations ?? [];
  }
}

export class ASTWhere extends ASTObjectNode<Malloy.Where, {filter: ASTFilter}> {
  constructor(node: Malloy.Where) {
    super(node, {
      filter: ASTFilter.from(node.filter),
    });
  }

  get filter() {
    return this.children.filter;
  }

  get list() {
    return this.parent.asWhereList();
  }

  delete() {
    this.list.remove(this);
  }
}

export class ASTWhereList extends ASTListNode<Malloy.Where, ASTWhere> {
  constructor(wheres: Malloy.Where[]) {
    super(
      wheres,
      wheres.map(p => new ASTWhere(p))
    );
  }

  get expression() {
    return this.parent.asFilteredFieldExpression();
  }
}

export class ASTFilteredFieldExpression extends ASTObjectNode<
  Malloy.ExpressionWithFilteredField,
  {
    kind: 'filtered_field';
    field_reference: ASTFieldReference;
    where: ASTWhereList;
  }
> {
  readonly kind: Malloy.ExpressionType = 'filtered_field';

  constructor(public node: Malloy.ExpressionWithFilteredField) {
    super(node, {
      kind: node.kind,
      field_reference: new ASTFieldReference(node.field_reference),
      where: new ASTWhereList(node.where),
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
    return this.parent.asField();
  }

  getFieldInfo(): Malloy.FieldInfoWithMeasure {
    const schema = this.field.segment.getInputSchema();
    const def = ASTNode.schemaGet(schema, this.name);
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
    return this.parent.asViewOperationList();
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
  static fromName(name: string) {
    return new ASTNestViewOperation({
      kind: 'nest',
      view: {
        definition: {
          kind: 'view_reference',
          name,
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
  readonly kind: Malloy.ViewOperationType = 'nest';
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
    return this.parent.asViewOperationList();
  }

  delete() {
    this.list.remove(this);
  }
}

export type ASTFilter = ASTFilterWithFilterString;
export const ASTFilter = {
  from(filter: Malloy.Filter) {
    return new ASTFilterWithFilterString(filter);
  },
};

export class ASTFilterWithFilterString extends ASTObjectNode<
  Malloy.FilterWithFilterString,
  {
    kind: 'filter_string';
    field_reference: ASTFieldReference;
    filter: string;
  }
> {
  readonly kind: Malloy.FilterType = 'filter_string';
  constructor(public node: Malloy.FilterWithFilterString) {
    super(node, {
      kind: 'filter_string',
      field_reference: new ASTFieldReference(node.field_reference),
      filter: node.filter,
    });
  }

  get fieldReference() {
    return this.children.field_reference;
  }

  get filterString() {
    return this.children.filter;
  }

  set filterString(filter: string) {
    this.edit();
    this.children.filter = filter;
  }

  setFilterString(filterString: string) {
    // TODO validate
    this.filterString = filterString;
  }

  getFieldInfo() {
    const field = this.fieldReference.getFieldInfo();
    if (field.kind !== 'dimension' && field.kind !== 'measure') {
      throw new Error('Invalid field type for filter with filter string');
    }
    return field;
  }

  getFilterType(): 'string' | 'boolean' | 'number' | 'time' | 'other' {
    const fieldInfo = this.getFieldInfo();
    switch (fieldInfo.type.kind) {
      case 'string_type':
        return 'string';
      case 'boolean_type':
        return 'boolean';
      case 'number_type':
        return 'number';
      case 'date_type':
      case 'timestamp_type':
        return 'time';
      default:
        return 'other';
    }
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
    switch (kind) {
      case 'string': {
        const result = new Filter.StringParser(this.filterString).parse();
        return {kind, clauses: result.clauses};
      }
      case 'number': {
        const result = new Filter.NumberParser(this.filterString).parse();
        return {kind, clauses: result.clauses};
      }
      case 'boolean': {
        const result = new Filter.BooleanParser(this.filterString).parse();
        return {kind, clauses: result.clauses};
      }
      case 'time':
      case 'other':
        throw new Error('Not implemented');
    }
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
    return this.parent.asNestViewOperation();
  }

  getInputSchema() {
    return this.nest.list.segment.getInputSchema();
  }

  getOutputSchema() {
    return this.definition.getOutputSchema();
  }

  /**
   * @internal
   */
  renameOrderBys(oldName: string, newName: string): void {
    this.renameOrderBysInSelf(oldName, newName);
  }

  /**
   * @internal
   */
  renameOrderBysInSelf(oldName: string, newName: string): void {
    this.definition.renameOrderBysInSelf(oldName, newName);
  }

  /**
   * @internal
   */
  removeOrderBys(name: string): void {
    this.removeOrderBysInSelf(name);
  }

  /**
   * @internal
   */
  removeOrderBysInSelf(name: string): void {
    this.definition.removeOrderBysInSelf(name);
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
    return this.parent.asViewOperationList();
  }

  delete() {
    this.list.remove(this);
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
    const extending = Tag.fromTagLines(
      this.getInheritedAnnotations().map(a => a.value)
    ).tag;
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
  readonly kind: Malloy.ViewOperationType = 'limit';

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
    return this.parent.asAnnotationList();
  }

  get index() {
    return this.list.indexOf(this);
  }

  delete() {
    this.list.remove(this);
  }

  getIntrinsicTag(): Tag {
    return Tag.fromTagLines([this.value]).tag ?? new Tag();
  }

  getTag(): Tag {
    const extending =
      this.index === 0
        ? Tag.fromTagLines(
            this.list.getInheritedAnnotations().map(a => a.value)
          ).tag ?? new Tag()
        : this.list.index(this.index - 1).getTag();
    return Tag.fromTagLines([this.value], extending).tag ?? new Tag();
  }

  hasPrefix(prefix: string) {
    return this.value.startsWith(prefix);
  }

  hasIntrinsicTagProperty(path: Path) {
    return this.getIntrinsicTag().has(...path);
  }

  setTagProperty(path: Path, value: TagSetValue) {
    this.value = this.getTag().set(path, value).toString();
  }

  removeTagProperty(path: Path) {
    this.value = this.getTag()
      .unset(...path)
      .toString();
  }
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
  return Tag.fromTagLines(filteredLines, inherited).tag ?? new Tag();
}

function serializeFilter(filter: ParsedFilter) {
  switch (filter.kind) {
    case 'string':
      return new Filter.StringSerializer(filter.clauses).serialize();
    case 'number':
      return new Filter.NumberSerializer(filter.clauses).serialize();
    case 'boolean':
      return new Filter.BooleanSerializer(filter.clauses).serialize();
    case 'time':
      return new Filter.DateSerializer(filter.clauses).serialize();
  }
}
