# Shape Definition

A shape is a data source and a list of additional properties which
extend the original source in preparation for a
passing it to a transformation stage.

* shape: _source_ fields _joins_

## Source

A source can be an existing SQL table or view, or it can  be
a Malloy query, which can either be defined in line,
or referenced by name (see the [Models](statement.md)
section for more information on that)

A shape can be filtered, it can be given a `primary key` so it can be 
used in a join, and a shape may select some or all of the fields in
the _dataSource_ to be included or excluded from the shape.

* source: _dataSource_ _filters_ _primaryKey_ _fieldEdit_
* dataSource: `'` _table_ _name_ `'` | `(` _query_ `)` | _query_ _name_
* _primaryKey_: `primary key` _fieldName_
* _fieldEdit_: ( `accept` _fieldNameList_ | `except` _fieldNameLlist_ )

## Joins

The `joins` section of a shape is the keyword `joins` followed by a list of
join specifications..

* joins: `joins` _joinSpec_ ...

### Join Keys

One of the entities being joined must have a primary key. If you
specify a bare field name as a _keySpec_ then the primary key
for the join will come from the entity being joined. If you
specify a field in the join, `joinName.some_id` then the
primary key of the shape will be used to complete the join.

### Join Specifications

* _joinName_ `on` _keySpec_
* _joinName_ `is` _existingName_ on _keySpec_
* _joinName_ is `(` _query_ `)` on _keySpec_

