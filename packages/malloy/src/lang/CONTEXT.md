# Malloy Translator

The translator is the first phase of the Malloy compiler. It transforms Malloy source code into an Intermediate Representation (IR) that is independent of any specific SQL dialect.

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

**Parent Linking:**
- A `MalloyElement` does NOT get a parent pointer at construction
- A parent links children into the AST tree in one of two ways:
  1. If elements are passed to constructor, by passing them to `super()`
  2. If elements are optional or created later, by calling `.has()` on the child

**AST Builder (`malloy-to-ast.ts`):**
- Transforms ANTLR parse tree into Malloy AST
- Uses visitor pattern to traverse parse tree
- Creates appropriate MalloyElement instances for each parse tree node

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

## Important Notes

- The translator produces IR but does NOT generate SQL - that's the compiler's job
- IR is deliberately database-agnostic
- The translator handles all language-level semantics (scoping, type checking, name resolution)
- Error messages and warnings are generated during translation

## Testing

For details on the translator test infrastructure, including `TestTranslator`, `BetaExpression`, template literal helpers, and Jest matchers, see [test/CONTEXT.md](test/CONTEXT.md).
