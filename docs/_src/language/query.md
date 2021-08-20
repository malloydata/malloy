# Queries in malloy

The basic syntax for a query in Malloy consists of a [_shape_](shape.md)
and a "pipeline" of or more _stages_ seperated by a vertical bar,
the data defined in the original shape is transformed by each stage.

* query: `explore` [_shape_](shape.md) | _stage_ [ | _stage_ ... ]

## Pipeline

A pipeline transforms a shape, and is made up of a series of stages. A [Turtle](turtles.md)), which has a pipeline
inside of it, can be the first stage in a pipleline


* stage: _turtleStage_ | _normalStage_
* turtleStage : _turtleName_ [_filters_](filters.md)
* normalStage : ( `reduce` | `project` | `index` ) [_filters_](filters.md) _ordering_ _fields_

## Fields

In a shape (not in a stage), a field can be renamed.

* _newFieldName_ `renames` _existingFieldName_

In a shape, and in a stage, a new field can be introduced. Refer to the
[Expressions](expressions.md) page for more information on
Malloy expressions.

* _field_ _name_ `is` _expression_

You can also define a [turtle](turtles.md). Just as in a query,
only the first of a turtle pipeline can be the name of another turtle.
The keyword `turtle` is optional,

* _turtleName_ `is` `turtle` `(` _normalStage_  `|` _normalStage_ ... `)`

In a stage, it is also legal to simply list field names
which should be passed on from the previous stage to the next one.
Simple wildcard expressions `*`, `**`, and _joinName_.`*` are
legal in these lists

* _fieldNameOrWildCard_ [ `,` _fieldNameOrWildCard_ ... ]

