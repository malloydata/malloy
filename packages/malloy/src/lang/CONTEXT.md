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

### 3. Translator (`parse-malloy.ts`)

The translator defines the interface for transforming AST into IR.

**FieldSpace:**
- Used by translator to construct and comprehend `StructDef` objects
- Manages namespace and field resolution during translation

**Translation process:**
1. AST is traversed
2. Semantic analysis is performed (type checking, name resolution)
3. IR structures are built incrementally
4. Final IR represents complete semantic model

## Intermediate Representation (IR)

The translator produces **Intermediate Representation (IR)** - a serializable, database-agnostic data format that fully describes the semantic model.

**Key characteristics:**
- Plain data structures (not class instances)
- Fully serializable (JSON-compatible)
- Can be cached, transmitted, and reused
- Defined in `packages/malloy/src/model/malloy_types.ts`

For detailed information about IR structure and types, see [../model/CONTEXT.md](../model/CONTEXT.md).

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
