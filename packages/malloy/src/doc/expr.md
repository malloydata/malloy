# Expressions in the Malloy IR

The compiler translates arithmetic expressions into an expression tree. Later, when a query is run, the query writer will translate the expression tree into an SQL expression.

## An expression is a tree of nodes

Each node is a Typescript interface. There are three kids of nodes

```TypeScript
export interface ExprLeaF
  node: string;
  dataType?: AtomicFieldType;
  sql?: string;
}
export interface ExprE extends ExprLeaf {
  e: Expr;
}
export interface ExprWithKids extends ExprLeaf {
  kids: Record<string, Expr | Expr[]>;
}
```

* If your node has no sub sxpressions, it is an `ExprLeaf`
* If it has exactly one sub-expression, it is a `ExprE` and the expression is stored in `expr.e`
* If it has more than one sub expression, it is an `ExprWithKids` and the entries
  in `expr.kids` can be an expression, like `expr.kids.left` or an array, like `expr.kids.filterList`

The type `Expr` is a union type of all expression nodes. This means that there is no need for
discriminator functions, a comparison of an `expr.node` to a constant will narrow the type enough to
allow you to access the sub fields.

It is possible (and preferred), when the type of sub expression is known, to include that
in the interface, for example a filtered expression consists of an expression to be filtered,
and then a list of filter conditions ... it this makes possible to access
the properties of the children without needed to check the node type.

```TypeScript
export interface FilterCondition extends ExprE {
  node: 'filterCondition';
  code: string;
  expressionType: ExpressionType;
}

export interface FilteredExpr extends ExprWithKids {
  node: 'filteredExpr';
  kids: {e: Expr; filterList: FilterCondition[]};
}
```

To add a new node type, make a new interface inheriting from the correct parent,
and then add that node to `type Expr = |` union;

### dataType?

Not all nodes have a `dataType:`, but for some nodes the dataType is required for translation.
When defining one of these nodes, the interface should reflect that.

## Node translation

The basic outline of a node being translated to SQL happens in the class `QueryField` in the method `exprToSQL` ( used to be called `generateExpressionFromExpr`)

There is a `switch()` statement which checks for the node type, and then generates the SQL
for each node type (or dispatches to a method call for the appropriate node type). There are a few things things that happen before the switch statement, which you should know about.

1) All the node's children are translated, and each child node will have it's translation stored in `.sql`. Thus when translating a node, the translations of the children have already been computed and can be composed into the translated result.
  * If a child is NOT a leaf node, the `.sql` of the
    child node will be wrapped in `()` to it should always be safe to simply use the `.sql` without
    adding extra parens.
2) After the child nodes are translated, before the main siwtch statement in `QueryField`, the dialect is consulted and given a chance to translate the Expr. This is how all dialect specific actions like time and date operations are handled, and how dialect specific actions like modifying the division operator also happen.

Here's an example of QueryField generating a translation ...

```TypeScript
      case '/':
        return `${expr.kids.left.sql}/${expr.kids.right.sql}`;
```

and here is an exampe of a dialect specific over-ride, from the `TrinoDialect` dialect, note that it is important
to call super because `Dialect` has translation
responsibilities as well. Returning `undefined` means that the dialect has no opinion on how a node should be translated.

```TypeScript
  exprToSQL(qi: QueryInfo, df: Expr): string | undefined {
    switch (df.node) {
      case '/':
        return `CAST(${df.kids.left.sql} AS DOUBLE)/${df.kids.right.sql}`;
    }
    return super.exprToSQL(qi, df);
  }
  ```

## Working with Expr

There are some utility functions for working with expression trees.

### exprWalk

```TypeScript
    for (const expr of exprWalk(e)) {
```

`exprWalk(expr, 'pre' | 'post')` returns an iterator which produces a pre or post order (default pre) walk
of the expression tree one node at a time. `exprWalk` deals with the
complexities of `ExprE` vs `ExprWithKids` and `kids:` which are
arrays of `Expr` types.

### exprMap

`exprMap(expr, (e) => Expr)` walks the tree in pre-order
and returns a new tree where each node has been replaced
by the passed mapping funciton.

### composeSQLExpr

Used mostly by the function code, but sometimes useful when writing hand built models for tests. For those familiar with the `Fragment[]` era of expressions, the data format is very similar, an array of mixed strings and nodes.

```TypeScript
export type SQLExprElement = string | Expr;
export function composeSQL(SQLExprElement[]): Expr { ...
```

`composeSQL(['SOME SQL,', someExpr, ', MORE SQL'])` creates an Epxr node which will collect the literal strings and the translated SQL from each expression into an Expr node. `exprToSQL` will expand that node to the concatenation of all the elements.

### sql``

Exactly like `composeSQLExpr` except it uses the templated string feature of Typescript, the equivalent string would be

```TypeScript
sql`SOME SQL, ${someExpr}, MORE SQL`
```
