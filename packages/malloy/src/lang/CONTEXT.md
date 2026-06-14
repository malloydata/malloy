# Malloy Translator

Malloy compilation has two phases: the **translator** (this document — `src/lang/`, source → IR) and the **compiler** ([`../model/CONTEXT.md`](../model/CONTEXT.md) — `src/model/`, IR → SQL). They live in sibling directories and communicate only through the IR.

This document covers the translator: it transforms Malloy source code into an Intermediate Representation (IR) that is independent of any specific SQL dialect.

## Translation Pipeline

```
Malloy Source → ANTLR Parser → Parse Tree → AST Builder → AST → IR Generator → IR
```

## Components

### 1. Grammar (grammar/)

The Malloy language is defined using ANTLR4 grammar files:

- **`MalloyLexer.g4`** - Lexical analyzer that tokenizes input
- **`MalloyParser.g4`** - Parser grammar that defines language structure

**Type syntax in the grammar:**
- `malloyBasicType` — the 6 user-writable basic types: `STRING | NUMBER | BOOLEAN | DATE | TIMESTAMP | TIMESTAMPTZ`
- `malloyRecordType` — record type: `{ name :: type, name :: type, ... }`
- `malloyType` — compound type with left-recursive array syntax: `malloyBasicType | malloyRecordType | malloyType OBRACK CBRACK`
- `malloyOrSQLType` — `malloyType | string` (string is a raw SQL type name, e.g. `'integer'`)
- `legalParamType` — parameter types are restricted to `malloyBasicType` (no compound types)

**ANTLR Labeled Alternatives Pattern:**
The grammar uses `#labelName` in grammar rules to create type-safe visitor methods. This is a very useful pattern that generates specific visitor methods for each alternative in a rule, making the parse tree traversal type-safe and maintainable.

**Building the parser:**
When modifying grammar files, regenerate the parser:
```bash
npm run build-parser  # In the malloy package directory
```

### String literal forms

Malloy has several quoted-literal forms with different escape rules. Knowing which is which matters when generating Malloy source programmatically (e.g. in tests with adversarial values) — they are NOT interchangeable. The authoritative source is `MalloyLexer.g4`.

Two lexer rules drive the escape behavior:
- `STR_CHAR` covers escape-processed bodies. `\'`, `\\`, `\n`, `\t`, `\uXXXX` are real escape sequences and produce a single character in the resulting string.
- `RAW_CHAR` (and `RAW3_CHAR` for triple-delimited forms) covers raw bodies. Backslash is a literal character; `\'` is the only practical "escape" and it just lets the lexer keep scanning — both the `\` and the `'` end up in the string.

| Form | Lexer token | Example | Body | Notes |
|---|---|---|---|---|
| Single-quoted string | `SQ_STRING` | `'hello'`, `'o\'brien'` | `STR_CHAR` | Standard string value — backslash escapes |
| Double-quoted string | `DQ_STRING` | `"hello"` | `STR_CHAR` | Same; choice of delimiter is cosmetic |
| Backtick-quoted identifier | `BQ_STRING` | `` `weird name` `` | `STR_CHAR` | An identifier (column/field name), not a string value |
| Raw single-quoted string | `RAW_SQ` | `s'a\d'` | `RAW_CHAR` | Raw string value. `s` prefix |
| Raw double-quoted string | `RAW_DQ` | `s"a\d"` | `RAW_CHAR` | Same, double-delimited |
| Regex literal | `HACKY_REGEX` | `r'a\d'`, `R'a\d'`, `/a\d/` | `RAW_CHAR` | Regular expression; always raw |
| Filter expression | `SQ_FILTER` / `DQ_FILTER` / `BQ_FILTER` | `f'...'`, `f"..."`, `` f`...` `` | `RAW_CHAR` | Filter syntax; always raw |
| Multi-line filter | `SQ3_FILTER` / `DQ3_FILTER` / `BQ3_FILTER` | `f'''...'''`, `f"""..."""`, `` f```...``` `` | `RAW3_CHAR` | Triple-delimited filter; always raw |
| Embedded SQL block | `SQL_BEGIN`/`SQL_END` | `"""SELECT * FROM ${%{...}}"""` | `SQL_CHAR` | Body is raw SQL with `%{ malloy }` interpolation; opens a lexer mode. Used in `db.sql("""...""")` and turducken patterns |

A naming gotcha across languages: in BigQuery and Python, `r'...'` means *raw string*. In Malloy, `r'...'` means *regex literal*. Malloy's raw-string prefix is `s`.

Practical implication when authoring Malloy source from JavaScript: for any of the raw forms above (regex, `s'...'`, filter, triple-quoted filter, embedded SQL), do not double backslashes in the JavaScript-side rendering — Malloy will not undouble them. The standard mistake is `"r'" + s.replace(/\\/g, '\\\\') + "'"`, which turns the JS string `a\d` into the 4-character Malloy string `a\\d`, and the regex engine sees a literal backslash where you expected a digit class.

### 2. AST (Abstract Syntax Tree) (ast/)

The AST is a tree of `MalloyElement` objects that represents the semantic structure of Malloy code.

**Key AST concepts:**

**MalloyElement Hierarchy:**
- Base class hierarchy in `src/lang/ast/`
- Each node type represents a language construct (sources, queries, fields, expressions, etc.)

**Method naming for IR generation:**
- If a method returns an IR data structure and takes no arguments, name it after the return type: `structShapeFieldDef()`
- If it needs arguments, prefix with `get`: `getSourceDef(parameterSpace)`
- AST elements can find their containing document via `this.document()`, so document should not be passed as an argument.

**Parent Linking:**
- A `MalloyElement` does NOT get a parent pointer at construction
- A parent links children into the AST tree in one of two ways:
  1. If elements are passed to constructor, by passing them to `super()`
  2. If elements are optional or created later, by calling `.has()` on the child

**AST Builder (`malloy-to-ast.ts`):**
- Transforms ANTLR parse tree into Malloy AST
- Uses visitor pattern to traverse parse tree
- Creates appropriate MalloyElement instances for each parse tree node

**Method naming convention in `malloy-to-ast.ts`:**
- `visitX(pcx: XContext)` — visits a parse-tree node and returns the AST node for it (a `MalloyElement` subclass). Use this even if the method is only ever called from one parent visitor; the name signals "this is the parse-tree-to-AST mapping for rule `X`."
- `getX(pcx: XContext)` — transforms a parse-tree fragment into something that is *not* an AST node (a typeDef, a primitive, a list of notes, etc.), or is a shared helper used from multiple callers. Distinct from `visitX` so a reader can tell at a glance whether the return is an AST node or a piece of supporting data.

**AST integration entry points:**

Two methods anchor how AST nodes plug into the translator's drivers. They're distinct from the `visitX`/`getX` parse-tree-builder conventions above and from the `structShapeFieldDef()`/`getX(parameterSpace)` IR-shaped accessor conventions.

- **`DocStatement.execute(doc: Document): void`** — the interface declared at `malloy-element.ts:377`. `Document.compile()` (in the same file, ~`:588`) walks its `DocStatementList` via `executeList(doc)`, which iterates `this.elements` and for each non-list element calls `el.needs(doc)` first and `el.execute(doc)` only if `needs` returned undefined. Implementers: `ImportStatement`, `DefineSource`, `DefineGivens`, `ModelAnnotation`, `ExperimentalExperiment`, and others under `ast/statements/`.
- **`ExpressionDef.getExpression(fs: FieldSpace): ExprValue`** — the abstract method at `expression-def.ts:82`. `ExpressionDef` is the base class for all expression-shaped AST nodes; operators recursively call `getExpression` on their operand `ExpressionDef`s to obtain the IR value + type for that subtree. Representative call sites: `expressions/case.ts`, `expressions/expr-cast.ts`, `expressions/pick-when.ts`, `expressions/apply.ts`. This is the integration point for expression evaluation, separate from the AST-element-wide naming conventions.

### 3. Translator (`parse-malloy.ts`)

The translator defines the interface for transforming AST into IR.

**FieldSpace:**
- Used by translator to construct and comprehend `StructDef` objects
- Manages namespace and field resolution during translation

#### Steps

A translation is a series of named **steps**. Each step implements `TranslationStep { step(that: MalloyTranslation): StepResponses }`. Steps declare dependencies via constructor arguments — a step holds references to the steps it depends on and asks them for their answers up-chain. A step's response is one of three things: errors (go no further), a `DataRequestResponse` saying it needs more data, or its successful result.

The steps and their dependency wiring are constructed in `MalloyTranslation`'s constructor (the comment there calls it "the makefile for the translation"):

| Step | Depends on | Purpose |
|---|---|---|
| `ParseStep` | — | Fetch the source URL (may emit a `urls` need), run the ANTLR parser, hold the parse tree |
| `ImportsAndTablesStep` | `ParseStep` | Walk the parse tree for `import` / table references, request the URLs and schemas that downstream steps will need |
| `ASTStep` | `ImportsAndTablesStep` | Build the `MalloyElement` AST from the parse tree |
| `TranslateStep` | `ASTStep` | Drive `Document.compile()` to produce the final `ModelDef` |
| `MetadataStep` | `ParseStep` | Symbols/metadata for IDE features |
| `CompletionsStep` | `ParseStep` | Completion candidates at a position |
| `HelpContextStep` | `ParseStep` | Help-context lookup at a position |
| `ModelAnnotationStep` | `ParseStep` | Extract model-level annotations (`##!` etc.) without full translation |
| `TablePathInfoStep` | `ParseStep` | Table references found in the source |

`MalloyTranslator.translate()` is the entry point for full translation: it caches a `finalAnswer` and otherwise delegates to `translateStep.step(this, extendingModel)`. `metadata()`, `modelAnnotation()`, `tablePathInfo()`, `completions()`, `helpContext()` are the entry points for the IDE-facing steps.

#### Needs/update protocol

The translator is **synchronous**. Async work — fetching the text of an imported URL, getting a table schema from a connection, compiling SQL to discover its schema, looking up a connection's dialect — is surfaced through a pause-and-resume protocol:

1. The caller calls `translate()` (or one of the IDE-facing step methods).
2. If the step needs data, the response carries one or more of the fields in `DataRequestResponse` (`translate-response.ts`):
   - `urls: string[]` — files the translator wants the contents of
   - `tables: Record<string, {connectionName, tablePath}>` — table schemas it wants
   - `compileSQL: SQLSourceRequest` — a SQL block whose output schema it wants (from a `db.sql("""...""")` or turducken)
   - `connectionDialects: Record<string, {connectionName}>` — dialect lookups for named connections
3. The caller fetches what was requested and calls `MalloyTranslator.update(dd: ParseUpdate)` to feed results into the translator's `Zone`s (`importZone`, `schemaZone`, `sqlQueryZone`, `connectionDialectZone`).
4. The caller calls `translate()` again; steps see populated zones and continue.

A response with `final: true` ends the loop. The header comment on `MalloyTranslator` describes the call pattern; `Core.statedCompileModel` / `Core.updateCompileModelState` in `api/core.ts` are the standard driver. The async API (`api/asynchronous.ts`) wraps the loop with auto-fetching; the stateless and sessioned APIs leave it to the caller.

Per-statement `needs()` during `Document.compile()` is a narrower variant of the same protocol. `DocStatementList.executeList(doc)` (see "AST integration entry points" above) calls `el.needs(doc)` before `el.execute(doc)`; a non-undefined return value pauses the statement loop. The per-statement `ModelDataRequest` type is just `NeedCompileSQL | undefined` (a single SQL compile request) — URL fetches and table schemas have already been resolved by `ImportsAndTablesStep` before the AST is built, so statement-level pauses are only for SQL-source schema discovery encountered mid-compile.

## Intermediate Representation (IR)

The translator produces **Intermediate Representation (IR)** - a serializable, database-agnostic data format that fully describes the semantic model.

**Key characteristics:**
- Plain data structures (not class instances)
- Fully serializable (JSON-compatible)
- Can be cached, transmitted, and reused
- Defined in `packages/malloy/src/model/malloy_types.ts`

For detailed information about IR structure and types, see [../model/CONTEXT.md](../model/CONTEXT.md).

## Givens — translator side

Given resolution itself is split in two — distinct from the translator/compiler split this document opens with. *Phase 1* (this document's scope) turns `$NAME` references into `GivenID`-bearing IR nodes; *Phase 2* binds the id to a value at SQL emission and lives with the compiler.

- **Declaration** — `lang/ast/statements/define-given.ts` produces a `GivenEntry` in the namespace (caller-facing surface name → `GivenID`) and a full `Given` record in `Document.documentGivens` (the IR-side storage). Default expressions are evaluated through a `ConstantFieldSpace` — field references are rejected, but other givens are allowed (default chains).
- **Use site** — `lang/ast/expressions/expr-given.ts` resolves `$NAME` against the document's namespace, emits a `GivenRefNode` carrying the global `GivenID`. `refSummary.givenUsage` propagates from there through expression evaluation and segment expansion (`composite-source-utils.ts`).
- **Import** — `lang/ast/statements/import-statement.ts` copies the imported model's full `documentGivens` map into the importing document. IDs are global, so no rewrite is needed; surface names are only added for the entries the importer surfaces (selective + non-selective auto-surface).
- **End-of-compile validation** — `Document.compile()` calls `checkGivenAliasCollisions()` (one surface name per id) and `checkQueryGivenSatisfiability()` (every reachable `GivenID` is in-namespace or has a default).

For the compiler-side phase and the runtime supply pipeline, see [`../api/foundation/CONTEXT.md`](../api/foundation/CONTEXT.md).

## Restricted mode

`MalloyTranslator.restrictedMode` (boolean, default false) marks a compile as a *restricted query* — Malloy text submitted by an untrusted author against an already-loaded trusted model. The flag is set only by `ModelMaterializer.loadRestrictedQuery`; direct callers of `Malloy.compile` *could* pass `restrictedMode: true` on the request, but that is not a documented surface.

Seven constructs are rejected when the flag is set. Each rejection lives at the construct's existing integration point, logs `restricted-construct-forbidden` with `errorTag: 'restricted-mode'`, and quotes the offending source text in the message:

| Construct | AST node | Where the check fires |
|---|---|---|
| `import` | `ImportStatement` (`ast/statements/import-statement.ts`) | `execute(doc)` |
| `given:` declaration | `DefineGivens` (`ast/statements/define-given.ts`) | `executeList(doc)` |
| `##!` annotation | `ModelAnnotation` (`ast/types/annotation-elements.ts`) | `execute(doc)`, per-note |
| `connection.table(...)` | `TableMethodSource` (`ast/source-elements/table-source.ts`) | `getTableInfo()` |
| `connection.sql(...)` | `SQLSource` (`ast/source-elements/sql-source.ts`) | `getSourceDef()` |
| `name!type(args)` raw-SQL function | `ExprFunc` with `isRaw === true` (`ast/expressions/expr-func.ts`) | `getExpression(fs)` |
| `sql_number / sql_string / sql_date / sql_timestamp / sql_boolean` | `ExprFunc` whose resolved `func.name` is in `SQL_FUNCTION_NAMES` | `getPropsExpression(fs)`, in the existing sql_* branch |

The two `ExprFunc` rejections cover the two raw-SQL escape hatches in the language: the `!type(args)` syntactic form and the named `sql_*` function family. Both end up emitting user-supplied SQL into the query if allowed. The two checks fire at slightly different points — `isRaw` is decidable from the AST node alone, while the `sql_*` check needs the resolved `FunctionDef` and so lives alongside the existing `experimental.sql_functions` gate inside `getPropsExpression`.

The rejections fire at integration time (`execute` / `getSourceDef` / `getExpression`) — not during AST build — so a single compile collects all violations rather than stopping at the first. `ASTStep`'s `hasErrors()` short-circuit doesn't trip because none of these sites have logged yet.

The `##!` case has a structural twist: `MalloyToAST.updateCompilerFlags` is where compiler-flag lines would normally be pushed onto `compilerFlagSrc` during the visitor walk. In restricted mode, that push is suppressed so the flag never takes effect; the *user-visible diagnostic* is logged later from `ModelAnnotation.execute()`. The trusted-model seeding path in TranslateStep (which feeds `compilerFlagSrc` from `extendingModel.annotations`) is untouched — flags declared by the producer carry through.

Independent of the per-site rejections, the four needs-bearing zones (`importZone`, `schemaZone`, `sqlQueryZone`, `connectionDialectZone`) are locked at the top of `MalloyTranslator.translate()` via `lockZonesIfRestricted()`. After the lock, `Zone.reference()` / `.define()` / `.updateFrom()` are silent no-ops. `ImportsAndTablesStep` also early-returns when restricted, so no child translators are created for `import` statements that are about to be rejected. The zone lock is the structural backstop: even if a future construct slipped through the AST-level rejection, the translator could not reach the host's `URLReader` or connections.

The `restrictedMode` flag flows: `ParseOptions.restrictedMode` → `MalloyTranslator` constructor → `that.root.restrictedMode` (read by AST nodes via `MalloyElement.isRestricted()`) and `MalloyToAST`'s `restrictedMode` constructor param (passed in by `ASTStep`).

API-level details: [`../api/CONTEXT.md`](../api/CONTEXT.md) and the JSDoc on `ModelMaterializer.loadRestrictedQuery`.

## File Organization

```
src/lang/
├── grammar/
│   ├── MalloyLexer.g4         # Lexical grammar
│   └── MalloyParser.g4        # Parser grammar
├── ast/
│   ├── [various element types] # MalloyElement class hierarchy
│   └── malloy-element.ts      # Base MalloyElement class
├── malloy-to-ast.ts           # Parse tree → AST transformation
├── parse-malloy.ts            # AST → IR translation interface
└── test/                      # Translator tests
```

## Prettifier (`prettify.ts`)

A pretty-printer for Malloy source. **This is a placeholder** — the long-term intention is a full-featured `@malloydata/syntax` module that would own a proper concrete-syntax tree, formatter, and lint engine. Until that exists, `prettify.ts` is a pragmatic implementation we can use today in the CLI and MCP servers.

It is exposed *only* via `@malloydata/malloy/internal` as `prettify(src) → { result, errors }` and is explicitly experimental — the API may vanish or change without notice when the syntax module lands. Don't depend on it from anything you can't fix in a single PR.

How it works: lex + parse, then walk the parse tree and dispatch a per-rule formatter (`formatPickStatement`, `formatSectionList`, `formatBinaryChain`, etc.); rules without an explicit handler fall through to a per-token leaf walker. The top of `prettify.ts` has an index of the rules and where each one lives. Tests live at [`test/prettifier.spec.ts`](test/prettifier.spec.ts), one `describe` per rule.

## Important Notes

- The translator produces IR but does NOT generate SQL — that's the job of the [compiler](../model/CONTEXT.md)
- IR is deliberately database-agnostic
- The translator handles all language-level semantics (scoping, type checking, name resolution)
- Error messages and warnings are generated during translation

## Testing

For details on the translator test infrastructure, including `TestTranslator`, `BetaExpression`, template literal helpers, and Jest matchers, see [test/CONTEXT.md](test/CONTEXT.md).
