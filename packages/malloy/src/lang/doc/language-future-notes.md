# The Malloy Language Backlog

Quick notes on all the things not yet done, more of a notepad than a plan.

Coming Soon

* SQL injection review and new parameterized API ( core not language, but don’t want to forget )  
* Trailing Refinements –  `query: newQuery is { stuff } + existingQuery`  
  * Would be Illegal for multi stage queries  
  * request for dimensions and measures to expand to a reduce query with one field   
    `flights -> flight_count` \=== `flights -> { group_by: flight_count }`  
* Parameters / Functions
* Support `TIME`  
* Support `DATETIME`  
* Delete `renames` and use `except` instead  
  * `except: x is y`  
  * `except: x is x::number`  
* [Relationships](https://github.com/malloydata/malloy/discussions/1406) ( join-on-demand sources )  
* Extend `*` to take an `except:` clause  
  * a rename  `select: * a{ except: x is y }`

Coming Sometime

* `import:` improvements  
  * control over what is exported  
* Larger list of Analytic Functions  
* `IN` gesture  
  * Using `? (a|b)` is a problem because `!= (a|b)` is not the negation  
  * Chris suggests `x ~ [a, b]` and `x !~ [a, b]`  
  * `x in (a,b)` and `x not in (a,b)` might be more readable  
* Access to non-Malloy aggregate functions  
* Make error handling great  
  * Better error recovery so that a parse error doesn’t wreck the whole file  
  * Better error messages so that it is clear what is wrong for common errors like mis-spelling a keyword or missing a closing quote  
* Query concatenation (UNION ALL)  
* Column Schema ( JSON support. LookML compatibility )  
* Running a view defined on a join ( mentioned in [this pattern post](https://github.dev/malloydata/patterns/blob/joined\_queries/joined\_queries.malloynb) )  
* [Empty source](https://github.com/malloydata/malloy/issues/1366) ( `run: duckdb.empty() -> { .. }` )

Some Words Written Down To Remind Us To Think About This Some Day

* Insert pipeline into SQL strings  
  * `src -> conn.sql(“SELECT … FROM %{ $PIPE }”) -> { .. more stuff }`  
* Interpolation in string literals `full_name is ‘${last_name}, ${first_name}’`  
* “Combinements” … like refinements but with a composition from multiple sources  
* Destructive refinement `source: flights += { dimension: hey is ‘i changed flights’ }`  
* [“exists” gesture](https://github.com/malloydata/malloy/issues/657)  
* lateral joins ( widen/repeat on nested data )  
* correlated subqueries  
* Pivot-filling-limiting  
* join unnest  
* [Time ranges](https://github.com/malloydata/malloy/issues/1045)  
* Time data based on an API `@”USER-SPECIFIED-FORMAT”`(e.g. YYYYMMDD or epoch seconds )  
* Use / instead of r’ for regular expressions  
* Use `+` for string concatenation ( users could still call `CONCAT`, like any database function )  
* Add x \= infinity, x \= \-infinity, and x \~ infinity  
* Figure out what to do about x \= nan (and decide if there’s a better keyword for nan)  
* connection.connection\_specific\_function() (like duckdb.read\_from\_json\!table() without the need for an extra SELECT \*)  
* filtered joins on nested objects  
* correlated subqueries on nested objects (and maybe on joins)  
* sql expressions (LookML compatibility?)  
* Eliminate Ref-style entries in queries, require refs to be paths, not dotted strings  
* Native support for key/value pattern  
* Support a duration type  
* Some better error message for using keywords instead of “no valid input” … may error recover as an is  
* Ability to reference a source inside of a SQL interpolated string  
* connection config parameters e.g.  `duckdb: { pwd: “../data/” }`  
* `connection.csv(“”” “””)` and `connection.json(“”” “””)`

Refactors and Other Clean Up We Should Do Soon

* Convert `group_by: join_name` into `group_by: join_name is join_name.primary_key` and delete code for dealing with this from the compiler  
* Remove parsing of field paths to segments from compiler, and either add a `parsedPath` to `type: ‘field’` or add a new `type: ‘parsedField’`, then remove the old non-parsed version  
* Delete fields “refs” which are just strings, only allow object-y fields that know their type info  
  * Question: does there need to be a difference in IR between a field which is just a reference and a field with an expression which is just a reference?  
* Delete `FilteredAliasedName` entirely  
* Should a `QueryFieldAST` be called something more accurate, like a `NestViewField`?  
* Should the `fieldDef` and `getQueryFieldDef` methods of `SpaceField` be separated out into different interfaces so that, e.g., `QueryFieldAST` doesn’t even need to implement `fieldDef`?  
* Make `getOp` of a segment just use `build.resultFS` rather than `opOutputStruct`  
* Make `queryFieldDefs` of a `QuerySpace` return ALL the fields, rather than just the ones from the last refinement bit  
* Refactor the query AST elements to look more like new Malloy code, rather than the IR  
* Delete the unused `WildSpaceField` class  
* remove `pipeHead` entirely  
* Remove need for table string to be stored in the `name` field of a `StructDef`  
* Get rid of `as` everywhere?