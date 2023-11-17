* A nest statement results in a `TurtleDecl` which is a subclass of `TurtleHeadedPipe`
* When one of these is added to a QOP field list, it creates `QueryFieldAST`
  * A `QueryFieldAst` is either a nest or a view
  * The `nestParent` of a `QueryFieldAST` this the `exprSpace` or input space of the QOP containing the nest statement
   * The `turtle` field of `QueryFieldAST` is the `TurtleDecl`
  * This should be called "NestDefinitionEntry"
  * The field should be called "nestedIn" not "nestParent"
  * The def should be "def: NestDefinition" not "turtle: TurtleDecle"
* When the QOP asks the QueryFieldAST for the FieldDef, it passes it's "nestParent" to `getFieldDef`
  * this is written into `turtleDecl.nestedInQuerySpace`
  * Should just be the queryspace, not the input space

So at this point the `nestInQuerySpace` parameter of a PipelineDesc is set only when compiling a turtle, and it is the INPUT space of the query operation
which contains the nest statement.

QOPDesc.getOp .. which creates a builder, is passed a pipeline

after creating a builder, if `pipeline.nestInQueySpace` is set,
it is copied to `builder.inpputFS.nestParent`

So at this point, every stage of a pipline in a turtle, has in the the inputFS.nestParent a pointer to the input space of the query that contains the pipeline.

When ungrouping IR is generated, i request to cvheck the output space later for every referenced field is also generated. At this time, space held
by getExpression is the output space.

Then, as a query is finalized, there is code to make sure fields mentioned in  ungrouping gestures actually exist, which first checks the output space of the current query, and then, if there is a nestParent, uses `this.expreSpace.nestParent.result` to find the OutputSpace of the query which contains the nest statement, and the that output space is queried for the variable in question.

To summaryize the need ..

when we mention an exclude field we need to know it is in the output space of some field involved in the query ... because we know this is NOT an index query, we would be safe checking the query field space right at that moment to see if it is in the queries output space, there is no need ( now that wildcards are done ) to defer that to finalize time.

Now the hard reasoning is, what about the walk up ... how do i do that correctly. The only hand present at getExpression time is the query space of the operation, which is the query space created in getOp, so it makes some sense that this is where the trampoline from the entry "QueryFieldAst" touches down. There is a little dance so that ONLY for query operations created for nests, to make the queryspace contianing the nest available to walk up.

If I am processing an exclude, I know that I am in a reduce, and should error if this is not a reduce.

If this reduce is in a pipeline of a nest .. then I need to check the inpout to the head of the pipeline to the nest ... which is ALSO the queryspade where the nest is defined, which is why i called that the "headSpace"

Maybe when I build query pipelines, the query spaces themselves have "prev" and "next" pointers ... which would make it easy for me to walk to the head.

I like that idea, with that, I will close the lid!
