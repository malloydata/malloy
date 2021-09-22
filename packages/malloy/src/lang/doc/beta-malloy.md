# The problems ...

We are calling the current malloy alpha-malloy, we are defining beta-malloy.

The structure free word salad that is alpha-malloy is designed to be as free of punctuation as possible, following a design principle intuited from SQL, to attempt feel familiar to SQL users.

This experiment has produced a lovely small language, but when presented to experience SQL users, there are a few bumps.

1. SQL people look for hints in the SQL to reveal structure, for example the explicit "group by" helps define the query space and the implicit group by in malloy hides an important detail.
1. (similar to the above) clear distinction between aggregates and grouping
1. filter syntax, while short and readable, is also problematic
1. pipes aren't quite right for expressing the "activate query" gesture
1. query / explorable-thing split is unclear, what is a "space"
1. "turtle" is a problem for everyone except michael and lloyd

# One Proposal

In conversation with data-science SQL users, we learn that they mostly know how to read SQL, Python, and JSON. This raises the interesting possibility of going back to a more LookML inspired syntax. The new tao would be something like

> _... leveraging these two languages we use SQL-familiar words to describe SQL concpepts, but use JSON to make clear the structure of the model that SQL would make hidden_

## Farewell Space Turtles

The thing which queries start from, like in LookML, is called an "explore".

The thing which is a query, is called a "query".

The word "space" which we started throwing around to distinguish between and explore that was a query and and explore which was something which could be queried is now superfluous.

A "turtle", meaning a query declared in an explore, is now is just "a query declared in an explore".

A "turtle", meaning a query nested in a query, is now just a "nested query".

## Basic Declaration Form

The basic declaration form on alpha-malloy was evolving into

    NAME is TYPE type-specific-value

The beta-malloy LookML-ish syntax would have one of two forms.  For a single declaration like the one above it would simply be

    TYPE: NAME type-specific-initializer

as in these statements ...

    explore: flights is 'malloydata.faa.flights' { primary key: id }

    join: things is thing_table on thing_id

    primary key: id

    group by: state, county


but will also allow groups of similar types of named objects to be declared with

    TYPE: {
        NAME1 type-specific-initializer
        NAME2 type-specific-initializer
    }

which will allow grouped blocks of dimensions or joins where that adds readability to a large model

## Refinement gesture

Creation of explores in malloy is always a gesture of refinement based on existing object where the simplest object is a table. For example we want `flights` to mean the `malloydta.faa.flights` table ...
```
   explore: flights is 'malloydata.faa.flights' {
       primary key: id
       ... other flights stuff
   }
```
In beta-malloy any time you name a refineable object you can create an enhanced or extended version of the object simply by following the name with the `{}` enclosed set of additional properties.

As an example ... this ...

    explore: carriers is 'malloydata.faa.carriers' { primary key: id }
    explore: flights is 'malloydata.faa.flights' {
      join: carrier is carriers on carrier_id
    }

... can be written without having to create an explore for carriers by writing the enhancement inline in the join ...

    explore: flights is 'malloydata.faa.flights' {
      join: carrier is 'malloydata.faa.carriers' { primary key: id } on carrier_id
    }

This is similar to how alpha-malloy works, except this syntax is more regular and less dependant on special case exceptions in the grammar.

## Declaration vs. Invocation

Since an "explore" is not a query but a declaration it also contains declarations of dimensions and measures, which in this new syntax must be declared sperately

    explore flights is 'malloydata.faa.flights' {
        dimension: long_flight is dep_time + 1 hour > arr_time
        measure: flight_count is count()
    }

## Farewell `reduce`

A query is either a grouping/aggregating gesture, which would look like this ...

    query: by_carrier is {
        group by: carrier.nickname
        aggregate: flight_count
    }

... or a detail-gesture like this ...

    query: flight_details {
        project: carrier.nickname, flight_num, dep_time, arr_time
    }

A `group by` or a `project` have a list of references, or new dimensions.  An `aggregate` has a list of measures or new measure definitions. The alpha-malloy `reduce` query is a query which starts with `group by:` and a `project` query starts with `project:` but both are just queries.

## Farewell `|`

The pipe symbols is removed from the language. In an explore definition, there can not be a chain of queries, there is only the declarations of filters, joins, dimensions, measures, and queries.

## Filters are `where:` and `having:`

The magic `: []` syntax for filters is gone. An explore or a project query can have a `where:` property, and an aggregating query can have a `where:` and a `having:`. The value is still a `[]` bracketed, comma seperated list of malloy expressions.

    explore: flights_21st_century is flights {
      where: [ dep_time >= @2001 ]
    }

## Query syntax (the `->`)

There is an operator, `->`, which as a left hand side takes en explore and for the right hand side takes a query definition ...
```
    -- Invent a new query ... by running it ...
    flights->{
        group_by: carrier.nickname
        measure: flight_count
    }
```
```
    -- Invoke a query
    flights->by_carrier
```
```
    -- Invoke a refined query
    flights->by_carrier {
        aggregate: long_flights is flight_count { where: arr_time > dep_time + 1 hour }
    }
```
```
    -- Save redefined query as a top level item
    query: long_flights_by_carrier is flights->by_carrier {
        aggregate: long_flights is flight_count { where: arr_time > dep_time + 1 hour }
    }
    -- above will have a run button ...
    -- TBD: How I invoke a top level query in the scratch query
    -- space of a malloy file like the above invocations
```

## { where: ... shorthand }

Because filtering is ubiquitous, there is a shorthand for filtering. We expect authors of models to use `where:` and `having:` for clarity, but for people writing queries there is a shorthand which is as terse as the alpha-malloy `: [ FILTER1, FILTER2 ]` but which feels like a natural shortcut based on existing syntax in beta-malloy ...

    -- long form
    flights {
        where: [ dep_time: @2003 ]
    }->by_carrier

    -- one line version
    flights { where: [ dep_time: @2003 ] }->by_carrier

    -- short form
    flights {? dep_time: @2003}->by_carrier

    -- filtered measures
    measure: pct_in_ca is (count() {? state: 'CA'}) / count()

## What about turtles ...

Nested queries are declared in an explore with the `query:` keyword ...
```
explore: flights is 'malloydata.faa.flights' {
    ...
    query: by_carrier is {
        group by: carrier.nickname
        aggregate: flight_count
    }
}
```

And to include a nested query in a result set, much like the `aggregate:` keyword accepts existing names measures, or allows new measures, there is a `nest:` keyword to nest a query ...

    explore: flights is 'malloydata.faa.flights' {
        ...
        query: airport_dashboard is {
          group by:
            code is destination_code,
            destination is destination.full_name
          aggregate:
            flight_count
          nest:
            carriers_by_month, routes_map, delay_by_hour_of_day
        }
    }

## Explore from Query

Because an explore can no longer have a `| reduce` in the definition, there needs to be a syntax meaning "the explore which starts with the result of this query". This would be indicated when, anywhere an explore name is legal, to use `(` _QUERY_ `)` for example.

    -- given this explore ...
    explore: users is 'schema.users' {
        ...
        join: orders on orders.user_id
        query: user_order_facts is {
            group by: user_id
            aggregate:
                lifetime_value is sum(orders.value)
                orders.order_count
        }
    }

    -- ... make user->user_order_facts a top level entity for joins etc
    -- but add new dimension
    explore: user_order_facts is (users->user_order_facts) {
        dimension: super_user is lifetime_value > 1000
    }
