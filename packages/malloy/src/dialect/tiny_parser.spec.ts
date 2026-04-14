/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {TinyParser} from './tiny_parser';

describe('TinyParser', () => {
  test('read consumes the next token without requiring a type', () => {
    const parser = new TinyParser('abc)', {
      id: /^\w+/,
      char: /^[()]/,
    });

    expect(parser.read().text).toBe('abc');
    expect(parser.read().type).toBe(')');
  });

  test('match is atomic for token types', () => {
    const parser = new TinyParser('abc)', {
      id: /^\w+/,
      char: /^[()]/,
    });

    expect(parser.match('id', '(')).toBeUndefined();
    expect(parser.expect('id').text).toBe('abc');
    expect(parser.expect(')').type).toBe(')');
  });

  test('match remains atomic when a longer sequence fails at the last token', () => {
    const parser = new TinyParser('a b c', {
      space: /^\s+/,
      id: /^\w+/,
    });

    expect(parser.match('id', 'id', '(')).toBeUndefined();
    expect(parser.expect('id').text).toBe('a');
    expect(parser.expect('id').text).toBe('b');
    expect(parser.expect('id').text).toBe('c');
  });

  test('matchText is atomic and case-insensitive', () => {
    const parser = new TinyParser('with x', {
      space: /^\s+/,
      id: /^\w+/,
    });

    expect(parser.matchText('WITH', 'TIME')).toBeUndefined();
    expect(parser.expect('id').text).toBe('with');
    expect(parser.expect('id').text).toBe('x');
  });

  test('expect and expectText consume required sequences', () => {
    const parser = new TinyParser('with time zone', {
      space: /^\s+/,
      id: /^\w+/,
    });

    expect(parser.expect('id').text).toBe('with');
    expect(parser.expectText('time', 'zone').text).toBe('zone');
  });

  test('expect reports errors at the current token cursor', () => {
    const parser = new TinyParser('abc )', {
      space: /^\s+/,
      id: /^\w+/,
      char: /^[()]/,
    });

    parser.expect('id');
    expect(() => parser.expect('(')).toThrow('abc )\n    ^');
  });

  test('skipTo consumes until the requested token', () => {
    const parser = new TinyParser('a b )', {
      space: /^\s+/,
      id: /^\w+/,
      char: /^[)]/,
    });

    parser.skipTo(')');
    expect(parser.peek().type).toBe('eof');
  });

  test('expect and match helpers reject zero-argument misuse', () => {
    const parser = new TinyParser('abc', {id: /^\w+/});

    expect(() => parser.expect()).toThrow('TinyParser.expect()');
    expect(() => parser.expectText()).toThrow('TinyParser.expectText()');
    expect(() => parser.match()).toThrow('TinyParser.match()');
    expect(() => parser.matchText()).toThrow('TinyParser.matchText()');
  });

  test('dump applies special token conventions', () => {
    const parser = new TinyParser(' "abc",x', {
      space: /^\s+/,
      qstr: /^"[^"]*"/,
      char: /^[,]/,
      id: /^\w+/,
    });

    expect(parser.dump()).toEqual([
      {cursor: 1, type: 'qstr', text: 'abc'},
      {cursor: 6, type: ',', text: ','},
      {cursor: 7, type: 'id', text: 'x'},
    ]);
  });
});
