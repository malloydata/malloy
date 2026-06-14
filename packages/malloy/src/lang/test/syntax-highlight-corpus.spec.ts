/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 * Drift guard for the TextMate syntax-highlight grammar.
 *
 * The authored corpus
 * (packages/malloy-syntax-highlight/grammars/malloy/corpus.json) is the shared
 * contract between two tests. This one verifies the corpus's lexer claims still
 * match reality: for every `expect[].text` span it asserts the real MalloyLexer
 * produces a token of the claimed `lexer` kind. If the language moves (a token
 * is renamed, a construct retokenizes), this goes red — telling us the grammar's
 * spec is now lying. The companion test in malloy-syntax-highlight asserts the
 * grammar's *scopes* match the corpus; it never sees the lexer.
 *
 * This lives in packages/malloy because the lexer is an internal (not exported
 * from the package). It reads the corpus by file path rather than importing it,
 * so core gains no project-reference edge to the syntax-highlight package.
 */

import {readFileSync} from 'fs';
import * as path from 'path';
import {makeMalloyParser} from '../run-malloy-parser';
import {parsePrefix} from '../annotation-prefix';
import {MalloyLexer} from '../lib/Malloy/MalloyLexer';

interface CorpusExpectation {
  text: string;
  lexer: string;
  scope: string;
}
interface CorpusCase {
  name: string;
  note?: string;
  code: string;
  expect: CorpusExpectation[];
}
interface Corpus {
  description: string;
  scopeConventions: string;
  cases: CorpusCase[];
}

const corpusPath = path.join(
  __dirname,
  '../../../../malloy-syntax-highlight/grammars/malloy/corpus.json'
);
const corpus: Corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));

/** Symbolic lexer-token name covering the character offset `at` in `code`. */
function lexerTokenNameAt(code: string, at: number): string | undefined {
  const {tokenStream} = makeMalloyParser(code);
  tokenStream.fill();
  for (const token of tokenStream.getTokens()) {
    if (token.type === -1) continue; // EOF
    if (token.startIndex <= at && at <= token.stopIndex) {
      return (
        MalloyLexer.VOCABULARY.getSymbolicName(token.type) ?? `#${token.type}`
      );
    }
  }
  return undefined;
}

describe('syntax-highlight corpus — lexer drift guard', () => {
  for (const c of corpus.cases) {
    describe(c.name, () => {
      for (const e of c.expect) {
        test(`${JSON.stringify(e.text)} → ${e.lexer}`, () => {
          const at = c.code.indexOf(e.text);
          expect(at).toBeGreaterThanOrEqual(0); // corpus text must occur in code
          expect(lexerTokenNameAt(c.code, at)).toBe(e.lexer);
        });
      }
    });
  }
});

/**
 * Routing oracle: the grammar's tag-vs-documentation split must agree with the
 * real route parser (`parsePrefix`), not with my hand. For each annotation case
 * we derive the content kind two ways — from `parsePrefix(code)` (the authority)
 * and from the corpus's own expected scopes (what the grammar produces) — and
 * assert they match. If routing semantics move (a new sigil, changed bracket or
 * malformation rules), this flags the grammar/corpus as stale.
 *
 * `routeContentKind` encodes the one policy parsePrefix does NOT own — which
 * routes carry tags vs prose: `"` and bracketed app routes are documentation,
 * everything else (empty/MOTLY, claimed sigils, malformed) is tags. Known small
 * gap: an all-punctuation bracketed route (e.g. `#(-->)`) reads as a sigil here
 * since parsePrefix returns bracket routes with the brackets stripped; no corpus
 * case exercises it.
 */
function routeContentKind(annotationText: string): 'documentation' | 'tag' {
  const {route, malformation} = parsePrefix(annotationText);
  if (route === '"') return 'documentation';
  const isSigil = route.length > 0 && /^[^\p{L}\p{N}_]+$/u.test(route);
  if (route !== '' && !isSigil && malformation === undefined) {
    return 'documentation'; // a bracketed app route (opaque content)
  }
  return 'tag';
}

function corpusContentKind(c: CorpusCase): 'documentation' | 'tag' | undefined {
  const scopes = c.expect.map(e => e.scope);
  if (scopes.some(s => s.includes('documentation'))) return 'documentation';
  if (scopes.some(s => /entity\.name\.tag|keyword\.operator/.test(s))) {
    return 'tag';
  }
  return undefined; // case asserts only markers — no content kind to check
}

describe('syntax-highlight corpus — annotation routing (parsePrefix oracle)', () => {
  for (const c of corpus.cases) {
    if (!c.code.startsWith('#')) continue; // annotation cases only
    const expected = corpusContentKind(c);
    if (expected === undefined) continue;
    test(c.name, () => {
      expect(routeContentKind(c.code)).toBe(expected);
    });
  }
});
