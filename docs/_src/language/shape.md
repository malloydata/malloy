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

The tables joined to a shape are an important aspect of its definition. Read more about joins [here](join.md).