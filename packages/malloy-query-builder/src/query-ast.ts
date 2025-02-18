/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';

type PathSegment = number | string;
type Path = PathSegment[];

type ASTAny = ASTNode<unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
type NodeConstructor<T extends ASTAny> = any;

type ASTChildren<T> = {
  [Key in keyof T]: LiteralOrNode<T[Key]>;
};

const DELETED = null;

type NonOptionalASTNode<T> = T extends undefined ? never : ASTNode<T>;

type Deletable<T> = T | typeof DELETED;

type LiteralOrNode<T> = T extends string
  ? string
  : T extends number
  ? number
  : undefined extends T
  ? NonOptionalASTNode<T> | null | undefined
  : ASTNode<T>;

abstract class ASTNode<T> {
  edited = false;

  public _parent: ASTAny | undefined;

  abstract build(): T;

  edit() {
    this.edited = true;
    if (this._parent) this._parent.edit();
    return this;
  }

  abstract find(path: Path): ASTAny;

  asReference(): ASTReference {
    if (this instanceof ASTReference) return this;
    throw new Error('Not an ASTReference');
  }

  findReference(path: Path): ASTReference {
    return this.find(path).asReference();
  }

  asQuery(): ASTQuery {
    if (this instanceof ASTQuery) return this;
    throw new Error('Not an ASTQuery');
  }

  findQuery(path: Path): ASTQuery {
    return this.find(path).asQuery();
  }

  asSourceReference(): ASTSourceReference {
    if (this instanceof ASTSourceReference) return this;
    throw new Error('Not an ASTSourceReference');
  }

  findSourceReference(path: Path): ASTSourceReference {
    return this.find(path).asSourceReference();
  }

  asParameterValueList(): ASTParameterValueList {
    if (this instanceof ASTParameterValueList) return this;
    throw new Error('Not an ASTParameterValueList');
  }

  findParameterValueList(path: Path): ASTParameterValueList {
    return this.find(path).asParameterValueList();
  }

  asParameterValue(): ASTParameterValue {
    if (this instanceof ASTParameterValue) return this;
    throw new Error('Not an ASTParameterValue');
  }

  findParameterValue(path: Path): ASTParameterValue {
    return this.find(path).asParameterValue();
  }

  asStringLiteralValue(): ASTStringLiteralValue {
    if (this instanceof ASTStringLiteralValue) return this;
    throw new Error('Not an ASTStringLiteralValue');
  }

  findStringLiteralValue(path: Path): ASTStringLiteralValue {
    return this.find(path).asStringLiteralValue();
  }

  asNumberLiteralValue(): ASTNumberLiteralValue {
    if (this instanceof ASTNumberLiteralValue) return this;
    throw new Error('Not an ASTNumberLiteralValue');
  }

  findNumberLiteralValue(path: Path): ASTNumberLiteralValue {
    return this.find(path).asNumberLiteralValue();
  }

  asPipeline(): ASTPipeline {
    if (this instanceof ASTPipeline) return this;
    throw new Error('Not an ASTPipeline');
  }

  findPipeline(path: Path): ASTPipeline {
    return this.find(path).asPipeline();
  }

  asPipeStageList(): ASTPipeStageList {
    if (this instanceof ASTPipeStageList) return this;
    throw new Error('Not an ASTPipeStageList');
  }

  findPipeStageList(path: Path): ASTPipeStageList {
    return this.find(path).asPipeStageList();
  }

  asPipeStage(): ASTPipeStage {
    if (this instanceof ASTPipeStage) return this;
    throw new Error('Not an ASTPipeStage');
  }

  findPipeStage(path: Path): ASTPipeStage {
    return this.find(path).asPipeStage();
  }

  asRefinementList(): ASTRefinementList {
    if (this instanceof ASTRefinementList) return this;
    throw new Error('Not an ASTRefinementList');
  }

  findRefinementList(path: Path): ASTRefinementList {
    return this.find(path).asRefinementList();
  }

  asReferenceRefinement(): ASTReferenceRefinement {
    if (this instanceof ASTReferenceRefinement) return this;
    throw new Error('Not an ASTReferenceRefinement');
  }

  findReferenceRefinement(path: Path): ASTReferenceRefinement {
    return this.find(path).asReferenceRefinement();
  }

  asSegmentRefinement(): ASTSegmentRefinement {
    if (this instanceof ASTSegmentRefinement) return this;
    throw new Error('Not an ASTSegmentRefinement');
  }

  findSegmentRefinement(path: Path): ASTSegmentRefinement {
    return this.find(path).asSegmentRefinement();
  }

  asViewOperationList(): ASTViewOperationList {
    if (this instanceof ASTViewOperationList) return this;
    throw new Error('Not an ASTViewOperationList');
  }

  findViewOperationList(path: Path): ASTViewOperationList {
    return this.find(path).asViewOperationList();
  }

  asGroupByViewOperation(): ASTGroupByViewOperation {
    if (this instanceof ASTGroupByViewOperation) return this;
    throw new Error('Not an ASTGroupByViewOperation');
  }

  findGroupByViewOperation(path: Path): ASTGroupByViewOperation {
    return this.find(path).asGroupByViewOperation();
  }

  asOrderByViewOperation(): ASTOrderByViewOperation {
    if (this instanceof ASTOrderByViewOperation) return this;
    throw new Error('Not an ASTOrderByViewOperation');
  }

  findOrderByViewOperation(path: Path): ASTOrderByViewOperation {
    return this.find(path).asOrderByViewOperation();
  }

  asGroupByItemList(): ASTGroupByItemList {
    if (this instanceof ASTGroupByItemList) return this;
    throw new Error('Not an ASTGroupByItemList');
  }

  findGroupByItemList(path: Path): ASTGroupByItemList {
    return this.find(path).asGroupByItemList();
  }

  asOrderByItemList(): ASTOrderByItemList {
    if (this instanceof ASTOrderByItemList) return this;
    throw new Error('Not an ASTOrderByItemList');
  }

  findOrderByItemList(path: Path): ASTOrderByItemList {
    return this.find(path).asOrderByItemList();
  }

  asOrderByItem(): ASTOrderByItem {
    if (this instanceof ASTOrderByItem) return this;
    throw new Error('Not an ASTOrderByItem');
  }

  findOrderByItem(path: Path): ASTOrderByItem {
    return this.find(path).asOrderByItem();
  }

  asGroupByItem(): ASTGroupByItem {
    if (this instanceof ASTGroupByItem) return this;
    throw new Error('Not an ASTGroupByItem');
  }

  findGroupByItem(path: Path): ASTGroupByItem {
    return this.find(path).asGroupByItem();
  }

  asField(): ASTField {
    if (this instanceof ASTField) return this;
    throw new Error('Not an ASTField');
  }

  findField(path: Path): ASTField {
    return this.find(path).asField();
  }

  asReferenceExpression(): ASTReferenceExpression {
    if (this instanceof ASTReferenceExpression) return this;
    throw new Error('Not an ASTReferenceExpression');
  }

  findReferenceExpression(path: Path): ASTReferenceExpression {
    return this.find(path).asReferenceExpression();
  }

  asTimeTruncationExpression(): ASTTimeTruncationExpression {
    if (this instanceof ASTTimeTruncationExpression) return this;
    throw new Error('Not an ASTTimeTruncationExpression');
  }

  findTimeTruncationExpression(path: Path): ASTTimeTruncationExpression {
    return this.find(path).asTimeTruncationExpression();
  }

  asFilteredFieldExpression(): ASTFilteredFieldExpression {
    if (this instanceof ASTFilteredFieldExpression) return this;
    throw new Error('Not an ASTFilteredFieldExpression');
  }

  findFilteredFieldExpression(path: Path): ASTFilteredFieldExpression {
    return this.find(path).asFilteredFieldExpression();
  }

  asNestViewOperation(): ASTNestViewOperation {
    if (this instanceof ASTNestViewOperation) return this;
    throw new Error('Not an ASTNestViewOperation');
  }

  findNestViewOperation(path: Path): ASTNestViewOperation {
    return this.find(path).asNestViewOperation();
  }

  asNestItemList(): ASTNestItemList {
    if (this instanceof ASTNestItemList) return this;
    throw new Error('Not an ASTNestItemList');
  }

  findNestItemList(path: Path): ASTNestItemList {
    return this.find(path).asNestItemList();
  }

  asNestItem(): ASTNestItem {
    if (this instanceof ASTNestItem) return this;
    throw new Error('Not an ASTNestItem');
  }

  findNestItem(path: Path): ASTNestItem {
    return this.find(path).asNestItem();
  }

  asView(): ASTView {
    if (this instanceof ASTView) return this;
    throw new Error('Not an ASTView');
  }

  findView(path: Path): ASTView {
    return this.find(path).asView();
  }

  asLimitViewOperation(): ASTLimitViewOperation {
    if (this instanceof ASTLimitViewOperation) return this;
    throw new Error('Not an ASTLimitViewOperation');
  }

  findLimitViewOperation(path: Path): ASTLimitViewOperation {
    return this.find(path).asLimitViewOperation();
  }

  get parent() {
    if (this._parent === undefined) {
      throw new Error('This node does not have a parent');
    }
    return this._parent;
  }

  set parent(parent: ASTAny) {
    this._parent = parent;
  }

  static schemaGet(schema: Malloy.Schema, name: string) {
    const parts = name.split('.');
    let current = schema;
    const front = parts.slice(0, -1);
    const last = parts[parts.length - 1];
    for (const part of front) {
      const field = current.fields.find(f => f.name === part);
      if (field === undefined) {
        throw new Error(`${part} not found`);
      }
      if (field.__type !== Malloy.FieldInfoType.Join) {
        throw new Error(`${part} is not a join`);
      }
      current = field.schema;
    }
    const field = current.fields.find(f => f.name === last);
    if (field === undefined) {
      throw new Error(`${last} not found`);
    }
    return field;
  }

  static schemaMerge(a: Malloy.Schema, b: Malloy.Schema): Malloy.Schema {
    // TODO does this need to be smarter
    return {
      fields: [...a.fields, ...b.fields],
    };
  }
}

function isBasic(t: ASTAny | string | number): t is string | number {
  return typeof t === 'string' || typeof t === 'number';
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

  *[Symbol.iterator]() {
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

  index(i: number) {
    return this.children[i];
  }

  add(n: N) {
    this.edit();
    this.children.push(n);
    n.parent = this;
  }

  remove(n: N) {
    const idx = this.children.findIndex(o => o === n);
    if (idx === -1) return this;
    this.edit();
    this.children.splice(idx, 1);
  }

  build(): T[] {
    if (!this.edited) return this.node;
    const ret = this.children.map(c => c.build());
    this.edited = false;
    this.originalChildren = [...this.children];
    this.node = ret;
    return ret;
  }

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

  findIndex(predicate: (n: N) => boolean): number {
    return this.children.findIndex(predicate);
  }

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

  build(): T {
    if (!this.edited) return this.node;
    let ret = this.node;
    for (const key in this.children) {
      const child = this.children[key];
      if (child === undefined) {
        // Child is undefined (means not present and not edited)
      } else if (child === DELETED) {
        ret = {...ret, [key]: undefined};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.children as any)[key] = undefined;
        // this.children[key] = undefined;
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

export class ASTQuery extends ASTObjectNode<
  Malloy.Query,
  {
    pipeline: ASTPipeline;
    source?: Deletable<ASTSourceReference>;
  }
> {
  model: Malloy.ModelInfo;
  constructor(options?: {
    query?: Malloy.Query;
    model?: Malloy.ModelInfo;
    source?:
      | Malloy.ModelEntryValueWithSource
      | Malloy.ModelEntryValueWithQuery
      | Malloy.SourceInfo
      | Malloy.QueryInfo;
  }) {
    const query = options?.query ?? {pipeline: {stages: []}};
    const source = options?.source;
    const model: Malloy.ModelInfo | undefined =
      options?.model ??
      (source && {
        entries: [
          {
            ...source,
            __type:
              '__type' in source
                ? source.__type
                : Malloy.ModelEntryValueType.Source,
          },
        ],
        anonymous_queries: [],
      });
    if (model === undefined) {
      throw new Error('Must provide a model or source');
    }
    super(query, {
      pipeline: new ASTPipeline(query.pipeline),
      source: query.source && new ASTSourceReference(query.source),
    });
    this.model = model;
    if (source) {
      this.setSource(source.name);
    }
  }

  get pipeline() {
    return this.children.pipeline;
  }

  get source() {
    return this.children.source;
  }

  set source(value: Deletable<ASTSourceReference> | undefined) {
    this.edit();
    this.children.source = value;
    if (value) {
      value.parent = this;
    }
  }

  public getOrCreateDefaultSegment(): ASTSegmentRefinement {
    const stages = this.pipeline.stages;
    return stages.getOrCreateDefaultSegment();
  }

  setSource(name: string) {
    this.source = new ASTSourceReference({
      name,
    });
  }

  getQueryInfo(name: string): Malloy.QueryInfo {
    const query = this.model.entries.find(e => e.name === name);
    if (query === undefined) {
      throw new Error(`Query ${name} is not defined in model`);
    }
    if (query.__type !== Malloy.ModelEntryValueType.Query) {
      throw new Error(`Model entry ${name} is not a query`);
    }
    return query;
  }

  toMalloy(): string {
    return Malloy.queryToMalloy(this.build());
  }
}

type RawLiteralValue = number | string | Date | boolean | null;

class ASTReference extends ASTObjectNode<
  Malloy.Reference,
  {
    name: string;
    parameters?: Deletable<ASTParameterValueList>;
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

  findOrCreateParameters() {
    if (
      this.children.parameters !== undefined &&
      this.children.parameters !== DELETED
    )
      return this.children.parameters;
    this.edit();
    const parameters = new ASTParameterValueList([]);
    this.children.parameters = parameters;
    return parameters;
  }

  addParameter(name: string, value: RawLiteralValue) {
    const parameters = this.findOrCreateParameters();
    parameters.add(
      new ASTParameterValue({
        name,
        value: LiteralValueAST.makeLiteral(value),
      })
    );
  }
}

class ASTSourceReference extends ASTReference {
  get query(): ASTQuery {
    return this.parent.asQuery();
  }

  getSourceInfo(): Malloy.SourceInfo {
    const info = this.query.model.entries.find(e => e.name === this.name);
    if (info === undefined) {
      throw new Error('No source info found');
    }
    return info;
  }
}

class ASTParameterValueList extends ASTListNode<
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

  add(value: ASTParameterValue) {
    this.edit();
    this.children.push(value);
  }
}

class ASTParameterValue extends ASTObjectNode<
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
}

type ASTLiteralValue = ASTStringLiteralValue | ASTNumberLiteralValue;
const LiteralValueAST = {
  from(value: Malloy.LiteralValue) {
    switch (value.__type) {
      case Malloy.LiteralValueType.StringLiteral:
        return new ASTStringLiteralValue(value);
      case Malloy.LiteralValueType.NumberLiteral:
        return new ASTNumberLiteralValue(value);
      default:
        throw new Error(`Unsupported literal value type ${value.__type}`);
    }
  },
  makeLiteral(value: RawLiteralValue): Malloy.LiteralValue {
    if (typeof value === 'string') {
      return {
        __type: Malloy.LiteralValueType.StringLiteral,
        string_value: value,
      };
    } else if (typeof value === 'boolean') {
      return {
        __type: Malloy.LiteralValueType.BooleanLiteral,
        boolean_value: value,
      };
    } else if (typeof value === 'number') {
      return {
        __type: Malloy.LiteralValueType.NumberLiteral,
        number_value: value,
      };
    } else if (value === null) {
      return {
        __type: Malloy.LiteralValueType.NullLiteral,
      };
    }
    throw new Error('TODO other literal types');
  },
};

// | DateLiteralValueAST
// | TimestampLiteralValueAST
// | BooleanLiteralValueAST
// | NullLiteralValueAST;

class ASTStringLiteralValue extends ASTObjectNode<
  Malloy.LiteralValueWithStringLiteral,
  {
    __type: Malloy.LiteralValueType.StringLiteral;
    string_value: string;
  }
> {
  readonly type: Malloy.LiteralValueType =
    Malloy.LiteralValueType.StringLiteral;

  constructor(public node: Malloy.LiteralValueWithStringLiteral) {
    super(node, {
      __type: node.__type,
      string_value: node.string_value,
    });
  }
}

class ASTNumberLiteralValue extends ASTObjectNode<
  Malloy.LiteralValueWithNumberLiteral,
  {
    __type: Malloy.LiteralValueType.NumberLiteral;
    number_value: number;
  }
> {
  readonly type: Malloy.LiteralValueType =
    Malloy.LiteralValueType.NumberLiteral;

  constructor(public node: Malloy.LiteralValueWithNumberLiteral) {
    super(node, {
      __type: node.__type,
      number_value: node.number_value,
    });
  }
}

class ASTUnimplemented<T> extends ASTNode<T> {
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

class ASTPipeline extends ASTObjectNode<
  Malloy.Pipeline,
  {
    stages: ASTPipeStageList;
  }
> {
  constructor(public pipeline: Malloy.Pipeline) {
    super(pipeline, {
      stages: new ASTPipeStageList(pipeline.stages),
    });
  }

  get stages() {
    return this.children.stages;
  }

  getSourceInfo(): Malloy.SourceInfo {
    if (this.parent instanceof ASTQuery) {
      const source = this.parent.source;
      if (!source) {
        throw new Error('No source configured');
      }
      return source.getSourceInfo();
    } else if (this.parent instanceof ASTView) {
      // TODO yikes
      return this.parent.nest.list.operation.list.segment.list.stage.list.pipeline.getSourceInfo();
    }
    throw new Error(
      `Invalid parent of ASTPipeline ${this.parent.constructor.name}`
    );
  }

  public getImplicitName(): string | undefined {
    if (this.stages.length !== 1) return undefined;
    if (this.stages.index(0).refinements.length < 1) return undefined;
    const head = this.stages.index(0).refinements.index(0);
    if (head instanceof ASTReferenceRefinement) {
      return head.name;
    }
    return undefined;
  }
}

class ASTPipeStageList extends ASTListNode<Malloy.PipeStage, ASTPipeStage> {
  constructor(stages: Malloy.PipeStage[]) {
    super(
      stages,
      stages.map(p => new ASTPipeStage(p))
    );
  }

  get stages() {
    return this.children;
  }

  get pipeline() {
    return this.parent.asPipeline();
  }

  getOrCreateDefaultSegment() {
    if (this.length === 0) {
      const stage = new ASTPipeStage({
        refinements: [
          {
            __type: Malloy.RefinementType.Segment,
            operations: [],
          },
        ],
      });
      this.add(stage);
      return stage.refinements.index(0) as ASTSegmentRefinement;
    } else {
      const refinements = this.last.refinements;
      if (
        refinements.length === 0 ||
        !(refinements.last instanceof ASTSegmentRefinement)
      ) {
        const segment = new ASTSegmentRefinement({
          __type: Malloy.RefinementType.Segment,
          operations: [],
        });
        refinements.add(segment);
        return segment;
      } else {
        return refinements.last;
      }
    }
  }
}

class ASTPipeStage extends ASTObjectNode<
  Malloy.PipeStage,
  {
    refinements: ASTRefinementList;
  }
> {
  constructor(public stage: Malloy.PipeStage) {
    super(stage, {
      refinements: new ASTRefinementList(stage.refinements),
    });
  }

  get refinements() {
    return this.children.refinements;
  }

  get list() {
    return this.parent.asPipeStageList();
  }

  get index() {
    const index = this.list.indexOf(this);
    if (index === -1) {
      throw new Error('This element is not contained in its parent');
    }
    return index;
  }

  isQueryHeadedStage(): boolean {
    const pipelineContainer = this.list.pipeline.parent;
    return (
      this.index === 0 &&
      pipelineContainer instanceof ASTQuery &&
      pipelineContainer.source === undefined &&
      this.refinements.length > 0 &&
      this.refinements.index(0).type === Malloy.RefinementType.Reference
    );
  }

  getInputSchema(): Malloy.Schema {
    if (this.isQueryHeadedStage()) {
      const refinement = this.refinements.index(0).asReferenceRefinement();
      const query = this.list.pipeline.parent.asQuery();
      const queryInfo = query.getQueryInfo(refinement.name);
      return queryInfo.schema;
    } else if (this.index === 0) {
      return this.list.pipeline.getSourceInfo().schema;
    }
    return this.list.index(this.index - 1).getOutputSchema();
  }

  getOutputSchema(): Malloy.Schema {
    throw new Error('Not implemented');
  }
}

class ASTRefinementList extends ASTListNode<Malloy.Refinement, ASTRefinement> {
  constructor(refinements: Malloy.Refinement[]) {
    super(
      refinements,
      refinements.map(p => ASTRefinement.from(p))
    );
  }

  // TODO weird that it's stage.refinements.refinements?
  get refinements() {
    return this.children;
  }

  get stage() {
    return this.parent.asPipeStage();
  }
}

type ASTRefinement = ASTReferenceRefinement | ASTSegmentRefinement;
const ASTRefinement = {
  from(value: Malloy.Refinement): ASTRefinement {
    switch (value.__type) {
      case Malloy.RefinementType.Reference:
        return new ASTReferenceRefinement(value);
      case Malloy.RefinementType.Segment:
        return new ASTSegmentRefinement(value);
    }
  },
};

abstract class ASTRefinementBase<
  T,
  Children extends ASTChildren<T>,
> extends ASTObjectNode<T, Children> {
  get list() {
    return this.parent.asRefinementList();
  }

  get index() {
    if (
      !(
        this instanceof ASTReferenceRefinement ||
        this instanceof ASTSegmentRefinement
      )
    ) {
      throw new Error('Invalid subclass of ASTRefinementBase');
    }
    const index = this.list.indexOf(this);
    if (index === -1) {
      throw new Error('ASTRefinement is not contained in parent list');
    }
    return index;
  }

  getInputSchema() {
    return this.list.stage.getInputSchema();
  }

  getOutputSchema() {
    const schema: Malloy.Schema =
      this.index === 0
        ? {fields: []}
        : this.list.index(this.index - 1).getOutputSchema();
    return ASTNode.schemaMerge(schema, this.getRefinementSchema());
  }

  abstract getRefinementSchema(): Malloy.Schema;
}

// TODO sorta annoying that this is a different class than the sourceRefimenent
// class, because it is part of a union....
// I guess maybe I could make an abstract class that both extend???
class ASTReferenceRefinement extends ASTRefinementBase<
  Malloy.RefinementWithReference,
  {
    __type: Malloy.RefinementType.Reference;
    name: string;
    parameters?: Deletable<ASTParameterValueList>;
  }
> {
  readonly type: Malloy.RefinementType = Malloy.RefinementType.Reference;

  constructor(public node: Malloy.RefinementWithReference) {
    super(node, {
      __type: node.__type,
      name: node.name,
      parameters: node.parameters && new ASTParameterValueList(node.parameters),
    });
  }

  get name() {
    return this.children.name;
  }

  getRefinementSchema(): Malloy.Schema {
    const inputSchema = this.getInputSchema();
    const field = ASTQuery.schemaGet(inputSchema, this.name);
    if (
      field.__type === Malloy.FieldInfoType.Dimension ||
      field.__type === Malloy.FieldInfoType.Measure
    ) {
      throw new Error('Scalar lenses not yet supported');
    }
    if (field.__type !== Malloy.FieldInfoType.View) {
      throw new Error('Field type not supported in refinement');
    }
    return field.schema;
  }
}

class ASTSegmentRefinement extends ASTRefinementBase<
  Malloy.RefinementWithSegment,
  {
    __type: Malloy.RefinementType.Segment;
    operations: ASTViewOperationList;
  }
> {
  readonly type: Malloy.RefinementType = Malloy.RefinementType.Segment;

  constructor(public node: Malloy.RefinementWithSegment) {
    super(node, {
      __type: node.__type,
      operations: new ASTViewOperationList(node.operations),
    });
  }

  get operations() {
    return this.children.operations;
  }

  get list() {
    return this.parent.asRefinementList();
  }

  addOrderBy(name: string, direction?: Malloy.OrderByDirection) {
    // Ensure output schema has a field with this name
    const outputSchema = this.getOutputSchema();
    try {
      ASTNode.schemaGet(outputSchema, name);
    } catch {
      throw new Error(`No such field ${name} in stage output`);
    }
    // first see if there is already an order by for this field
    for (const operation of this.operations) {
      if (operation instanceof ASTOrderByViewOperation) {
        for (const item of operation.items) {
          if (item.name === name) {
            item.direction = direction;
            return;
          }
        }
      }
    }
    const orderByItem = {field: {name}, direction};
    // now try to add to an existing order by
    for (const operation of this.operations) {
      if (operation instanceof ASTOrderByViewOperation) {
        operation.items.add(new ASTOrderByItem(orderByItem));
        return;
      }
    }
    // add a new order by operation
    this.operations.add(
      new ASTOrderByViewOperation({
        __type: Malloy.ViewOperationType.OrderBy,
        items: [orderByItem],
      })
    );
  }

  addEmptyNest(name: string) {
    // TODO validate name
    // TODO decide whether this by default groups into existing nest operation?
    const nest = new ASTNestViewOperation({
      __type: Malloy.ViewOperationType.Nest,
      items: [
        {
          name,
          view: {
            pipeline: {
              stages: [
                {
                  refinements: [
                    {__type: Malloy.RefinementType.Segment, operations: []},
                  ],
                },
              ],
            },
          },
        },
      ],
    });
    this.operations.add(nest);
    return nest.items.index(0);
  }

  private firstIndexOfOperationType(type: Malloy.ViewOperationType) {
    return this.operations.findIndex(o => o.type === type);
  }

  private DEFAULT_INSERTION_ORDER: Malloy.ViewOperationType[] = [
    Malloy.ViewOperationType.Where,
    Malloy.ViewOperationType.GroupBy,
    Malloy.ViewOperationType.Aggregate,
    Malloy.ViewOperationType.Nest,
    Malloy.ViewOperationType.OrderBy,
  ];

  private findInsertionPoint(
    type: Malloy.ViewOperationType
  ): {addTo: number} | {addAt: number} {
    const firstOfType = this.firstIndexOfOperationType(type);
    if (firstOfType > -1) return {addTo: firstOfType};
    const indexInOrder = this.DEFAULT_INSERTION_ORDER.indexOf(type);
    if (indexInOrder === -1) {
      throw new Error(
        `Operation ${type} is not supported for \`findInsertionPoint\``
      );
    }
    const laterOperations = this.DEFAULT_INSERTION_ORDER.slice(
      indexInOrder + 1
    );
    for (const laterType of laterOperations) {
      const firstOfType = this.firstIndexOfOperationType(laterType);
      if (firstOfType > -1) {
        return {addAt: firstOfType};
      }
    }
    return {addAt: this.operations.length};
  }

  public getGroupBy(name: string) {
    for (const operation of this.operations) {
      if (operation instanceof ASTGroupByViewOperation) {
        for (const item of operation.items) {
          if (item.name === name) {
            return item;
          }
        }
      }
    }
  }

  public removeGroupBy(name: string) {
    this.getGroupBy(name)?.delete();
    return this;
  }

  public addGroupBy(name: string) {
    const schema = this.getInputSchema();
    const fieldInfo = ASTNode.schemaGet(schema, name);
    if (fieldInfo === undefined) {
      throw new Error(`No such field ${name}`);
    }
    if (fieldInfo.__type !== Malloy.FieldInfoType.Dimension) {
      throw new Error(`Cannot group by non dimension ${name}`);
    }
    const groupByItem: Malloy.GroupByItem = {
      field: {
        expression: {
          __type: Malloy.ExpressionType.Reference,
          name,
        },
      },
    };
    const whereToInsert = this.findInsertionPoint(
      Malloy.ViewOperationType.GroupBy
    );
    if ('addTo' in whereToInsert) {
      const operation = this.operations.index(whereToInsert.addTo);
      if (!(operation instanceof ASTGroupByViewOperation)) {
        throw new Error('Invalid');
      }
      operation.items.add(new ASTGroupByItem(groupByItem));
      return this;
    } else {
      const operation: Malloy.ViewOperation = {
        __type: Malloy.ViewOperationType.GroupBy,
        items: [groupByItem],
      };
      this.operations.add(new ASTGroupByViewOperation(operation));
      return this;
    }
  }

  getRefinementSchema(): Malloy.Schema {
    const fields: Malloy.FieldInfo[] = [];
    for (const operation of this.operations) {
      if (
        operation instanceof ASTGroupByViewOperation //||
        // operation instanceof ASTAggregateOperation ||
        // operation instanceof ASTNestOperation
      ) {
        fields.push(...operation.getFieldInfos());
      }
    }
    return {fields};
  }

  public setLimit(limit: number) {
    const limitOp: ASTLimitViewOperation | undefined = [
      ...this.operations,
    ].find(ASTViewOperation.isLimit);
    if (limitOp) {
      limitOp.limit = limit;
    } else {
      this.operations.add(
        new ASTLimitViewOperation({
          __type: Malloy.ViewOperationType.Limit,
          limit,
        })
      );
    }
  }
}

class ASTViewOperationList extends ASTListNode<
  Malloy.ViewOperation,
  ASTViewOperation
> {
  constructor(operations: Malloy.ViewOperation[]) {
    super(
      operations,
      operations.map(p => ASTViewOperation.from(p))
    );
  }

  get operations() {
    return this.children;
  }

  get segment() {
    return this.parent.asSegmentRefinement();
  }
}

type ASTViewOperation =
  | ASTGroupByViewOperation
  | ASTOrderByViewOperation
  | ASTNestViewOperation
  | ASTLimitViewOperation;
// TODO others
const ASTViewOperation = {
  from(value: Malloy.ViewOperation): ASTViewOperation {
    switch (value.__type) {
      case Malloy.ViewOperationType.GroupBy:
        return new ASTGroupByViewOperation(value);
      case Malloy.ViewOperationType.OrderBy:
        return new ASTOrderByViewOperation(value);
      case Malloy.ViewOperationType.Nest:
        return new ASTNestViewOperation(value);
      case Malloy.ViewOperationType.Limit:
        return new ASTLimitViewOperation(value);
      default:
        throw new Error(
          `TODO Unimplemented ViewOperation type ${value.__type}`
        );
    }
  },
  isLimit(x: ASTViewOperation): x is ASTLimitViewOperation {
    return x instanceof ASTLimitViewOperation;
  },
};

class ASTGroupByViewOperation extends ASTObjectNode<
  Malloy.ViewOperationWithGroupBy,
  {
    __type: Malloy.ViewOperationType.GroupBy;
    items: ASTGroupByItemList;
    annotations?: Deletable<ASTUnimplemented<Malloy.TagOrAnnotation[]>>;
  }
> {
  readonly type: Malloy.ViewOperationType = Malloy.ViewOperationType.GroupBy;

  get items() {
    return this.children.items;
  }

  get annotations() {
    return this.children.annotations;
  }

  constructor(public node: Malloy.ViewOperationWithGroupBy) {
    super(node, {
      __type: node.__type,
      items: new ASTGroupByItemList(node.items),
      annotations: node.annotations && new ASTUnimplemented(node.annotations),
      // annotations: node.annotations && new TagOrAnnotationListAST(),
    });
  }

  drain() {
    for (const item of this.items) {
      item.delete();
    }
  }

  get list() {
    return this.parent.asViewOperationList();
  }

  delete() {
    this.drain();
    this.list.remove(this);
  }

  getFieldInfos() {
    return [...this.items].map(i => i.getFieldInfo());
  }
}

class ASTOrderByViewOperation extends ASTObjectNode<
  Malloy.ViewOperationWithOrderBy,
  {
    __type: Malloy.ViewOperationType.OrderBy;
    items: ASTOrderByItemList;
  }
> {
  readonly type: Malloy.ViewOperationType = Malloy.ViewOperationType.OrderBy;

  constructor(public node: Malloy.ViewOperationWithOrderBy) {
    super(node, {
      __type: node.__type,
      items: new ASTOrderByItemList(node.items),
    });
  }

  get items() {
    return this.children.items;
  }

  drain() {
    for (const item of this.items) {
      item.delete();
    }
  }

  get list() {
    return this.parent.asViewOperationList();
  }

  delete() {
    this.drain();
    this.list.remove(this);
  }
}

class ASTGroupByItemList extends ASTListNode<
  Malloy.GroupByItem,
  ASTGroupByItem
> {
  constructor(items: Malloy.GroupByItem[]) {
    super(
      items,
      items.map(p => new ASTGroupByItem(p))
    );
  }

  get items() {
    return this.children;
  }

  get operation() {
    return this.parent.asGroupByViewOperation();
  }
}

class ASTOrderByItemList extends ASTListNode<
  Malloy.OrderByItem,
  ASTOrderByItem
> {
  constructor(items: Malloy.OrderByItem[]) {
    super(
      items,
      items.map(p => new ASTOrderByItem(p))
    );
  }

  get items() {
    return this.children;
  }

  get operation() {
    return this.parent.asOrderByViewOperation();
  }
}

class ASTOrderByItem extends ASTObjectNode<
  Malloy.OrderByItem,
  {
    field: ASTReference;
    direction?: Malloy.OrderByDirection;
  }
> {
  constructor(public node: Malloy.OrderByItem) {
    super(node, {
      field: new ASTReference(node.field),
      direction: node.direction,
    });
  }

  get field() {
    return this.children.field;
  }

  get name() {
    return this.field.name;
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
    return this.parent.asOrderByItemList();
  }

  delete() {
    const list = this.list;
    list.remove(this);
    if (list.length === 0) {
      const operation = list.operation;
      operation.delete();
      // TODO somehow signal that there was a side effect?
    }
  }
}

class ASTGroupByItem extends ASTObjectNode<
  Malloy.GroupByItem,
  {
    name?: string;
    field: ASTField;
  }
> {
  constructor(public node: Malloy.GroupByItem) {
    super(node, {
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

  get list() {
    return this.parent.asGroupByItemList();
  }

  delete() {
    this.list.remove(this);
    if (this.list.length === 0) {
      const operation = this.list.operation;
      operation.delete();
      // TODO somehow signal that there was a side effect?
    }
    const operations = this.list.operation.list;
    for (const operation of operations) {
      if (operation instanceof ASTOrderByViewOperation) {
        for (const item of operation.items) {
          if (item.name === this.name) {
            item.delete();
          }
        }
      }
    }
    return this;
  }

  getFieldInfo(): Malloy.FieldInfo {
    return {
      __type: Malloy.FieldInfoType.Dimension,
      name: this.field.name,
      type: this.field.type,
    };
  }
}

class ASTField extends ASTObjectNode<
  Malloy.Field,
  {
    expression: ASTExpression;
    annotations?: Deletable<ASTUnimplemented<Malloy.TagOrAnnotation[]>>;
  }
> {
  constructor(public node: Malloy.Field) {
    super(node, {
      expression: ASTExpression.from(node.expression),
      annotations: node.annotations && new ASTUnimplemented(node.annotations),
    });
  }

  get expression() {
    return this.children.expression;
  }

  get name() {
    return this.expression.name;
  }

  get type() {
    return this.expression.fieldType;
  }

  get refinement() {
    const groupByOrAggregateItem = this.parent;
    const groupByOrAggregateItemList = groupByOrAggregateItem.parent;
    const groupByOrAggregate = groupByOrAggregateItemList.parent;
    const operationList = groupByOrAggregate.parent;
    return operationList.parent.asSegmentRefinement();
  }
}

type ASTExpression =
  | ASTReferenceExpression
  | ASTFilteredFieldExpression
  | ASTTimeTruncationExpression;
const ASTExpression = {
  from(value: Malloy.Expression): ASTExpression {
    switch (value.__type) {
      case Malloy.ExpressionType.Reference:
        return new ASTReferenceExpression(value);
      case Malloy.ExpressionType.FilteredField:
        return new ASTFilteredFieldExpression(value);
      case Malloy.ExpressionType.TimeTruncation:
        return new ASTTimeTruncationExpression(value);
    }
  },
};

class ASTReferenceExpression extends ASTObjectNode<
  Malloy.ExpressionWithReference,
  {
    __type: Malloy.ExpressionType.Reference;
    name: string;
    parameters?: Deletable<ASTParameterValueList>;
  }
> {
  readonly type: Malloy.ExpressionType = Malloy.ExpressionType.Reference;

  constructor(public node: Malloy.ExpressionWithReference) {
    super(node, {
      __type: node.__type,
      name: node.name,
      parameters: node.parameters && new ASTParameterValueList(node.parameters),
    });
  }

  get name() {
    return this.children.name;
  }

  get field() {
    return this.parent.asField();
  }

  get fieldType() {
    const schema = this.field.refinement.getInputSchema();
    const def = ASTNode.schemaGet(schema, this.name);
    if (
      def.__type === Malloy.FieldInfoType.Dimension ||
      def.__type === Malloy.FieldInfoType.Measure
    ) {
      return def.type;
    }
    throw new Error('Invalid field reference');
  }
}

class ASTTimeTruncationExpression extends ASTObjectNode<
  Malloy.ExpressionWithTimeTruncation,
  {
    __type: Malloy.ExpressionType.TimeTruncation;
    reference: ASTReference;
    truncation: Malloy.TimestampTimeframe;
  }
> {
  readonly type: Malloy.ExpressionType = Malloy.ExpressionType.TimeTruncation;

  constructor(public node: Malloy.ExpressionWithTimeTruncation) {
    super(node, {
      __type: node.__type,
      reference: new ASTReference(node.reference),
      truncation: node.truncation,
    });
  }

  get reference() {
    return this.children.reference;
  }

  get truncation() {
    return this.children.truncation;
  }

  get name() {
    return this.reference.name;
  }

  get field() {
    return this.parent.asField();
  }

  get fieldType() {
    const schema = this.field.refinement.getInputSchema();
    const def = ASTNode.schemaGet(schema, this.name);
    if (
      def.__type !== Malloy.FieldInfoType.Dimension &&
      def.__type !== Malloy.FieldInfoType.Measure
    ) {
      throw new Error('Invalid field reference');
    }
    if (def.type.__type === Malloy.AtomicTypeType.DateType) {
      return {
        ...def.type,
        timeframe: timestampTimeframeToDateTimeframe(this.truncation),
      };
    } else if (def.type.__type === Malloy.AtomicTypeType.TimestampType) {
      return {...def.type, timeframe: this.truncation};
    }
    throw new Error('This type of field cannot have a time truncation');
  }
}

class ASTFilteredFieldExpression extends ASTObjectNode<
  Malloy.ExpressionWithFilteredField,
  {
    __type: Malloy.ExpressionType.FilteredField;
    reference: ASTReference;
    filter: ASTUnimplemented<Malloy.WhereItemWithFilterString>;
  }
> {
  readonly type: Malloy.ExpressionType = Malloy.ExpressionType.FilteredField;

  constructor(public node: Malloy.ExpressionWithFilteredField) {
    super(node, {
      __type: node.__type,
      reference: new ASTReference(node.reference),
      filter: new ASTUnimplemented(node.filter),
    });
  }

  get reference() {
    return this.children.reference;
  }

  get name() {
    return this.reference.name;
  }

  get field() {
    return this.parent.asField();
  }

  get fieldType() {
    const schema = this.field.refinement.getInputSchema();
    const def = ASTNode.schemaGet(schema, this.name);
    if (
      def.__type === Malloy.FieldInfoType.Dimension ||
      def.__type === Malloy.FieldInfoType.Measure
    ) {
      return def.type;
    }
    throw new Error('Invalid field reference');
  }
}

function timestampTimeframeToDateTimeframe(
  timeframe: Malloy.TimestampTimeframe
): Malloy.DateTimeframe {
  switch (timeframe) {
    case Malloy.TimestampTimeframe.DAY:
      return Malloy.DateTimeframe.DAY;
    case Malloy.TimestampTimeframe.WEEK:
      return Malloy.DateTimeframe.WEEK;
    case Malloy.TimestampTimeframe.MONTH:
      return Malloy.DateTimeframe.MONTH;
    case Malloy.TimestampTimeframe.YEAR:
      return Malloy.DateTimeframe.YEAR;
    case Malloy.TimestampTimeframe.QUARTER:
      return Malloy.DateTimeframe.QUARTER;
    default:
      throw new Error('Invalid date timeframe');
  }
}

class ASTNestViewOperation extends ASTObjectNode<
  Malloy.ViewOperationWithNest,
  {
    __type: Malloy.ViewOperationType.Nest;
    items: ASTNestItemList;
    annotations?: Deletable<ASTUnimplemented<Malloy.TagOrAnnotation[]>>;
  }
> {
  readonly type: Malloy.ViewOperationType = Malloy.ViewOperationType.Nest;

  get items() {
    return this.children.items;
  }

  get annotations() {
    return this.children.annotations;
  }

  constructor(public node: Malloy.ViewOperationWithNest) {
    super(node, {
      __type: node.__type,
      items: new ASTNestItemList(node.items),
      annotations: node.annotations && new ASTUnimplemented(node.annotations),
      // annotations: node.annotations && new TagOrAnnotationListAST(),
    });
  }

  drain() {
    for (const item of this.items) {
      item.delete();
    }
  }

  get list() {
    return this.parent.asViewOperationList();
  }

  delete() {
    this.drain();
    this.list.remove(this);
  }
}

class ASTNestItemList extends ASTListNode<Malloy.NestItem, ASTNestItem> {
  constructor(items: Malloy.NestItem[]) {
    super(
      items,
      items.map(p => new ASTNestItem(p))
    );
  }

  get items() {
    return this.children;
  }

  get operation() {
    return this.parent.asNestViewOperation();
  }
}

class ASTNestItem extends ASTObjectNode<
  Malloy.NestItem,
  {
    name?: string;
    view: ASTView;
  }
> {
  constructor(public node: Malloy.NestItem) {
    super(node, {
      name: node.name,
      view: new ASTView(node.view),
    });
  }

  get view() {
    return this.children.view;
  }

  get name() {
    return this.children.name ?? this.view.name;
  }

  get list() {
    return this.parent.asNestItemList();
  }

  delete() {
    this.list.remove(this);
  }
}

class ASTView extends ASTObjectNode<
  Malloy.View,
  {
    pipeline: ASTPipeline;
    annotations?: Deletable<ASTUnimplemented<Malloy.TagOrAnnotation[]>>;
  }
> {
  constructor(public node: Malloy.View) {
    super(node, {
      pipeline: new ASTPipeline(node.pipeline),
      annotations: node.annotations && new ASTUnimplemented(node.annotations),
    });
  }

  get pipeline() {
    return this.children.pipeline;
  }

  get name() {
    return this.pipeline.getImplicitName();
  }

  public getOrCreateDefaultSegment(): ASTSegmentRefinement {
    const stages = this.pipeline.stages;
    return stages.getOrCreateDefaultSegment();
  }

  get nest() {
    return this.parent.asNestItem();
  }
}

class ASTLimitViewOperation extends ASTObjectNode<
  Malloy.ViewOperationWithLimit,
  {
    __type: Malloy.ViewOperationType.Limit;
    limit: number;
  }
> {
  readonly type: Malloy.ViewOperationType = Malloy.ViewOperationType.Limit;

  get limit() {
    return this.children.limit;
  }

  set limit(limit: number) {
    this.edit();
    this.children.limit = limit;
  }

  constructor(public node: Malloy.ViewOperationWithLimit) {
    super(node, {
      __type: node.__type,
      limit: node.limit,
    });
  }

  get list() {
    return this.parent.asViewOperationList();
  }

  delete() {
    this.list.remove(this);
  }
}
