A reference to a value parameter will produce

    { type: "value parameter", path: "parametername" },

 reference to a condition parameter ... thinking ...

    someExpr : someCondition

we have to compile a condition to a predicate function which takes the LHS as an argument, so what does a reference to a predicate
expression look like ...

    {
        type: "apply parameter expression",
        lhs: [ "SQL from someExpr" ],
        path: "paramName",
    }

So these are the same except for the left hand side for the condition, we could try putting them in the same interface

    interface ParameterFragment {
        type: "parameter";
        path: string;
        conditionValue:? Expr;
    }

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
