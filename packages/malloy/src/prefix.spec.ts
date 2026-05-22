/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {parsePrefix} from './prefix';

describe('parsePrefix', () => {
  describe('Form 1: empty routing -> MOTLY', () => {
    test.each(['# foo=1', '#\tfoo', '## foo=1', '##\tfoo'])(
      '%j -> route ""',
      text => {
        const p = parsePrefix(text);
        expect(p.route).toBe('');
        expect(p.malformation).toBeUndefined();
      }
    );

    test('a bare-pipe block is the empty route, not route "|"', () => {
      // The lexer keeps the opener and de-indents the body: '#|\n  x' -> '#|\nx'
      const p = parsePrefix('#|\nx');
      expect(p.route).toBe('');
      expect(p.malformation).toBeUndefined();
    });
  });

  describe('Form 2: sigil routes (reserved, closed set)', () => {
    test.each([
      ['#!', '!'],
      ['#@', '@'],
      ['#"', '"'],
      ['#:', ':'],
      ['##!', '!'],
    ])('%j -> claimed sigil route %j', (text, route) => {
      const p = parsePrefix(text);
      expect(p.route).toBe(route);
      expect(p.malformation).toBeUndefined();
    });

    test.each(['#%', '#$', '#~'])(
      '%j -> route present but reserved-route warning',
      text => {
        const p = parsePrefix(text);
        expect(p.malformation).toBe('reserved-route');
      }
    );
  });

  describe('Form 3: opaque bracketed app routes', () => {
    test.each([
      ['#(docs)', 'docs'],
      ['#<docs>', 'docs'],
      ['#[docs]', 'docs'],
      ['#{docs}', 'docs'],
      ['#(bar-chart)', 'bar-chart'],
      ['#(https://foo/bar)', 'https://foo/bar'],
      ['#(my.app)', 'my.app'],
      ['#(v1.2.3)', 'v1.2.3'],
      ['#<has(parens)>', 'has(parens)'],
      ['#(══SECURITY══)', '══SECURITY══'],
      ['#|(ABC)', 'ABC'],
    ])('%j -> route %j (opaque)', (text, route) => {
      const p = parsePrefix(text);
      expect(p.route).toBe(route);
      expect(p.malformation).toBeUndefined();
    });

    test('different bracket pairs resolve to the same route', () => {
      const route = parsePrefix('#(docs)').route;
      for (const text of ['#<docs>', '#[docs]', '#{docs}']) {
        expect(parsePrefix(text).route).toBe(route);
      }
    });

    test('decoration is significant — banner does not collapse to a clean route', () => {
      expect(parsePrefix('#(══X══)').route).toBe('══X══');
      expect(parsePrefix('#(══X══)').route).not.toBe('X');
    });
  });

  describe('malformed routes', () => {
    test.each([
      '#foo', // bare word, no brackets
      '#a.b', // word chars, no brackets
      '#(docs', // unclosed
      '#((((SPECIAL))))', // trailing junk after first close
      '#word)', // lone close, no open
      '#)', // lone close bracket
      '#()', // empty bracketed name
    ])('%j -> malformed-route', text => {
      expect(parsePrefix(text).malformation).toBe('malformed-route');
    });
  });

  describe('Windows (CRLF) line endings — \\r must not pollute the route', () => {
    test.each([
      ['#(docs)\r\n', 'docs'], // content-less bracketed: \r had been pulled into routing
      ['#(docs) hi\r\n', 'docs'], // space boundary already precedes the \r
      ['#!\r\n', '!'], // sigil
      ['#|\r\nA\r', ''], // empty-route block (CRLF), trailing \r left by stripTrailingNewline
    ])('%j -> route %j, not malformed/reserved', (text, route) => {
      const p = parsePrefix(text);
      expect(p.route).toBe(route);
      expect(p.malformation).toBeUndefined();
    });
  });

  describe('contentIndex (single separator excluded)', () => {
    test('single space, the content is everything after it', () => {
      const text = '#(docs) hello world';
      const p = parsePrefix(text);
      expect(text.slice(p.contentIndex)).toBe('hello world');
    });

    test('no whitespace -> empty content at end of text', () => {
      const text = '#(docs)';
      const p = parsePrefix(text);
      expect(p.contentIndex).toBe(text.length);
      expect(text.slice(p.contentIndex)).toBe('');
    });

    test('block: the newline is the separator', () => {
      const text = '#|(ABC)\n123';
      const p = parsePrefix(text);
      expect(p.route).toBe('ABC');
      expect(text.slice(p.contentIndex)).toBe('123');
    });
  });
});
