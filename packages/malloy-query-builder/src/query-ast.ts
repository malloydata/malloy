import * as Malloy from '@malloydata/malloy-interfaces';

type PathSegment = number | string;
type Path = PathSegment[];

type ASTAny = ASTNode<unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeConstructor<T extends ASTAny> = new (...args: any[]) => T;

const DELETED = null;

// type LiteralOrNode<T> = T extends string
//   ? string
//   : T extends number
//   ? number
//   : undefined extends T
//   ? NodeTypeFor<T> | null | undefined
//   : NodeTypeFor<T>;

type NonOptionalASTNode<T> = T extends undefined ? never : ASTNode<T>;

type Deletable<T> = T | typeof DELETED;

type LiteralOrNode<T> = T extends string
  ? string
  : T extends number
  ? number
  : undefined extends T
  ? NonOptionalASTNode<T> | null | undefined
  : ASTNode<T>;

// type A = LiteralOrNode<Malloy.Reference | undefined>;

// type X = LiteralOrNode<Malloy.Reference | undefined>;

// type NodeTypeFor<T> = undefined extends T
//   ? never
//   : T extends Malloy.Query
//   ? QueryAST
//   : T extends Malloy.Pipeline
//   ? PipelineAST
//   : T extends Malloy.ParameterValue
//   ? ParameterValueAST
//   : T extends Malloy.Refinement
//   ? RefinementAST
//   : T extends Malloy.Reference
//   ? ReferenceAST
//   : T extends Malloy.ParameterValue[]
//   ? ParameterValueListAST
//   : T extends Malloy.PipeStage
//   ? PipeStageAST
//   : T extends Malloy.PipeStage[]
//   ? PipeStageListAST
//   : T extends Malloy.Refinement[]
//   ? RefinementListAST
//   : ASTNode<T>;

// type X = NodeTypeFor<Malloy.ParameterValue>;
// type Y = NodeTypeFor<Malloy.Reference>;
// type Z = NodeTypeFor<Malloy.Refinement>;

abstract class ASTNode<T> {
  edited = false;

  public _parent: ASTAny | undefined;

  abstract build(): T;

  edit() {
    this.edited = true;
    if (this._parent) this._parent.edit();
    return this;
  }

  abstract find<T extends ASTAny>(Class: NodeConstructor<T>, path: Path): T;

  as<T extends ASTAny>(Class: NodeConstructor<T>): T {
    if (this instanceof Class) {
      return this;
    } else {
      throw new Error(`Path does not refer to a ${Class.name}`);
    }
  }

  findReference(path: Path): ASTReference {
    return this.find(ASTReference, path);
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

  find<T extends ASTAny>(Class: NodeConstructor<T>, path: Path): T {
    if (path.length === 0) {
      return this.as(Class);
    }
    const [head, ...rest] = path;
    if (typeof head !== 'number') {
      throw new Error(
        `${this.constructor.name} is a ASTListNode and thus cannot contain a ${head}`
      );
    }
    const child = this.children[head];
    return child.find(Class, rest);
  }

  findIndex(predicate: (n: N) => boolean): number {
    return this.children.findIndex(predicate);
  }
}

abstract class ASTObjectNode<
  T,
  Children extends {
    [Key in keyof T]: LiteralOrNode<T[Key]>;
  },
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

  find<N extends ASTAny>(Class: NodeConstructor<N>, path: Path): N {
    if (path.length === 0) {
      return this.as(Class);
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
    return child.find(Class, rest);
  }
}

export class ASTQuery extends ASTObjectNode<
  Malloy.Query,
  {
    pipeline: ASTPipeline;
    source?: Deletable<ASTReference>;
  }
> {
  constructor(public query: Malloy.Query) {
    super(query, {
      pipeline: new ASTPipeline(query.pipeline),
      source: query.source && new ASTReference(query.source),
    });
  }

  get pipeline() {
    return this.children.pipeline;
  }

  get source() {
    return this.children.source;
  }

  public getOrCreateDefaultSegment(): ASTSegmentRefinement {
    const stages = this.pipeline.stages;
    if (stages.length === 0) {
      const stage = new ASTPipeStage({
        refinements: [
          {
            __type: Malloy.RefinementType.Segment,
            operations: [],
          },
        ],
      }).edit();
      stages.add(stage);
      return stage.refinements.index(0) as ASTSegmentRefinement;
    } else {
      const refinements = stages.last.refinements;
      if (
        refinements.length === 0 ||
        !(refinements.last instanceof ASTSegmentRefinement)
      ) {
        const segment = new ASTSegmentRefinement({
          __type: Malloy.RefinementType.Segment,
          operations: [],
        }).edit();
        refinements.add(segment);
        return segment;
      } else {
        return refinements.last;
      }
    }
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

// TODO sorta annoying that this is a different class than the sourceRefimenent
// class, because it is part of a union....
// I guess maybe I could make an abstract class that both extend???
class ASTReferenceRefinement extends ASTObjectNode<
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
}

class ASTSegmentRefinement extends ASTObjectNode<
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

  addOrderBy(name: string, direction?: Malloy.OrderByDirection) {
    // todo ensure there is a group by with this name
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
        operation.items.add(new ASTOrderByItem(orderByItem).edit());
        return;
      }
    }
    // add a new order by operation
    this.operations.add(
      new ASTOrderByViewOperation({
        __type: Malloy.ViewOperationType.OrderBy,
        items: [orderByItem],
      }).edit()
    );
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
      operation.items.add(new ASTGroupByItem(groupByItem).edit());
      return this;
    } else {
      const operation: Malloy.ViewOperation = {
        __type: Malloy.ViewOperationType.GroupBy,
        items: [groupByItem],
      };
      this.operations.add(new ASTGroupByViewOperation(operation).edit());
      return this;
    }
  }
}

class ASTViewOperationList extends ASTListNode<
  Malloy.ViewOperation,
  ASTViewOperation
> {
  _parent: ASTSegmentRefinement | undefined;
  constructor(operations: Malloy.ViewOperation[]) {
    super(
      operations,
      operations.map(p => ASTViewOperation.from(p))
    );
  }

  get operations() {
    return this.children;
  }
}

type ASTViewOperation = ASTGroupByViewOperation | ASTOrderByViewOperation;
// TODO others
const ASTViewOperation = {
  from(value: Malloy.ViewOperation): ASTViewOperation {
    switch (value.__type) {
      case Malloy.ViewOperationType.GroupBy:
        return new ASTGroupByViewOperation(value);
      case Malloy.ViewOperationType.OrderBy:
        return new ASTOrderByViewOperation(value);
      default:
        throw new Error(
          `TODO Unimplemented ViewOperation type ${value.__type}`
        );
    }
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
    return this.parent.as(ASTViewOperationList);
  }

  delete() {
    this.drain();
    this.list.remove(this);
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
    return this.parent.as(ASTViewOperationList);
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
    return this.parent.as(ASTGroupByViewOperation);
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
    return this.parent.as(ASTOrderByViewOperation);
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
    return this.parent.as(ASTOrderByItemList);
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
    return this.parent.as(ASTGroupByItemList);
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

  get name() {
    return this.reference.name;
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
}
