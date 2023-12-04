* A nest statement results in a `TurtleDecl` (which is also used for view statements) which is a subclass of `TurtleHeadedPipe`
* When one of these is added to a QOP field list, it creates entry type `NestField`
  * The `NestField` informs the `TurtleDecl` that it is a nest, and passes it the QuerySpace where the nest was declared
  * This sets `isNestIn` meaning "this pipeline is a nest, and it is nested in this QuerySpace"
* `isNestIn` is passed down to anyone who might create a builder (bascially `QOPDesc.getOp()`)
* When a builder is created, if `isNestIn` is set, the QuerySpace for the new QOP gets `nestParent = isNestIn`
* When an ungroup is checked, it checkes the output space of the queryspace the ungroup was in first
  * If it isn't there, it walked up the chain of `nestParet` checking each output space