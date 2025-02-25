/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Tokenizer, SpecialToken, TokenizerParams} from './tokenizer';
import {Token} from './token_types';

function makeParams(): TokenizerParams {
  const specialSubstrings: SpecialToken[] = [
    {type: ',', value: ','},
    {type: 'VARIABLE', value: /^\$\{[^}]+\}/},
  ];
  const specialWords: SpecialToken[] = [
    {type: 'NULL', value: 'null', ignoreCase: true},
    {type: 'EMPTY', value: 'empty', ignoreCase: true},
    {type: 'NOTNULL', value: '-null', ignoreCase: true},
    {type: 'NOTEMPTY', value: '-empty', ignoreCase: true},
    {
      type: 'DAYOFWEEK',
      value: /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
      ignoreCase: true,
    },
    {type: 'STATE', value: /^(California|Washington)$/i},
    {type: 'DATE', value: /^\d\d\d\d-\d\d-\d\d$/},
    {type: 'DATE', value: /^\d\d\d\d-\d\d$/},
    {type: 'DATE', value: /^\d\d\d\d$/},
  ];
  return {
    splitOnWhitespace: true,
    trimWordWhitespace: true,
    specialSubstrings,
    specialWords,
  };
}

describe('Tokenizer', () => {
  const makeToken = (
    type: string,
    value: string,
    startIndex: number,
    endIndex: number
  ): Token => ({type, value, startIndex, endIndex});
  it('should tokenize a simple string', () => {
    const input = 'hello world';
    const expectedTokens = [
      makeToken('word', 'hello', 0, 5),
      makeToken('word', 'world', 6, 11),
    ];
    expect(new Tokenizer(input, makeParams()).parse()).toEqual(expectedTokens);
  });
  it('should split adjacent characters when no whitespace', () => {
    const specialSubstrings: SpecialToken[] = [
      {type: ',', value: ','},
      {type: 'exclamation', value: '!'},
      {type: 'bracket', value: '['},
    ];
    const input = '[hello],big,world!';
    const expectedTokens = [
      makeToken('bracket', '[', 0, 1),
      makeToken('word', 'hello]', 1, 7),
      makeToken(',', ',', 7, 8),
      makeToken('word', 'big', 8, 11),
      makeToken(',', ',', 11, 12),
      makeToken('word', 'world', 12, 17),
      makeToken('exclamation', '!', 17, 18),
    ];
    expect(
      new Tokenizer(input, {...makeParams(), specialSubstrings}).parse()
    ).toEqual(expectedTokens);
  });
  it('should match special tokens', () => {
    const input = 'hello NULL world,-Null,-\'NULL" ,NULL, NULL ,  ';
    const expectedTokens = [
      makeToken('word', 'hello', 0, 5),
      makeToken('NULL', 'NULL', 6, 10),
      makeToken('word', 'world', 11, 16),
      makeToken(',', ',', 16, 17),
      makeToken('NOTNULL', '-NULL', 17, 22),
      makeToken(',', ',', 22, 23),
      makeToken('word', '-\'NULL"', 23, 30),
      makeToken(',', ',', 31, 32),
      makeToken('NULL', 'NULL', 32, 36),
      makeToken(',', ',', 36, 37),
      makeToken('NULL', 'NULL', 38, 42),
      makeToken(',', ',', 43, 44),
    ];
    const params = makeParams();
    expect(new Tokenizer(input, params).parse()).toEqual(expectedTokens);
  });
  it('should not combine adjacent words', () => {
    const input = 'ABC DEF';
    const expectedTokens = [
      makeToken('word', 'ABC', 0, 3),
      makeToken('word', 'DEF', 4, 7),
    ];
    const params = makeParams();
    expect(new Tokenizer(input, params).parse()).toEqual(expectedTokens);
  });
  it('should combine adjacent words when combineAdjacentWords', () => {
    const input = 'ABC DEF';
    const expectedTokens = [makeToken('word', 'ABCDEF', 0, 7)];
    const params = {...makeParams(), combineAdjacentWords: true};
    expect(new Tokenizer(input, params).parse()).toEqual(expectedTokens);
  });
  it('escaping should prevent special token matching', () => {
    const input = 'N\\ULL';
    const expectedTokens = [makeToken('word', 'N\\ULL', 0, 5)];
    expect(new Tokenizer(input, makeParams()).parse()).toEqual(expectedTokens);
  });
  it('should match escaped characters', () => {
    const input = 'hello \\n world';
    const expectedTokens = [
      makeToken('word', 'hello', 0, 5),
      makeToken('word', '\\n', 6, 8),
      makeToken('word', 'world', 9, 14),
    ];
    expect(new Tokenizer(input, makeParams()).parse()).toEqual(expectedTokens);
  });
  it('should preserve all escaped characters', () => {
    const input = "he'llo \\t \\${w}or\\,ld";
    const expectedTokens = [
      makeToken('word', "he'llo", 0, 6),
      makeToken('word', '\\t', 7, 9),
      makeToken('word', '\\${w}or\\,ld', 10, 21),
    ];
    expect(new Tokenizer(input, makeParams()).parse()).toEqual(expectedTokens);
  });
  it('should match regexp and capitalize special matches', () => {
    const input =
      "hello tuesDAY,ttuesday, tuesdayy ,Tuesday , ttuesday, 'TUESday' ";
    const expectedTokens = [
      makeToken('word', 'hello', 0, 5),
      makeToken('DAYOFWEEK', 'TUESDAY', 6, 13),
      makeToken(',', ',', 13, 14),
      makeToken('word', 'ttuesday', 14, 22),
      makeToken(',', ',', 22, 23),
      makeToken('word', 'tuesdayy', 24, 32),
      makeToken(',', ',', 33, 34),
      makeToken('DAYOFWEEK', 'TUESDAY', 34, 41),
      makeToken(',', ',', 42, 43),
      makeToken('word', 'ttuesday', 44, 52),
      makeToken(',', ',', 52, 53),
      makeToken('word', "'TUESday'", 54, 63),
    ];
    expect(new Tokenizer(input, makeParams()).parse()).toEqual(expectedTokens);
  });
  it('should match regexp and not capitalize', () => {
    const input = 'Washington, Washingo,washington,wWashington ';
    const expectedTokens = [
      makeToken('STATE', 'Washington', 0, 10),
      makeToken(',', ',', 10, 11),
      makeToken('word', 'Washingo', 12, 20),
      makeToken(',', ',', 20, 21),
      makeToken('STATE', 'washington', 21, 31),
      makeToken(',', ',', 31, 32),
      makeToken('word', 'wWashington', 32, 43),
    ];
    expect(new Tokenizer(input, makeParams()).parse()).toEqual(expectedTokens);
  });
  it('should match substring regexp', () => {
    const input = 'hello  \\${var1},aa${var2}bb, cc${var3} dd';
    const expectedTokens = [
      makeToken('word', 'hello', 0, 5),
      makeToken('word', '\\${var1}', 7, 15),
      makeToken(',', ',', 15, 16),
      makeToken('word', 'aa', 16, 18),
      makeToken('VARIABLE', '${var2}', 18, 25),
      makeToken('word', 'bb', 25, 27),
      makeToken(',', ',', 27, 28),
      makeToken('word', 'cc', 29, 31),
      makeToken('VARIABLE', '${var3}', 31, 38),
      makeToken('word', 'dd', 39, 41),
    ];
    expect(new Tokenizer(input, makeParams()).parse()).toEqual(expectedTokens);
  });

  describe('mergeTypes', () => {
    it('should return an empty array when input is empty', () => {
      const result = Tokenizer.mergeTypes('', [], 'merged');
      expect(result).toEqual([]);
    });

    it('should not merge tokens when no match is found', () => {
      const tokens: Token[] = [
        {type: 'x', value: '1', startIndex: 0, endIndex: 1},
        {type: 'y', value: '2', startIndex: 1, endIndex: 2},
      ];
      const result = Tokenizer.mergeTypes('a|b', tokens, 'merged');
      expect(result).toEqual(tokens);
    });

    it('should merge tokens when a single match is found', () => {
      const tokens: Token[] = [
        {type: 'a', value: '1', startIndex: 0, endIndex: 1},
        {type: 'b', value: '2', startIndex: 1, endIndex: 2},
      ];
      const expected: Token[] = [
        {
          type: 'merged',
          value: '',
          values: [tokens[0], tokens[1]],
          startIndex: 0,
          endIndex: 2,
        },
      ];
      const result = Tokenizer.mergeTypes('a|b', tokens, 'merged');
      expect(result).toEqual(expected);
    });

    it('should merge multiple matches', () => {
      const tokens: Token[] = [
        {type: 'a', value: '1', startIndex: 0, endIndex: 1},
        {type: 'b', value: '2', startIndex: 1, endIndex: 2},
        {type: 'a', value: '3', startIndex: 2, endIndex: 3},
        {type: 'b', value: '4', startIndex: 3, endIndex: 4},
      ];
      const expected: Token[] = [
        {
          type: 'merged',
          value: '',
          values: [tokens[0], tokens[1]],
          startIndex: 0,
          endIndex: 2,
        },
        {
          type: 'merged',
          value: '',
          values: [tokens[2], tokens[3]],
          startIndex: 2,
          endIndex: 4,
        },
      ];
      const result = Tokenizer.mergeTypes('a|b', tokens, 'merged');
      expect(result).toEqual(expected);
    });

    it('should not merge partial matches', () => {
      const tokens: Token[] = [
        {type: 'a', value: '1', startIndex: 0, endIndex: 1},
        {type: 'b', value: '2', startIndex: 1, endIndex: 2},
      ];
      const result = Tokenizer.mergeTypes('a|b|c', tokens, 'merged');
      expect(result).toEqual(tokens);
    });
  });

  describe('matchTypes', () => {
    it('should return tokens when types match', () => {
      const tokens = [makeToken('a', '1', 0, 1), makeToken('b', '2', 1, 2)];
      expect(Tokenizer.matchTypes('a|b', tokens, 0)).toEqual(tokens);
    });

    it('should return undefined when types do not match', () => {
      const tokens = [makeToken('x', '1', 0, 1), makeToken('y', '2', 1, 2)];
      expect(Tokenizer.matchTypes('a|b', tokens, 0)).toBeUndefined();
    });

    it('should return undefined when index is out of range', () => {
      const tokens = [makeToken('a', '1', 0, 1)];
      expect(Tokenizer.matchTypes('a|b', tokens, 1)).toBeUndefined();
    });

    it('should return all matching tokens when multiple types match', () => {
      const tokens = [
        makeToken('a', '1', 0, 1),
        makeToken('b', '2', 1, 2),
        makeToken('c', '3', 2, 3),
      ];
      expect(Tokenizer.matchTypes('a|b|c', tokens, 0)).toEqual(tokens);
    });

    it('should return only matching tokens when partial match occurs', () => {
      const tokens = [makeToken('a', '1', 0, 1), makeToken('b', '2', 1, 2)];
      expect(Tokenizer.matchTypes('a|b|c', tokens, 0)).toBeUndefined();
    });
  });
});
