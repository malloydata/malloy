# `StructDef`

The most basic `StructDef` is a namespace. `StructDef`s are turned into "FieldSpaces" in the translator pass and into either "Explores" or "QueryStructs" in the compiler pass. These are then used to understand path based field references.

```TypeScript
interface StructDefBase extends HasLocation, NamedObject {
  type: string;
  annotation?: Annotation;
  modelAnnotation?: ModelAnnotation;
  fields: FieldDef[];
  dialect: string;
}
```

> [`FieldDef`](fielddef.md) has an explainer page too.

Some StructDefs are also sources, and to be a source, they need some additional properties

```TypeScript
interface SourceDefBase
  extends StructDefBase, Filtered, ResultStructMetadata
{
  arguments?: Record<string, Argument>;
  parameters?: Record<string, Parameter>;
  queryTimezone?: string;
  connection: string;
  primaryKey?: PrimaryKeyRef;
}
```

A record, for example, is a structdef which is not a source, and doesn't have the properties required in a source,
but it is a namespace, so it is a StructDef but not a SourceDef, this isn't REALLY what a record struct def looks like,
(more on the later) but at this point in the document, pretend it is

```TypeScript
interface RecordDef extends StructDefBase {
    type: 'record';
}
```

> Confession: The `type:` namespace for structs and fields is merged. Not every struct is a field, not every field is a struct, but there are entities which are both structs and fields. Old Malloy "All structs are legal in field lists",
new Malloy is explicit about which are legal, but I didn't want to add two discriminators "structType" and "fieldType" for the many items which are both structs and can be in field lists.

## Simple Table

This simple table with two columns ...

```SQL
CREATE TABLE 'malloydata.simple_table'
   stringField STRING,
   intField INTEGER;
```

... as a `StructDef` ...

```TypeScript
interface TableSourceDef extends SourceDefBase {
    type: 'table';
    tablePath: string;
}

const simpleTable: TableSourceDef = {
    type: 'table';
    tablePath: 'malloydata.simple_table';
    connection: 'bigquery';
    dialect: 'standardsql';
    fields: [
        {name: 'stringField', type: 'string'},
        {name: 'intField', type: 'number', numberType: 'integer' },
    ]
}
```

### Simple Table, with a record

Let's start by making a record which looks a like a row of `malloydata.simple_table`

```TypeScript
const simpleRecord: RecordDef {
    type: 'record',
    dialect: 'standardsql',
    fields: simpleTable.fields
};
```

> Note that a record needs to have a dialect, because there often expressions in
> field lists and the dialect is needed in the compiler still, in a variety of
> places, when constructing name spaces. It was simpler to make every struct def
> have a dialect than to make every struct def have a way to find it's parent

Now lets make a table which has that record ...

```TypeScript
const table2: TableSourceDef = {
    ...simpleTable,
    fields: [
        {
            ...simpleRecord
            name: 'recordField',
            join: 'one',
            matrixOperation: 'left'
        },
    ],
}
```

> Everything which is treated like a join by the IR has a `join:` field. All records are joined, so every record in a field list will have a `join:` keyword. So a non-repeated record is actually
```TypeScript
interface NonRepeatedRecordStruct extends StructDefBase, JoinBase {
    type: 'record';
    join: 'one';
    matrixOperation: 'left';
}
```

## Arrays

A simple array of integers has a data type like this

```TypeScript
// An array is not always a struct, it can just be a data type, so it does NOT extend StructDefbase
interface ArrayTypeDef extends NamedObject {
    type: 'array';
    dataType: FieldAtomicType
}

// If an array is joined, so it un-nests, is a StructDef, it will look like this
interface ScalarArrayStruct extends ArrayTypeDef, StructDefBase, JoinBase {
    type: 'array'
    dataType: FieldAtomicType,
    join: 'many'
    matrixOperation: 'left'
};
// fields[] will be filled out at some point, probably by the schema reader like it is
// in the current schema readers
```

## Table with two arrays, one joined

```TypeScript
const intType: NumberTypeDef = {type: 'number', numberType: 'integer'};
const arrayOfInts: ArrayTypeDef = {type: 'array', dataType: intType};
const table3: TableSourceDef {
    name: 'table3',
    dialect: 'standardsql'
    tablePath: 'malloytest.table3',
    connection: 'bigquery',
    fields: [
        {name: 'un_joined_ints', ...arrayOfInts}, // Just a name and a type, not a struct, no fields
        {
            name: 'joined_ints',                  // This will be a ScalarArrayStruct
            ...arrayOfInts,
            join: 'many',
            matrixOperation: 'left',
            dialect: 'standardsql',
            fields: [{name: 'each', type: intType, e: {node: 'array_unnest', arrayName: 'joined_ints' }}],
        }
    ]
}
```

## Table with repeated records

Repeated records are represented as an array of records. The fields array of a repeated record is
the schema for each row, just as it is for a non-repeated record.

```TypeScript
interface RepeatedRecordStruct extends ScalarArrayStruct {
    type: 'array'
    dataType: 'record'
}
```

Which, when joined into a table would look like this ...

```TypeScript
const table4: TableSourceDef {
    name: 'table4',
    dialect: 'standardsql'
    tablePath: 'malloytest.table4',
    connection: 'bigquery',
    fields: [
        {name: 'eachRowHasAString', type: 'string' }, // StringTypeDef & FieldDefBase
        {                                             // RepeatedRecordStruct & FieldDefBase
            name: 'eachRowHasARepeatedSimpleReord',
            type: 'array',
            dataType: 'record',
            join: 'many',
            matrixOperation: 'left',
            dialect: 'standardsql',
            fields: simpleRecord.fields,
        },
    ],
};
```

## All the struct defs

```TypeScript
type SourceDef =
    | TableSourceDef
    | SelectSourceDef       // CONNECTION_NAME.sql("SELECT ....")
    | QuerySourceDef        // A query as a source, contains the query
    | QueryResultDef        // The computed output schema of a query without the query
    | NestSourceDef         // Special input to a nested query
    | FinalizeSourceDef;    // Use to re-write final stage of PostGres queries

type StructDef =
    | SourceDef
    | NonRepeatedRecordStruct
    | ScalarArrayStruct
    | RepeatedRecordStruct;
```
