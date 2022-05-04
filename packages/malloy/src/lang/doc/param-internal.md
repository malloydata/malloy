# The Big Plan

Landmarks on the road to a "fully parameterized Malloy" would be.

## Phase 0

1) Exploreable items can require filter definition to limit the size of a query
2) Explorable itmes can have an optional filter definition to limit the size of a query

## No assigned phase

* Measures with parameters
* Turtles with parameters
* Normal constant parameters at least at the outermost (model) scope, but possibly also at the explorable, measure, and turtle scopes.

### Possibly on the plan

* Because these are a LOT like functions, maybe there is a ways to write parameterized expressions at some level other than the field expressions, maybe even up at the level where we declare explorable items, then very likely these "functions" or paramterized expressions are declared and instantiated with the same gestures all of the above items use.


## Phase 0+

It is not much additional work to move constant parameters into the phase zero, inside and explore, and so even though  constant parameters are not in the MVP for parameters, they are part of the MVP design

# Syntax

Trying to make something which feels lke Malloy. Malloy inherits from SQL a strong preference for keyword based, rather than punctuation based structure. It is an interesting experiment to at least try and stretch that into parameters, even though to an experienced programmer these things feel a lot like functions declarations and function calls, which use parentheses to mark them out.

There are many possible syntaxes listed below, obviously only one will eventually be chosen, but as progress is happening, the reasons for choosing one way of expressing parameters are changing also, so it had turned out to be important to sort of have a record of all the choices.

## Declaration

Here's the current choice for a declaration block which declares one of each time of parameter: required condition, optional condition, required value, optional value, and constant.

We are wrapping this in parentheses because there is no good invocation syntax which does not use some sort of bracketing.

    define thingWithParams(
      has reqCondition : timestamp
      has optCondition : timestamp default @1960 to @1970
      has reqValue timestamp
      has optValue timestamp default @2001-09-11
      has constValue @1969-07-20 12:56
    ) is ('project.schema.tableName'
        ...
      )

What follows is all the thinking which led to this ...

---

`has` before an `is` indicates a parameter. The type or the parameter is next, which is either just a type name if this is a constant, or a typename followed by the word `condition` for a filtering parameter.

Optional parameters are indicated by providing a default value to be used when the parameter is not specified ...

    -- TYPENAME is "string", "number", "date", "timestamp", etc.
    define thingWithParams
      has optCondParam TYPENAME condition VALUE
      has reqCondParam TYPENAME condition
      has optValueParam TYPENAME VALUE
      has reqValueParam TYPENAME
      is ( ... )

### Default vales for optional parameters

The default value just hanging out there at the end of the declaration as the indication that a parameter is not required is not super great. It reads a little like a run on sentence.

Not sure what I want to do about that ... I kind of have rejected the Typescript answer of use `=`

    has someThing string "groovy"
    has someThing string = "groovy"
    has someThing string or "groovy"
    has someThing string default "groovy"
    has someThing (string "groovy")

The use of `or` is intriguing, it scans pleasantly.

### Constants vs. optional parameters

Recent realization that the long running asumption that constants are kind of the same thing as optional parameters is actually incorrect. Something intended to be a constant should NOT be changable by a user ...

    define analyzeSomething
      has y2k_begin timestamp @2000-01-01 00:00:00

There needs to be some way to express that it is NOT approriate to provide a new value for `y2k_begin`, something like ...

    define analyzeSomething
      has optionalT timestamp or @2000-01-01 00:00:00
      has constantT1 timestamp always @2000-01-01 00:00:00
      has constantT2 @2000-01-01 00:00:00

### Replace the word "condition" with a ":"

Becauase that is how it would be dereferenced, maybe it
totally makes sense to declare it that way ... something like

I am not sure how will this would read for required values which are conditions ...

    define thingWithParams
      has reqTime timestamp :
      has optTime timestamp : @2003

That ':' hanging out there all by itself looks like a syntax error.

### Musing about `has`

`has` grew out of the pair `requires` and `has` as a way to declare an optional or require parameter. The way that `has` sit's with `is` read very well. The sentence-like scanning left to right "the definition of foo has these parameters and is this" feels pretty good and there is a way to indent it that also looks good.

However it is a departure from the "_name_ `is` _type_ _value_" template. I have my eye on this problem and am looking for reasons to make the the number one design principle for the syntax.

Here's an attempt with that in mind.

    define thingWithParams
      reqTime is required : timestamp
      optTime is optional : timestamp or @2003
      reqVal is required timestamp
      optVal is optional timestamp
      is ( ... )

This would need parentheses around declarations in measures, though not things that have field lists. , with `is` in invocations to seperate that from the definition, since that is an "is" also.


### has block, kind of like paramter lists ...

    define thingWithParams

      has
        reqCondition : timestamp
        optCondition : timestamp or @1960 to @1970
        reqValue timestamp
        optValue timestamp or @2001-09-11
        constValue @1969-07-20 12:56

      is ('project.schema.tableName'
        ...
      )

This has a nice conciseness but the complete lack of keywords in each individual parameter declaration makes each block unreadable ... this might work better with the keywords from the "is style" above ...

Also the "has" followed by a list really makes it feel like each element in the list should have a comma, as opposed to inside an explore, where each field definition is more like a statement

    define thingWithParams

      has
        reqCondition required : timestamp
        optCondition optional : timestamp or @1960 to @1970
        reqValue required timestamp
        optValue optional timestamp or @2001-09-11
        constValue const @1969-07-20 12:56

      is ('project.schema.tableName'
        ...


### Rejected for sure ...

You could move the parameter declarations inside the explore, since they match the syntax for statements inside an explore head ... The good thing about this is they are physically declared in the same textual unit where the namespace the exist in is defined. (something which is not true for programming languages)

    define thingWithParams is (
      'project.schema.thingTable'

      reqTime is required : timestamp
      optTime is optional : timestamp or @2003
      reqVal is required string
      optVal is optional timestamp

      : [ thingTme : reqTime ]

      ...
    )

The problem with this is that in a quick scan of a file, it isn't easy to see the parameters if their declarations are hidden inside the explore body.

## Invocation

See below, there needs to be bracketing around an invocation with values

    thingWithParams(
        reqTime is @2003
        reqVal is "word"
    ) | thingTUrtle

### No new syntax ...

Maybe invocation is as simple as a few "is" statements and then the pipe ...

    explore thingWithParams
     reqCondParam is value
     reqValueParam is value
    | reduce
        ...

This is problematic though because this syntax is not distinguishble from a simple extension of the explore, and so all the error checking on this would have to happen in the semantic pass, which feels fraught.

### Some word to signify the parameter list ...

`given` is placeholder word ... but something like:

    explore thingWithParams
     given
       reqCondParam is value
       reqValueParam is value
    | someTurtle

This doesn't work if I want to extend and provide parameters, for the same reason the "no new syntax" doesn't work, there is no way to tell the end of the list of "is" statements. We don't need a syntax marker leading into the parameter value list we need one leading OUT of the parameter list.

### Some bracketing of the parameter list ...

Brackets of any kind solve a lot of problems

    explore thingWithParams
     {
       reqCondParam is value
       reqValueParam is value
     }
     | someTurtle

Any bracketing would change the declaration syntax, they need to look kind of like each other so all the "has" stuff would be off the table.

### bracketing, but something like : []

    explore flights : { dep_filter is @2003 } : [ arr_time : @2004 ]

Super punctuation salad, do not like

### prefix before the explore

    given
      a is ...
      b is ...
    thingWithParams
        : [ some: Filter ]
    | thingTurtle

    given dep_filter is @2003 explore flights | by_carrier

Not a favorite, the `given` keyword opbscores the `explore` keyword, is this a "given" statement or an "explore" statement. The left most keyword of an explore needs to be explore.

### the "is" statements come after "explore" and before the exploreable

    explore
      a is ..
      b is ...
    thingWithParams
    | thingTurtle

Works ok with a keyword, totally breaks in a keywordless expression ...

    a is ..
    b is ...
    thingWithParams
    | thingTurtle

## Logical Conclusion ...

The entities are the exploreSource, paramList and the exploreDef

    EXPLORE exploreSource exploreDef
    exploreSource exploreDef

    exploreSource(paramList)

Any keyword based solution would have to look like this because the beginning has to "EXPLORE exploreSource" and there needs to be an indicator to mark that the paramlist is not a field list, and an indicator to end the param list before the field list ...

    EXPLORE exploreSource KW paramList KW exploreDef

I guess we could require, for someone who wants params and fields ...

    (exploreSource KW paramList) exploreDef

But that is never going to feel as natural as "all parameter blocks have
the same grouping syntax around them"


## Parentheses around parameter lists ...

If you want this to look like a function call, parentheses can placed around the parameters, this could be optional syntax.  Commas between parameters will probably need to at least be optional because these look more like lists rather than commands and people will try and use commas.

### Is in define statements with parentheses

Not sure I like `is` in params, the sentence is describing a requirement, not a computation, but it would be something like this ...

    define thingWithParams(
        reqCondParam is required timestamp conditional
        optValue is timestamp @2003
    )

### Has in define statements with parentheses

`has` reads a little different in parens, the result doesn't scan quite as naturally for some reason.

    define thingWithParams(
        has reqCondParam timestamp conditional
        has optValue timestamp @2003
    )

This makes me thing there would be a different word, maybe this is where `requires` appears? Something like ...

    define thingWithParams(
        requires reqCondParam : timestamp
        uses optValue timestamp or @2003
    )


### Invocation with parentheses

Invocation with `is` ... seems to scan pretty naturally

    explore thingWithParams(
     reqCondParam is value
     reqValueParam is value
    ) | thingTurtle

# Internals

A reference to a value parameter will produce an expression fragment which looks pretty much exactly like a field name reference, except it is marked as a parameter reference ...

    interface ParameterFragment {
        type: "parameter";
        path: string;
    };

 For condition valued parameters we need to be able to compile the condition to an expression, and then somehow apply the runtime value to that condition.

    define xflights
        has dep_filter timestamp condition @2003
        is (explore flights : [ dep_filter ]);

Needs to make a structdef, and the default value of that filter needs to expand `@2003` to a range test, like it would if it had been the right hand side of a `?` in an expression.

```javascript
{
 type: "struct",
 parameters: {
     dep_filter: {
         name: "dep_filter",
         type: "timestamp",
         condition: [
            // XXX This is the condition expression
         ]

     }
 }
}
```
But then what does a compiled predicate expression look like, for for a default value, or for a query time provided value?
Well, that is essentially a function which takes an argument and substitutes the passed in as the value of the argument.

so "> 10 & < 100" would compile to something like

    [{ type: "$" }, "> 10" and ", { type: "$" }, "< 100" ]

And there would be, in the parameter namespace, an object like this ..

    interface ParameterDef {
        name: string;
        type: FieldAtomicType;
        value: Expr;
        isCondition: boolean;
    }

A reference to a value parameter will just copy the Expr from the parameterdef.

So what does this model compile to?

    export define hasp
      has reqVal number
      has reqCond timestamp condition
      is (explore 'thing'
        : [ thingTime : reqCond ]
        ratio is thingNumber / reqVal
        thing_count is count()
        trtl is (reduce thingName, ratio, thing_count)

The existence of the parameters needs to be in the structdef
so that when this model is loaded from an import, it can be
know about the need for parameters ...

```typescript
{
    type: "struct",
    name: "thing",
    as: "hasp",
    structSource: { type: "table" },
    structRelationship: { type: "basetable"},
    parameters: {
        reqCond: { type: "timestamp", isCondition: true },
        reqVal: { type: "timestamp" },
    }
    filterList: [
        {
            condition: [ ... ],
            source: "thingTime:reqCond",
        }
    ],
    fields: [
        {
            name: "ratio",
            type: "number",
            e: [
                { type: "field", path: "thingNumber" },
                "/",
                { type: "parameter", path: "reqVal" },
            ]
        }
    ]
}
```

And what does this query compile to?

    import "hasp.malloy"
    explore hasp(reqVal is 100, reqCond is @1960 to @1970) | trtl

Well it feels like a bundle of a name and a value is a reference, so maybe it is as simple as ...

```typescript
{
    type: "query",
    structRef: {
        type: "structref",
        name: "hasp",
        parameters: { ... },
    }
    pipeline: [ "trtl" ]
}
```

Except we are living in a world where at ANY depth inside a query there may be a required parameter which is not satisfied, and so the "structRef:" solution above ONLY resovles the references to the structref, and only works because the reference and the values are right next to each other in the source code.

In the case where deep inside hasp is a join which joins a joins which joins a join which requires a parameter, we need to somehow ship the
query with the parameter values.

It almost feels like instead of the "structRef" example here where each reference has the parameters, somehow the there is a tree of parameter values and the answers for those values are shipped with the query, and when the deep deep down resolover for the join asks for the parameter value, it somehow gets the answer from the parameter block that came with the query.

Assuming a reference is being resolved, the prioroty of value lookup is

1. First is there a value in the reference
2. Is there a value in the parameter declaration

So if we think of these as namespaces, the reference namespace is searched first before we search the definition namespace ... there would be more of a dynamic name space instead of a lexical namespace.

Still not entirely clear how that works ... what does the structdef which contains this look like?

```
   j1 is join thingOpt on thing
   j2 is join thingOpt(opt is @2002) on thing
   j3 is join thingOpt(opt is @2003) on thing

// =>

fields: [
    { as: "j1",
      name: "thingOpt",
      type: "struct",
    },
    { as: "j2",
      name: "thingOpt",
      type: "struct",
    },
    { as: "j3",
      name: "thingOpt",
      type: "struct",
    }
]
```

I guess thingOpt has a parameter block which must look like.

    { name: "opt",
      type: "timestamp",
      isCondition: true,
      value: [ ... ]
    }

And when I am writing the structdef for the join to rename the join I can fill in the value from ther reference, because these are references in joins.

The question is where are all the places that a named thing can be referenced

1) In a join
2) In a query head
3) In a define statement


The bigger question is, for other things which can have parameters ( turtles and measures ) where do the parameter blocks sit for references and for declaration. In this case every reference is kind of a delcaration so copying the declaraiton into the reference isn't a problem, but maybe that isn't the case for the other parameterized things ?

And mahybe we don't care until then?

---

This morning the think that I need before I can start actually generating code for parameters is what constant predicate expressions look like as expervalues?

 The problem is they have two types, they really are of the form `Predicate<BaseType>`, so probably they should be stored ...

     type: "predicate";
     baseType: AtomicFieldType;

Which I am ok with. Then the only thing is what word to use for "predicate". One of these values is a template for an expression into which we insert a value. The "predicate" will generate a boolean based on the value passed in.

This is weird because I kind of rejected the word "predicate" for talking about this type for the end user and have been experimenting with "condition" there, except we already use the word "condition" to mean "one clause in a filter list", these would then be something like "partial conditions, "condition generators"

Actually I think ALL "partials" in malloy are actually predicates and the word "partial" should probably be scrubbed from the code and replaced with "predicate" ... going to take a swing at that this morning.

Ok yes this is a problem. I have this magic thing called "requestTranslation" which all non partials respond to which all partials do NOT respond to. The assumption is that if you ask an expression for a value, it will return a value unless it can't, but in the case of a dat predicate, we want `@2003` to return a predicate when used in a predicate context, so there needs to be a "request predicate" also ?

---

    EKW flights : [ dep_time: @2003 ]          | by_carrier
    EKW flights(dep_time_filter is @2003)      | by_carrier
    EKW flights{ dep_time_filter: @2003 }      | by_carrier
    EKW flights PKW dep_time_filter is @2003   | by_carrier
    PKW dep_time_filter is @2003 EKW flights   | by_carrier
    DKW (dep_time_filter is @2003) | flights   | by_carrier
    (flights dep_time_filter is @2003) | by_carrier
---

REMAINING TO DO ...

Predicates from partials
Provide values for params with a reference
Parameters and paths if joining a thing with parameters into a thing with parameters
Constants (override not allowed)

---

Here's one suite of declarations

    has reqCondition : timestamp
    has optCondition : timestamp or @2003 to @2010
    has reqValue timestamp
    has optValue timestamp or @2001-09-11
    has constValue @1969-07-20 12:56
