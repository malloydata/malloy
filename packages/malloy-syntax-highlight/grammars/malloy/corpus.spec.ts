/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 * Hermetic scope check for the TextMate grammar — the companion to the lexer
 * drift guard in packages/malloy/src/lang/test/syntax-highlight-corpus.spec.ts.
 *
 * Reads the same authored corpus (corpus.json) and, for every expect[].text
 * span, asserts the real TextMate grammar (via vscode-textmate + Oniguruma)
 * assigns the intended `scope`. Needs no Malloy build and no lexer — only the
 * grammar and the corpus.
 *
 * source.sql is intentionally NOT bundled here; an embedded SQL body still
 * carries our own meta.embedded.block.sql.malloy wrapper scope, which is what
 * the corpus asserts. A host that loads a SQL grammar gets the inner scopes too.
 */

import {join as pathJoin} from 'path';
import {readFileSync} from 'fs';
import type {IGrammar} from 'vscode-textmate';
import {Registry, parseRawGrammar, INITIAL} from 'vscode-textmate';
import {loadWASM, OnigScanner, OnigString} from 'vscode-oniguruma';

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
  cases: CorpusCase[];
}

const grammarPath = pathJoin(__dirname, 'malloy.tmGrammar.json');
// MOTLY is embedded in annotation (tag) bodies; load the real grammar shipped
// by @malloydata/motly-ts-parser so the embed resolves while tokenizing.
const motlyGrammarPath = pathJoin(
  __dirname,
  '../../../../node_modules/@malloydata/motly-ts-parser/grammar/source.motly.tmGrammar.json'
);
const corpusPath = pathJoin(__dirname, 'corpus.json');
const corpus: Corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));

async function loadMalloyGrammar(): Promise<IGrammar> {
  const {buffer: wasmBin} = readFileSync(
    pathJoin(
      __dirname,
      '../../../../node_modules/vscode-oniguruma/release/onig.wasm'
    )
  );
  if (!(wasmBin instanceof ArrayBuffer)) {
    throw new Error('expected ArrayBuffer for onig.wasm');
  }
  const onigLib = loadWASM(wasmBin).then(() => ({
    createOnigScanner: (patterns: string[]) => new OnigScanner(patterns),
    createOnigString: (s: string) => new OnigString(s),
  }));
  const registry = new Registry({
    onigLib,
    loadGrammar: async scopeName => {
      if (scopeName === 'source.malloy') {
        return parseRawGrammar(readFileSync(grammarPath, 'utf8'), grammarPath);
      }
      if (scopeName === 'source.motly') {
        return parseRawGrammar(
          readFileSync(motlyGrammarPath, 'utf8'),
          motlyGrammarPath
        );
      }
      return null; // other embedded grammars (source.sql) not bundled for this test
    },
  });
  const grammar = await registry.loadGrammar('source.malloy');
  if (!grammar) {
    throw new Error('could not load source.malloy grammar');
  }
  return grammar;
}

/** Scopes the grammar assigns to the first occurrence of `text` in `code`. */
function scopesAt(
  grammar: IGrammar,
  code: string,
  text: string
): string[] | undefined {
  let ruleStack = INITIAL;
  for (const line of code.split('\n')) {
    const {tokens, ruleStack: nextStack} = grammar.tokenizeLine(
      line,
      ruleStack
    );
    const col = line.indexOf(text);
    if (col >= 0) {
      for (const token of tokens) {
        if (token.startIndex <= col && col < token.endIndex) {
          return token.scopes;
        }
      }
    }
    ruleStack = nextStack;
  }
  return undefined;
}

describe('syntax-highlight corpus — TextMate scopes', () => {
  let grammar: IGrammar;
  beforeAll(async () => {
    grammar = await loadMalloyGrammar();
  });
  for (const c of corpus.cases) {
    describe(c.name, () => {
      for (const e of c.expect) {
        it(`${JSON.stringify(e.text)} → ${e.scope}`, () => {
          const scopes = scopesAt(grammar, c.code, e.text);
          expect(scopes).toBeDefined();
          expect(scopes).toContain(e.scope);
        });
      }
    });
  }
});
