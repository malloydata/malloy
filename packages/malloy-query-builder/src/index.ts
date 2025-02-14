// eslint-disable-next-line node/no-extraneous-import
import * as Malloy from '@malloydata/malloy-interfaces';

// export type MalloyQueryBuilderPath = (string | number)[];

// eslint-disable-next-line @typescript-eslint/no-empty-interface
// interface MalloyObj {}

// type Update<T> = (item: T) => Malloy.Query;

// export class QueryBuilder {
//   public query: Malloy.Query = {
//     pipeline: {stages: []},
//   };

//   constructor(public sourceInfo?: Malloy.SourceInfo) {
//     if (sourceInfo) {
//       this.query.source = {name: sourceInfo.name};
//     }
//   }

//   /**
//    * Reconstructs the query along the given path, returning the item found at that path
//    * and an update function, which will return a reconstructed object with that item replaced
//    */
//   // TODO make this more "safe" by walking the tree in a type-safe way?
//   private getPath<T extends MalloyObj>(
//     path: MalloyQueryBuilderPath
//   ): {
//     item: T;
//     update: UpdateFunction<T>;
//   } {
//     const query = {...this.query};
//     let item: MalloyObj = query;
//     let update = (i: MalloyObj) => {
//       item[path[0]] = i;
//       return query;
//     };
//     for (const pathSegment of path) {
//       const current = item;
//       const next = item[pathSegment];
//       update = (i: MalloyObj) => {
//         current[pathSegment] = i;
//         return query;
//       };
//       const nextClone = Array.isArray(next) ? [...next] : {...next};
//       item[pathSegment] = nextClone;
//       item = nextClone;
//     }
//     return {item: item as T, update};
//   }

//   public editSegment(path: MalloyQueryBuilderPath): SegmentEditor {
//     const {update, item: segment} = this.getPath(path);
//     return new SegmentEditor(update, segment as Malloy.Segment);
//   }

//   public editSource(): SourceEditor {
//     const {update, item: segment} = this.getPath(['source']);
//     return new SourceEditor(update, segment as Malloy.Reference);
//   }

//   /**
//    * Returns a SegmentBuilder which edits the "default segment" of the query;
//    * That is, the last stage's last refinement or segment.
//    */
//   public editDefaultSegment(): SegmentEditor {
//     const stages = this.query.pipeline.stages;
//     if (stages.length === 0) {
//       // Need to add a stage with an empty segment
//       const {update: updateStages, item: stages} = this.getPath<
//         Malloy.Query['pipeline']['stages']
//       >(['pipeline', 'stages']);
//       const segment: Malloy.Segment = {operations: []};
//       return new SegmentEditor((segment: Malloy.Segment) => {
//         return updateStages([
//           ...stages,
//           {
//             refinements: [
//               {
//                 __type: Malloy.RefinementType.Segment,
//                 ...segment,
//               },
//             ],
//           },
//         ]);
//       }, segment);
//     } else {
//       const refinementsPath = [
//         'pipeline',
//         'stages',
//         stages.length - 1,
//         'refinements',
//       ];
//       const {update: updateRefinements, item: refinements} =
//         this.getPath<Malloy.Query['pipeline']['stages'][0]['refinements']>(
//           refinementsPath
//         );
//       const segment: Malloy.Segment = {operations: []};
//       if (
//         refinements.length === 0 ||
//         refinements[refinements.length - 1].__type !==
//           Malloy.RefinementType.Segment
//       ) {
//         return new SegmentEditor((segment: Malloy.Segment) => {
//           return updateRefinements([
//             {
//               __type: Malloy.RefinementType.Segment,
//               ...segment,
//             },
//           ]);
//         }, segment);
//       } else {
//         return this.editSegment([...refinementsPath, refinements.length - 1]);
//       }
//     }
//   }

//   public getQuery(): Malloy.Query {
//     return this.query;
//   }
// }

// class SegmentEditor {
//   constructor(
//     public readonly update: UpdateFunction<Malloy.Segment>,
//     public readonly segment: Malloy.Segment
//   ) {}

//   private firstIndexOfOperationType(type: Malloy.ViewOperationType) {
//     return this.segment.operations.findIndex(o => o.__type === type);
//   }

//   private DEFAULT_INSERTION_ORDER: Malloy.ViewOperationType[] = [
//     Malloy.ViewOperationType.Where,
//     Malloy.ViewOperationType.GroupBy,
//     Malloy.ViewOperationType.Aggregate,
//     Malloy.ViewOperationType.Nest,
//     Malloy.ViewOperationType.OrderBy,
//   ];

//   private findInsertionPoint(
//     type: Malloy.ViewOperationType
//   ): {addTo: number} | {addAt: number} {
//     const firstOfType = this.firstIndexOfOperationType(type);
//     if (firstOfType > -1) return {addTo: firstOfType};
//     const indexInOrder = this.DEFAULT_INSERTION_ORDER.indexOf(type);
//     if (indexInOrder === -1) {
//       throw new Error(
//         `Operation ${type} is not supported for \`findInsertionPoint\``
//       );
//     }
//     const laterOperations = this.DEFAULT_INSERTION_ORDER.slice(
//       indexInOrder + 1
//     );
//     for (const laterType of laterOperations) {
//       const firstOfType = this.firstIndexOfOperationType(laterType);
//       if (firstOfType > -1) {
//         return {addAt: firstOfType};
//       }
//     }
//     return {addAt: this.segment.operations.length};
//   }

//   public getLimit(): number | undefined {
//     const limit = this.segment.operations.find(
//       o => o.__type === Malloy.ViewOperationType.Limit
//     ) as Malloy.ViewOperationWithLimit;
//     return limit?.limit;
//   }

//   public setLimit(limit: number) {
//     // Find an existing limit operation
//     const limitIdx = this.segment.operations.findIndex(
//       o => o.__type === Malloy.ViewOperationType.Limit
//     );
//     const operations = [...this.segment.operations];
//     if (limitIdx === -1) {
//       // No limit operation, add a new one
//       operations.push({
//         __type: Malloy.ViewOperationType.Limit,
//         limit,
//       });
//     } else {
//       // Edit the existing limit operation with a new limit value
//       const limitOp = this.segment.operations[
//         limitIdx
//       ] as Malloy.ViewOperationWithLimit;
//       operations.splice(limitIdx, 1, {
//         ...limitOp,
//         limit,
//       });
//     }
//     return this.update({
//       ...this.segment,
//       operations,
//     });
//   }

//   public addGroupBy(name: string): {query: Malloy.Query} {
//     // walk down the operations and find either (1) a group by statement,
//     // (2) an aggregate statement, or (3) a view statement, or (4) the end of the
//     // list. If we found (1), we add it to that operation. If (2) or (3) we add
//     // it before that element; if (4) add it to the end of the list.
//     const groupByItem: Malloy.GroupByItem = {
//       field: {
//         expression: {
//           __type: Malloy.ExpressionType.Reference,
//           name,
//         },
//       },
//     };
//     let newSegment = this.segment;
//     const whereToInsert = this.findInsertionPoint(
//       Malloy.ViewOperationType.GroupBy
//     );
//     if ('addTo' in whereToInsert) {
//       const operation = this.segment.operations[whereToInsert.addTo];
//       if (operation.__type !== Malloy.ViewOperationType.GroupBy) {
//         throw new Error('Invalid');
//       }
//       newSegment = {
//         ...this.segment,
//         operations: [
//           ...this.segment.operations.slice(0, whereToInsert.addTo),
//           {
//             ...operation,
//             items: [...operation.items, groupByItem],
//           },
//           ...this.segment.operations.slice(whereToInsert.addTo + 1),
//         ],
//       };
//     } else {
//       const groupBy: Malloy.ViewOperation = {
//         __type: Malloy.ViewOperationType.GroupBy,
//         items: [groupByItem],
//       };
//       const operations = [...this.segment.operations];
//       operations.splice(whereToInsert.addAt, 0, groupBy);
//       newSegment = {
//         ...this.segment,
//         operations,
//       };
//     }
//     const newQuery = this.update(newSegment);
//     return {query: newQuery};
//   }
// }

// class SourceEditor {
//   constructor(
//     public readonly update: UpdateFunction<Malloy.Reference>,
//     public readonly source: Malloy.Reference
//   ) {}

//   private makeParameterValue(value: RawParameterValue): Malloy.LiteralValue {
//     if (typeof value === 'string') {
//       return {
//         __type: Malloy.LiteralValueType.StringLiteral,
//         string_value: value,
//       };
//     } else if (typeof value === 'boolean') {
//       return {
//         __type: Malloy.LiteralValueType.BooleanLiteral,
//         boolean_value: value,
//       };
//     } else if (typeof value === 'number') {
//       return {
//         __type: Malloy.LiteralValueType.NumberLiteral,
//         number_value: value,
//       };
//     } else if (value === null) {
//       return {
//         __type: Malloy.LiteralValueType.NullLiteral,
//       };
//     }
//     throw new Error('TODO other literal types');
//   }

//   public setParameter(name: string, value: RawParameterValue) {
//     const operations = [...(this.source.parameters ?? [])];
//     const idx = parameters.findIndex(p => p.name === name);
//     const parameter = {
//       name,
//       value: this.makeParameterValue(value),
//     };
//     if (idx !== -1) {
//       parameters.splice(idx, 1, parameter);
//     } else {
//       parameters.push(parameter);
//     }
//     return this.update({
//       ...this.source,
//       parameters,
//     });
//   }
// }

// export function test() {
//   const qb = new QueryBuilder();

//   qb.editDefaultSegment().addGroupBy('foo');

//   qb.editSegment([]).addGroupBy('foo');
// }

/*
  Should it support undo? Or should you create a new query builder when manipulating state from the outside? / just call loadQuery
    e.g.
      qb.doThing();
      qb.undo();
    verses:
      const sqd = qb.getStableQueryDef();
      qb.doThing();
      qb.loadStableQueryDef(sqd);

      - Will prefers that it be handled externally
      - It should not be based on mutation
      - Just always return a full new stablequerydef (memoization etc will make rendering efficient)
        - maybe something like Redux -- always a new top level object, but unchanged subtrees are preserved

  What should the model be for "staging" changes:
    a)
      const {conflictingNames} = qb.tryAddThing();
    b)
      const {changes, errors} = qb.tryDeleteField();
      for (const change of changes) {
        if (change instanceof CascadingNameFieldRemoved) {
          ...
        }
      }
      const {changes, errors} = qb.tryAddField();
      for (const error of errors) {
        if (error instanceof ConflictingNameError) { ... }
      }
    c)
      const {changes, errors, commit} = qb.stage(() => qb.doThing());


    const { result, errors: { conflicintName }, changes: { cascadingFieldRemoved} } = qb.getThing().doThing();
    if (there are changes) {
      popUpAcceptThing()
    } else {
      updateQuery(result)
    }

  How to deal with "unrunnable" state:
    a)
      qb.newEmptyNest()
      const isRunnable = qb.isRunnable();

      - all nests have a field
      - all required parameters are set

  How to identify where to do things:
    a)
      qb.addField("path.to.thing", "field");
    b)
      qb.getView(someOpaqueId).addField("field")
      qb.getQueryOperation(someOpaqueId).delete() // we keep track of parents for you
    c)
      // you store objects yourself
      theView.addField("field")
      theLimit.delete()

      - Will is fine with A. B gives more type safety.

  Add vs. set
    For some things, only one is allowed, e.g. limits
      a)
        theLimit.set(value)
      b)
        theView.setLimit(value)
      c)
        theView.addLimit(value) // overwrites the limit with a "change"

    - Will: setLimit is probably fine
    qb.getLimit(['pipeline', 'stages', 0, 'operations', 0]).setValue(10)
    qb.getStage(['pipeline', 'stages', 0]).setLimit(10)
    qb.getAggregate(['pipeline', 'stages', 0, 'operations', 5]).addFilter(10)


  Traversal:
    (- Will: if traversal API does some kind of categorization for you, that'd be great)
    - Will: traversal is manual on StableQueryDef

    - property name
    - index


    <Query query.name, query.pipline>
      <Segment i=0, path=[...paths, 0]> => updateQuery(qb.getSegment(path).doSegmentThing())


    traversal : { node, type, path }

*/

/*
Query
  - addAnnotation() ---ANNOTATION OPERATIONS---
  - getAnnotations()
  - deleteAnnotation() // TODO possibly also tags?
  - getInheritedAnnotations() // Well, not for query, but for most other things that have annotations
  Source
    - delete() // the source from the query
    - setParameter(name, value)
    - clearParameter(name)
    Parameter
      - setValue(value)
      - delete()
  Pipeline
    - addStage() // add to end of list
    Stage
      - delete()
      - addStage() // really adds to parent after this stage
      - composeWithNamedView() // adds a refinement
      Refinement
        - delete()
      =QueryReferenceStage // only allowed as the first stage
        - editReference()
        - setParameter() ETC PARAMETERS
        - addLimit() ETC VIEW OPERATIONS // really adds to a refinement after this one (possibly behind default view)
      =ViewReferenceStage
        - editReference()
        - setParameter() ETC PARAMETERS
        - addLimit() ETC VIEW OPERATIONS // really adds to a refinement after this one
      =LiteralViewStage
        - addLimit(limit) ---VIEW OPERATIONS---
        - addEmptyNest(name)
        - addOrderBy(field, direction)
        - addGroupBy()
        - addAggregate(
        - addFilter(field, filter)
        Operation
          - delete()
          =LimitOperation
            - setLimit()
          =OrderByOperation // TODO need to decide whether the QueryBuilder distinguishes between grouped order bys and separate order bys
            - setField()
            - setDirection()
          =GroupByField
            - addAnnotation() ETC ANNOTATIONS
          =NestField
            - addLimit() ETC VIEW OPERATIONS
            - addAnnotation() ETC ANNOTATIONS
            =ViewReferenceNest
            =LiteralViewNest

  Filter

*/

type RawParameterValue = number | string | Date | boolean | null;
type PathSegment = string | number;
type Path = PathSegment[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeConstructor<T extends Node> = new (...args: any[]) => T;
type UpdateResult = {
  query: Malloy.Query;
  path: Path;
};
type Update<T> = (item: T) => UpdateResult;

abstract class Node {
  constructor(public readonly parent: Node | undefined) {}

  child(name: string): Node | undefined {
    throw new Error(`${this.constructor.name} cannot contain a \`${name}\``);
  }

  index(_i: number): Node | undefined {
    throw new Error(`${this.constructor.name} is not indexable`);
  }

  path(path: Path) {
    if (path.length === 0) return this;
    const [head, ...rest] = path;
    const child =
      typeof head === 'string' ? this.child(head) : this.index(head);
    if (rest.length === 0) return child;
    if (child === undefined) {
      throw new Error(`${head} is undefined and cannot contain ${rest}`);
    }
    return child.path(rest);
  }

  edit<T extends Node>(NodeClass: NodeConstructor<T>, path: Path): T {
    const child = this.path(path);
    if (child instanceof NodeClass) {
      return child;
    }
    throw new Error(`Path ${path} does not refer to a ${NodeClass.name}`);
  }

  editParameter(path: Path) {
    return this.edit(ParameterNode, path);
  }

  editGroupByItem(path: Path) {
    return this.edit(GroupByItemNode, path);
  }

  root(): QueryNode {
    return this.parent!.root();
  }
}

// Possible to have an unnamed nest and provide a name later?

export class QueryNode extends Node {
  constructor(public query: Malloy.Query) {
    super(undefined);
  }

  get source(): ReferenceNode | undefined {
    if (this.query.source) {
      return new ReferenceNode(
        this,
        source => then(this.build({source}), 'source'),
        this.query.source
      );
    }
  }

  get pipeline(): PipelineNode {
    return new PipelineNode(
      this,
      pipeline => then(this.build({pipeline}), 'pipeline'),
      this.query.pipeline
    );
  }

  child(name: string) {
    if (name === 'source') return this.source;
    if (name === 'pipeline') return this.pipeline;
    return super.child(name);
  }

  setSource(source: Malloy.SourceInfo) {
    return this.build({source: {name: source.name}});
  }

  build(edit: Partial<Malloy.Query>): UpdateResult {
    this.query = {...this.query, ...edit};
    return {
      query: this.query,
      path: [],
    };
  }

  root(): QueryNode {
    return this;
  }

  public editDefaultSegment(): SegmentRefinementNode {
    const stages = this.pipeline.stages;
    if (stages.length === 0) {
      // Need to add a stage with an empty segment
      return new SegmentRefinementNode(
        this.pipeline.stages,
        s => then(stages.addStageWithSingleRefinement(s), 'refinements', 0),
        SegmentRefinementNode.empty()
      );
    } else {
      const refinements = stages.last.refinements;
      if (
        refinements.length === 0 ||
        refinements.last.__type !== Malloy.RefinementType.Segment
      ) {
        return new SegmentRefinementNode(
          refinements,
          r => refinements.addRefinement(r),
          SegmentRefinementNode.empty()
        );
      } else {
        return refinements.last;
      }
    }
  }
}

function then(result: UpdateResult, ...segments: PathSegment[]) {
  const {path, query} = result;
  return {
    query,
    path: [...path, ...segments],
  };
}

// type Buildsa<A extends string, B> = Buildable<Record<A, B>>;

class ReferenceNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.Reference>,
    private readonly node: Malloy.Reference
  ) {
    super(parent);
  }

  get name() {
    return this.node.name;
  }

  get parameters(): ParametersNode {
    return new ParametersNode(
      this,
      parameters => then(this.build({parameters}), 'parameters'),
      this.node.parameters
    );
  }

  child(name: string): Node | undefined {
    if (name === 'parameters') return this.parameters;
    return super.child(name);
  }

  setParameter(name: string, value: RawParameterValue) {
    return this.parameters.setParameter(name, value);
  }

  build(edit: Partial<Malloy.Reference> | undefined) {
    return this.update({...this.node, ...edit});
  }
}

class ParametersNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.ParameterValue[] | undefined>,
    private readonly parameters: Malloy.ParameterValue[] | undefined
  ) {
    super(parent);
  }

  setParameter(name: string, value: RawParameterValue) {
    const parameters = [...(this.parameters ?? [])];
    const idx = parameters.findIndex(p => p.name === name);
    const parameter = {
      name,
      value: ParameterNode.makeParameterValue(value),
    };
    if (idx === -1) {
      parameters.push(parameter);
    } else {
      parameters.splice(idx, 1, parameter);
    }
    return this.updateHandleEmpty(parameters);
  }

  private updateHandleEmpty(parameters: Malloy.ParameterValue[]) {
    if (parameters.length === 0) {
      return this.build(undefined);
    }
    return this.build(parameters);
  }

  index(i: number) {
    if (this.parameters === undefined) {
      throw new Error(`No parameter at index ${i}`);
    }
    const update = (parameter: Malloy.ParameterValue | null) => {
      const parameters = [...(this.parameters ?? [])];
      if (parameter === null) {
        parameters.splice(i, 1);
      } else {
        parameters.splice(i, 1, parameter);
      }
      return this.updateHandleEmpty(parameters);
    };
    return new ParameterNode(this, update, this.parameters[i]);
  }

  build(edit: Malloy.ParameterValue[] | undefined) {
    return this.update(edit);
  }
}

class PipelineNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.Pipeline>,
    private readonly pipeline: Malloy.Pipeline
  ) {
    super(parent);
  }

  get stages(): PipeStagesNode {
    return new PipeStagesNode(
      this,
      stages => then(this.build({stages}), 'stages'),
      this.pipeline.stages
    );
  }

  child(name: string): Node | undefined {
    if (name === 'stages') return this.stages;
    return super.child(name);
  }

  public build(edit: Partial<Malloy.Pipeline>) {
    return this.update({...this.pipeline, ...edit});
  }
}

class ParameterNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.ParameterValue | null>,
    private readonly parameter: Malloy.ParameterValue
  ) {
    super(parent);
  }

  static makeParameterValue(value: RawParameterValue): Malloy.LiteralValue {
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
  }

  setValue(value: RawParameterValue) {
    return this.build({
      ...this.parameter,
      value: ParameterNode.makeParameterValue(value),
    });
  }

  public delete() {
    this.build(null);
  }

  public build(parameter: Malloy.ParameterValue | null) {
    return this.update(parameter);
  }
}

class PipeStagesNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.PipeStage[]>,
    private readonly stages: Malloy.PipeStage[]
  ) {
    super(parent);
  }

  get length() {
    return this.stages.length;
  }

  get last() {
    return this.index(this.length - 1);
  }

  index(i: number) {
    if (this.stages === undefined) {
      throw new Error(`No stage at index ${i}`);
    }
    const update = (stage: Malloy.PipeStage | null) => {
      const stages = [...this.stages];
      if (stage === null) {
        stages.splice(i, 1);
      } else {
        stages.splice(i, 1, stage);
      }
      // TODO this is sorta wrong -- the path now points to the next element
      // when you delete; the path should probably be removed.
      return then(this.build(stages), i);
    };
    return new PipeStageNode(this, update, this.stages[i]);
  }

  addStage(stage: Malloy.PipeStage | null) {
    if (stage === null) {
      // TODO path is wrong
      return this.update(this.stages);
    } else {
      return then(this.update([...this.stages, stage]), this.stages.length);
    }
  }

  addStageWithSingleRefinement(segment: Malloy.RefinementWithSegment | null) {
    if (segment === null) {
      return this.update(this.stages);
    } else {
      return then(
        this.update([...this.stages, {refinements: [segment]}]),
        this.stages.length
      );
    }
  }

  build(edit: Malloy.PipeStage[]) {
    return this.update(edit);
  }
}

class PipeStageNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.PipeStage | null>,
    private readonly stage: Malloy.PipeStage // is there a source, if so what is it's schema
  ) {
    super(parent);
  }

  get refinements(): RefinementsNode {
    return new RefinementsNode(
      this,
      refinements =>
        then(this.update({...this.stage, refinements}), 'refinements'),
      this.stage.refinements
    );
  }

  child(name: string): Node | undefined {
    if (name === 'refinements') return this.refinements;
    return super.child(name);
  }

  public delete() {
    this.build(null);
  }

  public build(stage: Malloy.PipeStage | null) {
    return this.update(stage);
  }
}

class RefinementsNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.Refinement[]>,
    private readonly refinements: Malloy.Refinement[] // needs the schema
  ) {
    super(parent);
  }

  get last() {
    return this.index(this.length - 1);
  }

  get length() {
    return this.refinements.length;
  }

  index(i: number): RefinementNode {
    const update = (refinement: Malloy.Refinement | null) =>
      this.setIndex(i, refinement);
    const refinement = this.refinements[i];
    if (refinement.__type === Malloy.RefinementType.Reference) {
      return new RefinementWithReferenceNode(this, update, refinement);
    } else {
      return new SegmentRefinementNode(this, update, refinement);
    }
  }

  build(edit: Malloy.Refinement[]) {
    return this.update(edit);
  }

  setIndex(index: number, refinement: Malloy.Refinement | null) {
    // TODO index for deletion
    return then(
      this.build(setIndex(index, refinement, this.refinements)),
      index
    );
  }

  addRefinement(refinement: Malloy.Refinement | null) {
    return this.setIndex(this.length, refinement);
  }
}

type RefinementNode = SegmentRefinementNode | RefinementWithReferenceNode;

class SegmentRefinementNode extends Node {
  readonly __type = Malloy.RefinementType.Segment;
  // TODO needs the schema
  // and also what the previous refinements were
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.RefinementWithSegment | null>,
    private readonly segment: Malloy.RefinementWithSegment
  ) {
    super(parent);
  }

  child(name: string) {
    if (name === 'operations') return this.operations;
    return super.child(name);
  }

  get operations() {
    return new ViewOperationsNode(
      this,
      operations =>
        then(this.build({...this.segment, operations}), 'operations'),
      this.segment.operations
    );
  }

  public delete() {
    return this.build(null);
  }

  public build(segment: Malloy.RefinementWithSegment | null) {
    return this.update(segment);
  }

  static empty(): Malloy.RefinementWithSegment {
    return {
      __type: Malloy.RefinementType.Segment,
      operations: [],
    };
  }

  private firstOfType<T extends Malloy.ViewOperation>(
    type: T['__type']
  ):
    | {
        index: -1;
        operation: undefined;
      }
    | {
        index: number;
        operation: T;
      } {
    const index = this.segment.operations.findIndex(o => o.__type === type);
    if (index === -1) {
      return {index, operation: undefined};
    }
    const operation = this.segment.operations[index];
    if (operation.__type !== type) {
      throw new Error(
        `Internal error, expected operation to be of type ${type}`
      );
    }
    return {index, operation: operation as T};
  }

  private firstIndexOfOperationType(type: Malloy.ViewOperationType) {
    return this.segment.operations.findIndex(o => o.__type === type);
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
    return {addAt: this.segment.operations.length};
  }

  // TODO this is a bit odd that it creates a limit operation with limit: 0 if there is none
  public editLimit(): LimitOperationNode {
    const {index, operation} = this.firstOfType<Malloy.ViewOperationWithLimit>(
      Malloy.ViewOperationType.Limit
    );
    if (operation === undefined) {
      return new LimitOperationNode(
        this,
        l => this.operations.addOperation(l),
        LimitOperationNode.empty()
      );
    }
    return new LimitOperationNode(
      this,
      l => this.operations.setIndex(index, l),
      operation
    );
  }

  public editOrderBy(): OrderByOperationNode {
    const {index, operation} =
      this.firstOfType<Malloy.ViewOperationWithOrderBy>(
        Malloy.ViewOperationType.OrderBy
      );
    if (operation === undefined) {
      return new OrderByOperationNode(
        this,
        l => this.operations.addOperation(l),
        OrderByOperationNode.empty()
      );
    }
    return new OrderByOperationNode(
      this,
      l => this.operations.setIndex(index, l),
      operation
    );
  }

  public editOrderByItem(name: string) {
    for (const operation of this.operations) {
      if (operation.__type !== Malloy.ViewOperationType.OrderBy) continue;
      for (const item of operation.items) {
        if (item.field.name === name) {
          return item;
        }
      }
    }
    return this.editOrderBy().editItem(name);
  }

  public addOrderBy(
    name: string,
    direction: Malloy.OrderByDirection | undefined
  ) {
    return this.editOrderByItem(name).setDirection(direction);
  }

  public getLimit(): number | undefined {
    const limit = this.segment.operations.find(
      o => o.__type === Malloy.ViewOperationType.Limit
    ) as Malloy.ViewOperationWithLimit;
    return limit?.limit;
  }

  public setLimit(limit: number) {
    return this.editLimit().setLimit(limit);
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
      if (operation.__type !== Malloy.ViewOperationType.GroupBy) {
        throw new Error('Invalid');
      }
      return operation.items.addItem(groupByItem);
    } else {
      const operation: Malloy.ViewOperation = {
        __type: Malloy.ViewOperationType.GroupBy,
        items: [groupByItem],
      };
      return this.operations.addOperation(operation);
    }
  }
}

class ViewOperationsNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.ViewOperation[]>,
    private readonly operations: Malloy.ViewOperation[]
  ) {
    super(parent);
  }

  get length() {
    return this.operations.length;
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i++) {
      yield this.index(i);
    }
  }

  index(i: number) {
    const operation = this.operations[i];
    const setIndex = (o: Malloy.ViewOperation | null) => this.setIndex(i, o);
    switch (operation.__type) {
      case Malloy.ViewOperationType.Aggregate:
        return new AggregateOperationNode(this, setIndex, operation);
      case Malloy.ViewOperationType.GroupBy:
        return new GroupByOperationNode(this, setIndex, operation);
      case Malloy.ViewOperationType.Limit:
        return new LimitOperationNode(this, setIndex, operation);
      case Malloy.ViewOperationType.OrderBy:
        return new OrderByOperationNode(this, setIndex, operation);
      default:
        throw new Error('TODO');
    }
  }

  setIndex(index: number, operation: Malloy.ViewOperation | null) {
    // TODO deletion index
    return then(this.build(setIndex(index, operation, this.operations)), index);
  }

  addOperation(operation: Malloy.ViewOperation | null) {
    return this.setIndex(this.length, operation);
  }

  // chain(
  //   edit: Malloy.ViewOperation[],
  //   then: (next: ViewOperationsNode) => UpdateResult
  // ) {
  //   const q = this.update(edit);
  //   const next = this.root().edit(ViewOperationsNode, q.path);
  //   // TODO i guess merge other stuff?
  //   return then(next);
  // }

  /*
    Question: if you have `order_by: x, y`, but there is no `group_by: y` in the query,
    then you delete `group_by: x` from the query, should `order_by: y` automatically
    get deleted? In other words, is the "cascading changes" just performing
    operations to delete illegal expressions, or should it be to delete
    specific things (in this case, only `order_by: x`)

  */

  build(edit: Malloy.ViewOperation[]) {
    return this.update(edit);
    // TODO validate order_by's referring to real things, and delete if not
  }
}

class RefinementWithReferenceNode extends Node {
  readonly __type = Malloy.RefinementType.Reference;
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.RefinementWithReference | null>,
    private readonly reference: Malloy.RefinementWithReference
  ) {
    super(parent);
  }

  public delete() {
    this.build(null);
  }

  public build(reference: Malloy.RefinementWithReference | null) {
    return this.update(reference);
  }
}

class LimitOperationNode extends Node {
  readonly __type = Malloy.ViewOperationType.Limit;

  constructor(
    parent: Node,
    private readonly update: Update<Malloy.ViewOperationWithLimit | null>,
    private readonly node: Malloy.ViewOperationWithLimit
  ) {
    super(parent);
  }

  public delete() {
    this.build(null);
  }

  public build(node: Malloy.ViewOperationWithLimit | null) {
    return this.update(node);
  }

  setLimit(limit: number) {
    return this.build({...this.node, limit});
  }

  static empty(): Malloy.ViewOperationWithLimit {
    return {
      __type: Malloy.ViewOperationType.Limit,
      limit: 0,
    };
  }
}

class OrderByOperationNode extends Node {
  readonly __type = Malloy.ViewOperationType.OrderBy;

  constructor(
    parent: Node,
    private readonly update: Update<Malloy.ViewOperationWithOrderBy | null>,
    private readonly node: Malloy.ViewOperationWithOrderBy
  ) {
    super(parent);
  }

  get items() {
    return new OrderByItemsNode(
      this,
      items => then(this.update({...this.node, items}), 'items'),
      this.node.items
    );
  }

  child(name: string) {
    if (name === 'items') return this.items;
    return super.child(name);
  }

  public delete() {
    this.build(null);
  }

  public build(node: Malloy.ViewOperationWithOrderBy | null) {
    return this.update(node);
  }

  static empty(): Malloy.ViewOperationWithOrderBy {
    return {
      __type: Malloy.ViewOperationType.OrderBy,
      items: [],
    };
  }

  public editItem(name: string) {
    for (const item of this.items) {
      if (item.field.name === name) {
        return item;
      }
    }
    return new OrderByItemNode(this.items, item => this.items.addItem(item), {
      field: {name},
    });
  }
}

class AggregateOperationNode extends Node {
  readonly __type = Malloy.ViewOperationType.Aggregate;

  constructor(
    parent: Node,
    private readonly update: Update<Malloy.ViewOperationWithAggregate | null>,
    private readonly node: Malloy.ViewOperationWithAggregate
  ) {
    super(parent);
  }

  public delete() {
    this.build(null);
  }

  public build(node: Malloy.ViewOperationWithAggregate | null) {
    return this.update(node);
  }

  static empty(): Malloy.ViewOperationWithAggregate {
    return {
      __type: Malloy.ViewOperationType.Aggregate,
      items: [],
    };
  }
}

class GroupByOperationNode extends Node {
  readonly __type = Malloy.ViewOperationType.GroupBy;

  constructor(
    parent: Node,
    private readonly update: Update<Malloy.ViewOperationWithGroupBy | null>,
    private readonly node: Malloy.ViewOperationWithGroupBy
  ) {
    super(parent);
  }

  get items() {
    return new GroupByItemsNode(
      this,
      items => then(this.build({...this.node, items}), 'items'),
      this.node.items
    );
  }

  child(name: string) {
    if (name === 'items') return this.items;
    return super.child(name);
  }

  public delete() {
    return this.build(null);
  }

  public build(node: Malloy.ViewOperationWithGroupBy | null) {
    // TODO notify user somehow that this cascade happened?
    if (node?.items.length === 0) return this.update(null);
    return this.update(node);
  }

  static empty(): Malloy.ViewOperationWithGroupBy {
    return {
      __type: Malloy.ViewOperationType.GroupBy,
      items: [],
    };
  }
}

class GroupByItemsNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.GroupByItem[]>,
    private readonly items: Malloy.GroupByItem[]
  ) {
    super(parent);
  }

  get length() {
    return this.items.length;
  }

  index(i: number) {
    const item = this.items[i];
    return new GroupByItemNode(this, item => this.setIndex(i, item), item);
  }

  setIndex(index: number, item: Malloy.GroupByItem | null) {
    // TODO do some validation here...
    return this.build(setIndex(index, item, this.items));
  }

  addItem(item: Malloy.GroupByItem | null) {
    return this.setIndex(this.length, item);
  }

  build(edit: Malloy.GroupByItem[]) {
    return this.update(edit);
  }
}

class GroupByItemNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.GroupByItem | null>,
    private readonly node: Malloy.GroupByItem
  ) {
    super(parent);
  }

  setName(name: string) {
    return this.build({...this.node, name});
  }

  get name() {
    return this.node.name;
  }

  // TODO field

  public delete() {
    // TODO cascade, removing order bys
    return this.build(null);
  }

  public build(node: Malloy.GroupByItem | null) {
    return this.update(node);
  }
}

class OrderByItemsNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.OrderByItem[]>,
    private readonly items: Malloy.OrderByItem[]
  ) {
    super(parent);
  }

  get length() {
    return this.items.length;
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i++) {
      yield this.index(i);
    }
  }

  index(i: number) {
    const item = this.items[i];
    return new OrderByItemNode(this, item => this.setIndex(i, item), item);
  }

  setIndex(index: number, item: Malloy.OrderByItem | null) {
    // TODO do some validation here...
    // TODO deletion index
    return then(this.build(setIndex(index, item, this.items)), index);
  }

  addItem(item: Malloy.OrderByItem | null) {
    return this.setIndex(this.length, item);
  }

  build(edit: Malloy.OrderByItem[]) {
    return this.update(edit);
  }
}

class OrderByItemNode extends Node {
  constructor(
    parent: Node,
    private readonly update: Update<Malloy.OrderByItem | null>,
    private readonly node: Malloy.OrderByItem
  ) {
    super(parent);
  }

  setDirection(direction: Malloy.OrderByDirection | undefined) {
    return this.build({...this.node, direction});
  }

  get direction() {
    return this.node.direction;
  }

  get field() {
    return new ReferenceNode(
      this,
      field => then(this.build({...this.node, field}), 'field'),
      this.node.field
    );
  }

  child(name: string) {
    if (name === 'field') return this.field;
    return super.child(name);
  }

  public delete() {
    this.build(null);
  }

  public build(node: Malloy.OrderByItem | null) {
    return this.update(node);
  }
}

function setIndex<T>(index: number, item: T | null, items: T[]) {
  const result = [...items];
  if (item === null) {
    result.splice(index, 1);
  } else {
    result.splice(index, 1, item);
  }
  return result;
}

/*
Possible stragegy for both VALIDATION and CASCADING

CASCADING is essentially just "you performed an action that caused an error, let me fix it for you"



Maybe we can enable cascading as par

Weird case:

  run: flights -> {
    group_by: carrier
    order_by: carrier desc
  } -> {
    select: carrier
  }

  deleting the group by `carrier`:
    1) leaves an empty group_by
    2) makes the order_by invalid
    3) makes the `select` invalid
    4) makes the first stage not runnable
    5) makes the second stage not runnable

  What happens if you have

  run: flights -> {
    # group level annotation
    group_by:
      # field level annotation
      carrier
    order_by: carrier desc
  }

  And then you delete `carrier`. Does it leave an empty group_by label?
    run: flights -> {
      # group level annotation
      group_by:
      order_by: carrier desc
    }
*/


/*

New thought:

All Nodes have a reference to the root QueryNode and their path

each operation basically starts with "get the object somewhere in the path" (might be the given path
or somewhere slightly above), then recompute that part of the tree and pass it to a function (returned
by the path get) which updates that subtree and returns the new tree.

field delete:

  - get group by operation that contains the field
  - delete the field from the group by
  - if the group by is empty, delete the group by
  - get the view operations list that contains the group by
  - find any order bys that refer to that field
  - delete them
  - get the list of stages that contained the refinement
  - get any references to the field which was removed in later stages
  - remove them

  GroupByItem.delete() {
    // delete this item
    let out = this.update(null);
      // could be this.parentPath() is [...this.path, PARENT]
    const groupBy = this.getGroupByViewOperationNode(out, [...this.path, PARENT]);
    if (groupBy.items.length === 0) {
      out = groupBy.delete({ cascade: false });
    }
    const operations = this.getViewOperationsNode(out, [...groupBy.path, PARENT]);
    for (const operation of operations) {
      if (operation.__type === Malloy.ViewOperationType.OrderBy) {
        for (const item of operation) {
          if (item.field.name === this.getOutputName()) {
            // this won't work, because successive deletions will overwrite each other
            item.delete({ cascade: false });
          }
        }
        if (operation.items.length === 0) {
          operation.delete({ cascade: false });
        }
      }
    }
  }
 */
