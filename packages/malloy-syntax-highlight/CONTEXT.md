# Syntax Highlight Package

This package maintains syntax highlighting grammars for three Malloy file types: `.malloy`, `.malloysql`, and `.malloynb` (notebook). It publishes grammar files as static assets (no JS API) for consumption by editors.

## Two Grammar Systems

**TextMate grammar** (`grammars/malloy/malloy.tmGrammar.json`) is the ground truth. It's used by VSCode and defines all syntax patterns using Oniguruma regex. It supports multiple scopes per token, backreferences in end patterns, and nested captures.

**Monarch grammar** (`grammars/malloy/malloy.monarch.ts`) is for Monaco Editor (web-based editors). It uses JavaScript regex and a simpler state-machine model. Currently auto-generated from the TextMate grammar by `scripts/generateMonarchGrammar.ts`.

### Key Differences Between the Systems

| Capability | TextMate | Monarch |
|---|---|---|
| Regex engine | Oniguruma | JavaScript |
| Scopes per token | Multiple | One |
| Backreferences in end patterns | Yes | No |
| Self-referencing grammars | Yes | No |
| Embedding levels | Unlimited | One |

### Monarch Generation: Current State and Future Direction

The auto-generator (`scripts/generateMonarchGrammar.ts`) handles the bulk of the grammar well (keywords, strings, numbers, comments) but breaks down at the edges. It uses a `TOKENS_MAP` and specificity heuristics to paper over the many-to-one scope mapping, and has a hardcoded hack to comment out the `@tags` include because the tag patterns don't convert cleanly. Block annotations (multi-line `#|...|#`) are another case it can't handle due to backreference requirements.

The generator may be replaced by an AI-assisted approach that understands the *intent* of the TextMate grammar and writes idiomatic Monarch patterns achieving the same visual result, rather than mechanically transliterating syntax that doesn't map 1:1.

## File Layout

```
grammars/
  malloy/
    malloy.tmGrammar.json       — TextMate grammar (ground truth)
    malloy.monarch.ts           — Monarch grammar (auto-generated)
    malloy-language.json        — VSCode language configuration
    malloyTestInput.ts          — Test input covering all Malloy constructs
    malloy.spec.ts              — Jest tests (TextMate tokenization)
    malloy.test.ts              — Karma tests (Monarch parity)
    tokenizations/darkPlus.ts   — Ground-truth tokenization artifact
  malloy-sql/                   — TextMate grammar + language config for .malloysql
  malloy-notebook/              — TextMate grammar + language config for .malloynb
themes/
  textmate/                     — VSCode themes (Dark+, Light+, etc.)
  monaco/                       — Same themes converted for Monaco
scripts/
  generateMonarchGrammar.ts     — TextMate → Monarch conversion
  generateMonarchTheme.ts       — TextMate theme → Monaco theme conversion
  generateLanguageTokenizationFile.ts — Generate ground-truth tokenization artifacts
test/
  testUtils.ts                  — Shared test interfaces
  generateTextmateTokenizations.ts  — Tokenize via vscode-textmate + oniguruma
  generateMonarchTokenizations.ts   — Tokenize via Monaco in browser
  config/                       — Test configurations per grammar/theme combo
```

## Annotations and Tags in the Grammar

Malloy objects can have metadata annotations. The grammar highlights these:

- **Single-line**: `# tag=value` (object-level) and `## tag=value` (model-level)
- **Block (multi-line)**: `#|...|#` (object-level) and `##|...|##` (model-level)

Block annotations use a column-matching rule: the closing `|#` must be at the same column as the opening `#|`. The TextMate grammar approximates this using backreferences on leading whitespace. Monarch cannot replicate this.

Tag content within annotations is parsed by `#tag-values` patterns that highlight tag names, `=` operators, and values.

## Testing Workflow

Tests verify that grammars produce correct tokenization (scope names + colors) against VSCode themes.

```bash
# Regenerate expected tokenizations after changing the TextMate grammar or test inputs
npm run gen-malloy-tokens

# Run TextMate grammar tests (Jest, Node.js)
npm run test-textmate-grammars

# Run Monarch grammar tests (Karma, browser — verifies parity with TextMate)
npm run test-monarch-grammars

# Regenerate Monarch grammar from TextMate
npm run gen-malloy-monarch
```

### Adding a New Syntax Pattern

1. Edit `malloy.tmGrammar.json` (the ground truth)
2. Add test input to `malloyTestInput.ts`
3. Run `npm run gen-malloy-tokens` to regenerate expected tokenizations
4. Run `npm run test-textmate-grammars` to verify
5. Run `npm run gen-malloy-monarch` to regenerate the Monarch grammar
6. Manually verify Monarch output (the generator may need fixes for complex patterns)

## npm Package Contents

Only grammar files are published:
- `grammars/**/*.tmGrammar.json` — TextMate grammars
- `grammars/**/*-language.json` — VSCode language configurations
- `grammars/**/*.monarch.ts` — Monarch grammars
