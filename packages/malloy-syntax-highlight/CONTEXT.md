# Syntax Highlight Package

Maintains syntax-highlighting grammars for three Malloy file types — `.malloy`,
`.malloysql`, `.malloynb` — and publishes them as static assets (no JS API) for
editors. This doc describes `.malloy`; the other two follow the same shape.

## The corpus is the spec

`grammars/malloy/corpus.json` is the source of truth for *what the grammar
should do*. Each case pairs Malloy source with the tokens it must produce:

```json
{ "name": "…", "code": "<malloy>",
  "expect": [ { "text": "…", "lexer": "<TOKEN>", "scope": "<scope>" } ] }
```

- `lexer` is **verified ground truth** — the symbolic token the real
  `MalloyLexer` emits for that span.
- `scope` is an **authored design decision** — the TextMate scope the grammar
  should assign.

The corpus is checked two ways, so the grammar can't silently drift from the
language:

1. **Scope test** (`grammars/malloy/corpus.spec.ts`, Jest) tokenizes each `code`
   with `vscode-textmate` and asserts every span carries its `scope`.
2. **Drift test** (`packages/malloy/src/lang/test/syntax-highlight-corpus.spec.ts`,
   Jest) runs the *real* `MalloyLexer` and asserts every span's `lexer` token
   still matches the language, and uses `parsePrefix` (the annotation router) as
   the oracle for annotation routing.

The drift test lives in `packages/malloy` because the lexer is internal there
(not exported); it reads `corpus.json` by file path, so neither package gains a
dependency on the other. `corpus.json` is hand-authored and not published — the
one place new constructs and scope decisions are pinned.

## Two grammar systems

**TextMate** (`grammars/malloy/malloy.tmGrammar.json`) is the ground truth —
used by VS Code, GitHub (Linguist), and Shiki.

**Monarch** (`grammars/malloy/malloy.monarch.ts`) is for Monaco (web editors).
It is **generated** from the TextMate grammar by
`scripts/generateMonarchGrammar.ts` and is never hand-edited — the generator is
what keeps the two in sync. Edit the TextMate grammar, regenerate, Monarch
follows.

| | TextMate | Monarch |
|---|---|---|
| Regex engine | Oniguruma | JavaScript |
| Scopes per token | many (stacked) | one |
| Backreferences | yes | no cross-state |
| Embedding levels | unlimited | one |

Monarch is the weaker model, so the generator translates *intent*, not syntax:

- inline `(?i:…)` → `(?:…)` (invalid JS regex; Monarch is globally `ignoreCase`)
- each begin/end rule gets a unique end-state (rules sharing a scope — e.g. the
  filter strings — would otherwise collide into one state)
- a backreferenced alternation end (`("""|"|') … \5`) expands into one state per
  quote, since Monarch has no cross-state backreferences
- delimiter scopes (`punctuation.definition.string.*`) remap to the region color
  suffix-insensitively, because a Monarch token is single and can't also carry
  the region's `name`

**The divergent set** — what Monarch structurally can't do, excluded from its
parity test: column-matched block annotations, multi-level `%{ }` embedding, and
painting the `meta.embedded` wrapper over an embedded SQL body. Tags aren't
highlighted in Monarch at all (the generator omits the `@tags` include).

## Scope conventions

Standard TextMate vocabulary, grouped by *role* (not per-keyword), each suffixed
`.malloy`:

- `keyword.control.malloy` — clause/statement keywords (dimension, where,
  group_by, …) and bare expression keywords (case, when, asc, is, distinct, …)
- `keyword.operator.malloy` — and, or, not, in, like, to, for
- `storage.type.malloy` — string, number, date, timestamp(tz), boolean, json
- `support.function.malloy` — built-in functions at the call site; user
  functions are `entity.name.function.malloy`
- `constant.language.malloy` — null, true, false, now
- `variable.language.malloy` — this · `variable.parameter.malloy` — `$given`
  refs · `variable.other.malloy` — identifiers
- `keyword.other.timeframe.malloy` — year/quarter/…/day_of_year
- the string zoo — `string.quoted.{single,double,triple,raw.*,filter}.malloy`,
  `string.regexp.malloy`; numbers — `constant.numeric(.percentage).malloy`

The trailing `.malloy` is our own specificity; themes match by *prefix*
(`keyword.control`, `string.quoted`, …), so the grammar colors correctly under
any theme without shipping custom rules.

**Colon-keywords** (lexer tokens that require a trailing `:` — dimension, where,
query, …) only color in keyword position, via a `(?=:)` lookahead, so a field
named `query` or `sample` isn't mistaken for a keyword. The `:` is left
uncolored. (No `\s*` before it — the lexer's `SPACE_CHAR*` allowance is being
removed; don't reintroduce it.)

## Annotations are routed

`#`/`##` are the annotation (tag) markers — **not** comments (`--` and `//` are
comments). The sigil is `##?` then an optional block `|`; a **route** follows
(up to the first whitespace) and decides how the content reads — see
`parsePrefix` in `packages/malloy/src/lang/annotation-prefix.ts`:

- **tag routes** — empty (default) and the claimed sigils `!`, `@`, `:` — carry
  tag property-language → tag styling (marker as punctuation, names as
  `entity.name.tag`, `=`/negation as operators, quoted values as strings)
- **documentation routes** — `"` and the bracketed app routes `()` `<>` `[]`
  `{}` — carry prose/markdown/JSON → `comment.{line,block}.documentation`

Routes apply identically to single-line (`#`/`##`) and block (`#|`/`##|`) forms.
Block close is column-matched in the lexer; the grammar approximates it with a
leading-whitespace backreference (Monarch can't, so blocks are divergent).

## Embedded SQL

SQL-ness comes from the `.sql()` **context**, not the `"""` delimiter:
`connection.sql('…')`, `("…")`, and `("""…""")` are all SQL, while a bare
`"""…"""` elsewhere is just a multi-line string. The rule keys on `.sql(`, wraps
the region in `meta.embedded.block.sql.malloy`, and delegates the body to
`source.sql` (real SQL coloring comes from the host's SQL grammar); `%{ }`
interpolations inside a `"""` block re-enter Malloy.

The three quote forms are *one* combined rule (`("""|"|')` with a backreferenced
end), not three siblings — vscode-textmate's begin scanner silently drops
shorter begins that share a long prefix, which would leave only `"""` working.
The generator expands it back into per-quote states for Monarch.

## File layout

```
grammars/malloy/
  malloy.tmGrammar.json     — TextMate grammar (ground truth)
  malloy.monarch.ts         — Monarch grammar (generated; do NOT edit)
  malloy-language.json      — VS Code language config
  corpus.json               — the spec (hand-authored; not published)
  corpus.spec.ts            — scope test (vscode-textmate)
  malloyTestInput.ts        — snapshot/parity input (common + monarchDivergent)
  malloy.spec.ts            — TextMate snapshot test (Jest)
  malloy.test.ts            — Monarch parity test (Karma)
  tokenizations/darkPlus.ts — generated snapshot ground truth
grammars/malloy-sql/, malloy-notebook/  — the other two file types
themes/textmate/, themes/monaco/        — VS Code themes + Monaco conversions
scripts/generateMonarchGrammar.ts       — TextMate → Monarch
scripts/generateLanguageTokenizationFile.ts — regenerate darkPlus
packages/malloy/src/lang/test/syntax-highlight-corpus.spec.ts — drift/routing test
```

## Testing surfaces

| Test | Where | Engine | Checks |
|---|---|---|---|
| Scope | `corpus.spec.ts` | vscode-textmate | grammar assigns the authored `scope` |
| Drift | `packages/malloy/…/syntax-highlight-corpus.spec.ts` | real MalloyLexer + parsePrefix | `lexer`/route still match the language |
| Snapshot | `malloy.spec.ts` | vscode-textmate | tokenization unchanged vs `darkPlus.ts` |
| Parity | `malloy.test.ts` (Karma) | Monaco | Monarch matches TextMate on `commonTestInput` |

The corpus tests are the *correctness* oracle; snapshot/parity are
change-detectors. `malloyTestInput.ts` splits into `commonTestInput` (both
engines) and `monarchDivergentTestInput` (TextMate only) — **a green Karma run
means green**, so never put a Monarch-divergent pattern in `commonTestInput`.

Karma needs a browser; headless:
`CHROME_BIN="<chrome>" npx karma start --single-run --browsers ChromeHeadless`.

```bash
npm run gen-malloy-tokens       # regenerate darkPlus after a grammar/input change
npm run gen-malloy-monarch      # regenerate the Monarch grammar from TextMate
npm run test-textmate-grammars  # Jest (scope + snapshot)
npm run test-monarch-grammars   # Karma (Monarch parity)
```

## Adding or changing a construct

1. Run the snippet through the real lexer to learn its true tokens.
2. Add a `corpus.json` case — `code`, the verified `lexer` token(s), the
   intended `scope`(s).
3. Edit `malloy.tmGrammar.json` until the scope test passes.
4. `npm run gen-malloy-monarch` and `npm run gen-malloy-tokens`.
5. Run scope + drift + snapshot tests, then Karma. If the construct is
   Monarch-divergent, put its `malloyTestInput.ts` block in
   `monarchDivergentTestInput`.

## npm package contents

Only grammar assets are published (`grammars/**/*.tmGrammar.json`,
`*-language.json`, `*.monarch.ts`). The corpus, specs, themes, and scripts are
dev-only.
