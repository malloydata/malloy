/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {readFileSync} from 'fs';
import path from 'path';
import {Token} from 'antlr4ts';
import {MalloyLexer} from '../lib/Malloy/MalloyLexer';
import {KEYWORD_DISPLAY_NAMES} from '../lib/Malloy/keyword-display-names';
import {describeExpected, describeToken} from '../syntax-errors/token-names';

const vocab = MalloyLexer.VOCABULARY;

describe('describeToken', () => {
  test('statement keywords keep their colon', () => {
    expect(describeToken(MalloyLexer.AGGREGATE, vocab)).toBe("'aggregate:'");
    expect(describeToken(MalloyLexer.DIMENSION, vocab)).toBe("'dimension:'");
    expect(describeToken(MalloyLexer.GROUP_BY, vocab)).toBe("'group_by:'");
  });

  test('bare keywords have no colon', () => {
    expect(describeToken(MalloyLexer.IS, vocab)).toBe("'is'");
    expect(describeToken(MalloyLexer.AND, vocab)).toBe("'and'");
  });

  test('class tokens read as prose', () => {
    expect(describeToken(MalloyLexer.IDENTIFIER, vocab)).toBe('a name');
    expect(describeToken(MalloyLexer.BQ_STRING, vocab)).toBe('a `quoted` name');
    expect(describeToken(MalloyLexer.NUMERIC_LITERAL, vocab)).toBe('a number');
  });

  test('punctuation uses its literal name', () => {
    expect(describeToken(MalloyLexer.OCURLY, vocab)).toBe("'{'");
    expect(describeToken(MalloyLexer.COMMA, vocab)).toBe("','");
  });

  test('end of input', () => {
    expect(describeToken(Token.EOF, vocab)).toBe('end of input');
  });
});

describe('describeExpected', () => {
  test('a short set is named, in order', () => {
    expect(
      describeExpected([MalloyLexer.OCURLY, MalloyLexer.IDENTIFIER], vocab)
    ).toBe("'{' or a name");
  });

  test('a single expected token', () => {
    expect(describeExpected([MalloyLexer.IDENTIFIER], vocab)).toBe('a name');
  });

  test('token types that share a display are merged', () => {
    expect(
      describeExpected([MalloyLexer.SQ_STRING, MalloyLexer.DQ_STRING], vocab)
    ).toBe('a quoted string');
  });

  test('a large follow-set is suppressed', () => {
    const many = [
      MalloyLexer.AGGREGATE,
      MalloyLexer.DIMENSION,
      MalloyLexer.MEASURE,
      MalloyLexer.GROUP_BY,
      MalloyLexer.WHERE,
    ];
    expect(describeExpected(many, vocab)).toBeUndefined();
  });

  test('an empty set yields no clause', () => {
    expect(describeExpected([], vocab)).toBeUndefined();
  });
});

// Drift guard, independent of the build: every keyword rule in the marked
// section of the grammar must have a generated display name. If someone adds a
// keyword but the table was not regenerated (`npm run codegen`), this fails.
describe('KEYWORD_DISPLAY_NAMES stays in sync with the grammar', () => {
  const grammar = readFileSync(
    path.join(__dirname, '..', 'grammar', 'MalloyLexer.g4'),
    'utf-8'
  );
  const begin = grammar.match(/^[ \t]*\/\/[ \t]*KEYWORDS-BEGIN[ \t]*$/m);
  const end = grammar.match(/^[ \t]*\/\/[ \t]*KEYWORDS-END[ \t]*$/m);
  const section =
    begin && end ? grammar.slice(begin.index, end.index) : undefined;
  const ruleNames = [
    ...(section ?? '').matchAll(/^([A-Z][A-Z0-9_]*)\s*:/gm),
  ].map(m => m[1]);

  test('the markers and rules are found', () => {
    expect(section).toBeDefined();
    expect(ruleNames.length).toBeGreaterThan(50);
  });

  test('every keyword rule has exactly one display entry', () => {
    expect(ruleNames.length).toBe(Object.keys(KEYWORD_DISPLAY_NAMES).length);
    for (const name of ruleNames) {
      expect(KEYWORD_DISPLAY_NAMES[name]).toBeDefined();
    }
  });

  test('every display name is a clean keyword spelling', () => {
    for (const spelling of Object.values(KEYWORD_DISPLAY_NAMES)) {
      expect(spelling).toMatch(/^[a-z][a-z0-9_]*:?$/);
    }
  });
});
