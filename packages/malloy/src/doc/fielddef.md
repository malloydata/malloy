# `FieldDef`

A [`StructDef`](structdef.md) has an array of `fields: FieldDef[]`

`FieldDef` as described here is slightly simplified from the actual implementations, but this is exactly how everything works.

> Older version of Malloy have these same types, but the taxonomy was obscured by some historical artifacts in the way things were named. New Malloy has attempted to clean up the naming to make it consistent and more concise.

## Atomic fields (`AtomicTypeDef`)

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

* `isAtomicTypeDef(fd)` -- Returns true if the `type:` of this fielddef matches one of the atomic types

## Dimensions and Measures and Calculations

A computation looks like an atomic field in a field list, it has an atomic type, but it will also implement `Expression` which will have the definition of the computation

```TypeScript
interface Expression {
  e: Expr;
  expressionType?: ExpressionType;
  code?: string;
}
```

* You can identify a `FieldDef` which is computed by asking `hasExpression(fd: FieldDef)` this will return true and grant typed access to the `Expression` if the entry is a dimension, measure (or calculation actually).

## Join tree entries

For any entry which participates in join treee (joined table, joined query, array, record(s)) in the field list, the `FieldDef` for that entry will also have properties from `JoinBase`

```TypeScript
interface JoinBase {
  type: JoinElementType;
  join: JoinType;
  matrixOperation: MatrixOperation;
  onExpression?: Expr;
}
```

* `isJoined(def)` which will return true and grant typed access to the `JoinBase` properties of the object, and because all joined fields are structs, also the `StructDef` properties as well.

## Views

The other entry in a field list is a `view:` which in the source is `{type: 'turtle'}`

## All the FieldDef

# QueryFieldDef ...

Once upon a time queries also had an array called `fields:` which contained a slightly different set of field-like entities. For a while now this has not been true. A query has `queryFields: QueryFieldDef[]`. These
are an array of ...

* Computations just like in `FieldDef` with `Expression` proeprties, which came from either `select:`, `group_by:`, `aggregate:` or `calculate:`
* `QueryFieldReference` which is just a path, which is inferred to be one of the above, on context
* `nest:` invocations (or 'turtles' as we affectionately call them internally)
* `join_XXX:` always on query joins


## Discriminators

* `isTemporalType` -- `date` or `timestamp` type
* `isAtomicFieldType` -- Does type string match the type of one of the atomiv types
* `isRepeatedRecord` -- In some databases this is a type, in other this is an array of record
* `isBasicArray` -- Is a ".each" array
* `isAtomic` -- Like `isAtomicFieldType` for `FieldDef` instead
* `isBasicAtomic` -- an Atomic field can be stored in a column, a BasicAtomic is one which isn't a join