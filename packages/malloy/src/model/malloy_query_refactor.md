# First Pass Re-Factor of malloy_query.ts

While I have managed to carve out some pieces, there is still work to do, so this should be seen more as a progress report than as document of the intended end state.

While some of these data structures are less tangled now, they are still too tangled. There is not clairity in the distinction between a QueryField and a FieldInstanceField. Or between a Query and a PreparedQuery, because these are all not quite correctly factored. This first pass should make subsequent passes easier.

Roughly, the "compiler" breaks down into six main pieces ..

* **malloy_types.ts**: This defines the IR which the translator generates and which the compiler reads to write queries.
* **query_query.ts**: The "Query Compiler", which knows how to write SQL statements for Malloy queries. This isn't named well and it becomes especially bad when you talk about a QueryQueryQuery. This file is still quite large (almsot 3K LOC) and probably needs another look at it's interior structure.
* **expression_compiler.ts**: The "Expression Compiler", which knows how to, in a query, translate an expression from IR to SQL
* **query_node.ts**: A live interface the data stored in structdefs and fields
* **field_instance.ts**: While the query compiler uses query nodes to "instantiate the model", the query itself is built out of "FieldInstance" nodes most of which are created from a query node, but these contain state relating to the translation. The naming isn't great, and the split in responsibilities between query_nodes and field_instance nodes is not consistent or correct, leading to some problems.
* **composite_source_utils.ts**: Dumping ground for the algorithms used to create and process the fieldUsage data from the tranlsator. Expectations are that this will eventually have cleaner interface than then current export list.

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

## the death of addDependentExpr()

The other piece of work, which made the above piece of work much easier, was to change how
the compiler gathers the metadata about the query it needs to make it's very complicated decisions.

Previously there was a method "addDependenetExpr" which could be called on FieldInstanceResult and it would example the context of that Expr (the IR for expressions) and look for, and reflect into the naescent query, any information with the query writer would need. In QueryQuery.prepare() a piece of code very carefully walked all the places expressions could live (fields, join clauses, join filters, where causes, ordering clauses, etc) to find all the important information.

Now, as the translator build up a query, it collects all that information, summarizes it to a data structure in the query. QueryQuery.prepare still sets the resulting information into the FieldInstanceResult and FieldInstanceField data, but it is a fairly simple function instead of a complex re-examination of the entire query.

However, getting the right data into the query, and setting in properly in the FieldInstance nodes was quite complex and difficult, partially because the fieldUsage mechanism this uses was designed for composite source resolution and this may have stressed that system enough that it now needs a re-write.

# The Future

## Breaking up QueryQuery

There is a loading of a Query, where Query is node in QueryTree ... and then there is the thing that happens in QueryQuery.prepare ... and I think that this is an instantiation of a QueryCompiler, and QueryCompile/FieldInstance/FIeldInstanceResult exist and represet a query translation state and Query/QUeryField/QueryStruct all exist and represent an interface to the OR entities which make up the query.

Also there are naming problems which would be cleaned up, once the QueryCompiler node tree was coplete.

## Cleaning up fieldUsage

There needs to be better support for someone wanting to add new things to be tracked through the usage process.  Probably an extensible class which knows how to summarize and merge "informaiton about an expression" without anyone having to know the details about what is inside the expression meta data structure