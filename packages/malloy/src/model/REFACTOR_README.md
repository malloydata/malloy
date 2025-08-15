# A Eulogy for malloy_query.ts

Once upon a time, the entirety of the Malloy IR to SQL compilation lived in one file: malloy_query.ts.
This code is quite complex and the relationships between the components are interconnected, and Typescript
is not happy circular references between objects, this was expedient during the early days of Malloy development.

We are in the process of re-factoring the compiler to be in cleaner pieces, and mallou_query.ts is no more.
While some of these data structures are less tangled now, there is still a lot of room for improvement.

Roughly, the "compiler" breaks down into six main pieces ..

* **malloy_types.ts**: This defines the IR which the translator generates and which the compiler reads to write queries.
* **query_query.ts**: The "Query Compiler", which knows how to write SQL statements for Malloy queries. This isn't named well and it becomes especially bad when you talk about a QueryQueryQuery. This file is still quite large (over 2K LOC) and probably needs another look at it's interior structure.
* **expression_compiler.ts**: The "Expression Compiler", which knows how to, in a query, translate an expression from IR to SQL
* **query_node.ts**: A live interface the data stored in structdefs and fields
* **field_instance.ts**: While the query compiler uses query nodes to "instantiate the model", the query itself is built out of "FieldInstance" nodes most of which are created from a query node, but these contain state relating to the translation. The naming isn't great, and the split in responsibilities between query_nodes and field_instance nodes is not consistent or correct, leading to some problems.

## Modularity and Circularity

The first big piece of work to achiecve this involved deciding on the pieces, and then resolving the circular references between the pieces which were legal when they all lived in the same file and became a problem when they were split into seperate files.

A number of techniques were used to accomplish this

1) Using "Interface/Implementation" splits.
2) Dependency Injection
3) Moving methods from one "realm" to another

This results in a carefully managed set of relationships between these sub components, and maybe
this should be formalized by plaving each component in a sub directory, but I am not certain the components are correct yet

index.ts is the root for external users of this directory and it includes everything in the proper order and resolves the dependency injection.

Interally there are rules about which files are allowed to include other files, it is very likely you will cause circular dependency errors if you change the relationships between files.

I think the rules are something like this.

* query_query includes everything
* expression_compiler includes field_instance and query_node
* field_instance includes query_node
* query_node can't include anything, it needs to be leafy

If you break the rules, tests in test/src/core/dependencies.spec.ts will fail and you have some thinking to do.

## the death of addDependentExpr()

The other piece of work, which made the above piece of work much easier, was to change how
the compiler gathers the metadata about the query it needs to make it's very complicated decisions.

Previously there was a method "addDependenetExpr" which could be called on FieldInstanceResult and it would example the context of that Expr (the IR for expressions) and look for, and reflect into the naescent query, any information with the query writer would need. In QueryQuery.prepare() a piece of code very carefully walked all the places expressions could live (fields, join clauses, join filters, where causes, ordering clauses, etc) to find all the important information.

Now, as the translator build up a query, it collects all that information, summarizes it to a data structure in the query. QueryQuery.prepare still sets the resulting information into the FieldInstanceResult and FieldInstanceField data, but it is a fairly simple function instead of a complex re-examination of the entire query.

# The Future

## Breaking up QueryQuery

There is a loading of a Query, where Query is node in QueryTree ... and then there is the thing that happens in QueryQuery.prepare ... and I think that this is an instantiation of a QueryCompiler, and QueryCompile/FieldInstance/FIeldInstanceResult exist and represet a query translation state and Query/QUeryField/QueryStruct all exist and represent an interface to the OR entities which make up the query. However even the most expensive LLM, when the problem is patiently explained, isn't smart enough
to do that.

Also there are naming problems which would be cleaned up, once the QueryCompiler node tree was coplete.