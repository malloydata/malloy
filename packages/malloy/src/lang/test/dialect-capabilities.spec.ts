/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// What the translator refuses, at the expression, when a dialect lacks a
// capability. `_ms_` is the sqlserver connection: no regular expressions.
import './parse-expects';
import {error} from './test-translator';

describe('regular expressions on a dialect without them', () => {
  test('~ against a regex literal is refused where it is written', () => {
    expect(`
      run: _ms_.table('aTable') -> { select: astr; where: astr ~ r'a.c' }
    `).toLog(error('dialect-regexp-unsupported', {dialect: 'sqlserver'}));
  });

  test('!~ is refused the same way', () => {
    expect(`
      run: _ms_.table('aTable') -> { select: astr; where: astr !~ r'a.c' }
    `).toLog(error('dialect-regexp-unsupported', {dialect: 'sqlserver'}));
  });

  test('~ against a string is a LIKE and is accepted', () => {
    expect(`
      run: _ms_.table('aTable') -> { select: astr; where: astr ~ 'a%' }
    `).toTranslate();
  });

  test('a function whose template is an error node is refused', () => {
    expect(`
      run: _ms_.table('aTable') -> { select: x is regexp_extract(astr, r'a.c') }
    `).toLog(
      error('dialect-function-unsupported', {
        dialect: 'sqlserver',
        function: 'regexp_extract',
      })
    );
  });

  test('only the overload with the error template is refused', () => {
    expect(`
      run: _ms_.table('aTable') -> { select: x is replace(astr, 'a', 'b') }
    `).toTranslate();
    expect(`
      run: _ms_.table('aTable') -> { select: x is replace(astr, r'a.', 'b') }
    `).toLog(
      error('dialect-function-unsupported', {
        dialect: 'sqlserver',
        function: 'replace',
      })
    );
  });

  test('a dialect with regular expressions is unaffected', () => {
    expect(`
      run: _db_.table('aTable') -> {
        select: x is regexp_extract(astr, r'a.c'); where: astr ~ r'a.c'
      }
    `).toTranslate();
  });
});
