# `FieldDef`

A [`StructDef`](structdef.md) has an array of `fields: FieldDef[]`

`FieldDef` as described here is slightly simplified from the actual implementations, but this is exactly how everything works.

## Atomic fields (`FieldAtomicTypeDef`)

The simplest `FieldDef` is simply a schema entry, describing a named column which is known to be in a source and it's type. For example, here is `BooleanTypeDef`

```TypeScript
interface BooleanTypeDef {
    type: boolean
}
```

* Fields which can be stored in a column are called "Atomic" fields. There are entries (like dimensions, measures, or joins) which are also stored in `fields:` which are not "Atomic".
* For every `XXXTypeDef` there is also an `XXXFieldDef` which includes `NamedObject` and some other things. In this case there would also be `BooleanFieldDef`

This gives us

```TypeScript
type AtomicTypeDef =
  | StringTypeDef
  | TemporalTypeDef
  | NumberTypeDef
  | BooleanTypeDef
  | JSONTypeDef
  | NativeUnsupportedTypeDef
  | ArrayTypeDef
  | RecordTypeDef;

type AtomicFieldDef =
  | StringFieldDef
  | TemporalFieldDef
  | NumberFieldDef
  | BooleanFieldDef
  | JSONFieldDef
  | NativeUnsupportedFieldDef
  | ArrayFieldDef
  | RecordFieldDef;
```

* isAtomicTypeDef(fd) -- Returns true if the `type:` of this fielddef matches one of the atomic types

## Dimensions and Measures and Calculations

A computation looks like an atomic field in a field list, it has an atomic type, but it will also implement `Expression` which will have the definition of the computation

```TypeScript
interface Expression {
  e: Expr;
  expressionType?: ExpressionType;
  code?: string;
}
```

You can identify a `FieldDef` which is computed by asking `hasExpression(fd: FieldDef)` this will return true and grant typed access to the `Expression` if the entry is a dimension, measure (or calculation actually).

## Join tree entries

For any entry which participates in join treee (joined table, joined query, joined array, joined record(s)) in the field list, the `FieldDef` for that entry will also have properties from `JoinBase`

```TypeScript
interface JoinBase {
  type: JoinElementType;
  join: JoinType;
  matrixOperation: MatrixOperation;
  onExpression?: Expr;
}
```

You can access this property of the FieldDef with `hasJoin(fd)` which will return true and grant typed access to the `JoinBase` properties of the `FieldDef`

If `hasJoin()` is true on a `FieldDef` then that field is also guaranteed to be a `StructDef` which you verify with `isFieldStructDef()` which will return true and return type checked access to the portions of the field which describe the `StructDef`


* Non repeated records are always joined, in all cases.
* Repeated records ... I am assuming we also always join them.
* Arrays are always joined by default when read from a schema, but a computed dimension with an array value is NOT automatically joined. It can be joined with the (TBD) `join_array: fieldName is arrayExpression` syntax.

## Views

The other entry in a field list is a view, which in the source is `{type: 'turtle'}`

# QueryFieldDef ...

Once upon a time queries also had an array called `fields:` which contained a slightly different set of field-like entities. For a while now this has not been true. A query has `queryFields: QueryFieldDef[]`. These are an array of

* Computations just like in `FieldDef` with `Expression` proeprties, which came from either `select:`, `group_by:`, `aggregate:` or `calculate:`
* `QueryFieldReference` which is just a path, which is inferred to be one of the above, on context
* `nest:` invocations (or 'turtles' as we affectionately call them internally)