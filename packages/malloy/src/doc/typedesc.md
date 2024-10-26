# TypeDesc

## Types
Mostly in the translator, there is the need for more meta data about expressions than exists in a [FieldDef/QueryFieldDef](fielddef.md). `TypeDesc` is an extension of the type portion of a fielddef, which contains every type that a name lookup, or expression evaluation might result in.

In addition to `AtomicFieldType`s (which can be stored in a column), the other types which cannot be stored in a database column are:

* durations
* regular expression
* join
* view
* null

The `type:` field of a `TypeDesc` is in the same "type space" as [StructDef](structdef.md) and [FieldDef](fielddef.md), with the following weirdnesses

* A joined `SourceDef` will have it's `type:` field match the field version, but the `TypeDesc` will not include the definition
* A view will have `type: 'turtle'` but the `TypeDesc` will not include the definition
* An array or a record **will** include the type definition, because the schema of the contents is part of the type.

## Additional type metadata

A TypeDesc also has an `expressionType` and an `evalSpace` which are used by the translator to generate correct code and also catch a wide variety of errors.

## Other cousins

The types `Parameter` and `FunctionParamTypeDesc` can be used most places where a `TypeDesc` is accepted. A `FunctionParamTypeDesc` also can have an `any` type and a `Parameter` has a narrower set of types.

## TDU

`typedesc-utils.ts`, typically imported `* as TDU`, contains an number of utility functions for dealing with `TypeDesc` types, including pre-made typedescs for all the atomic types.

In previous versions, much of this functionality was accessed with the prefix `FT` which was a remnant of the days when sub expressions were called "fragments"