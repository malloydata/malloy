/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

export default [
  [
    {
      line: '// / \' " """ // unable to break out of /* line comments',
      tokens: [
        {
          startIndex: 0,
          type: [
            'source.malloy',
            'comment.line.double-slash',
            'punctuation.definition.comment',
          ],
          color: '#6A9955',
        },
        {
          startIndex: 2,
          type: ['source.malloy', 'comment.line.double-slash'],
          color: '#6A9955',
        },
      ],
    },
  ],
  [
    {
      line: ' -- a different -- line comment',
      tokens: [
        {startIndex: 0, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 1,
          type: [
            'source.malloy',
            'comment.line.double-hyphen',
            'punctuation.definition.comment',
          ],
          color: '#6A9955',
        },
        {
          startIndex: 3,
          type: ['source.malloy', 'comment.line.double-hyphen'],
          color: '#6A9955',
        },
      ],
    },
  ],
  [
    {
      line: '    /* *** / * // " " \' \\\'',
      tokens: [
        {startIndex: 0, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 4,
          type: [
            'source.malloy',
            'comment.block',
            'punctuation.definition.comment.begin',
          ],
          color: '#6A9955',
        },
        {
          startIndex: 6,
          type: ['source.malloy', 'comment.block'],
          color: '#6A9955',
        },
      ],
    },
    {
      line: '   """ multi-line * /*',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'comment.block'],
          color: '#6A9955',
        },
      ],
    },
    {
      line: '" */  -- escaped block',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'comment.block'],
          color: '#6A9955',
        },
        {
          startIndex: 2,
          type: [
            'source.malloy',
            'comment.block',
            'punctuation.definition.comment.end',
          ],
          color: '#6A9955',
        },
        {startIndex: 4, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 6,
          type: [
            'source.malloy',
            'comment.line.double-hyphen',
            'punctuation.definition.comment',
          ],
          color: '#6A9955',
        },
        {
          startIndex: 8,
          type: ['source.malloy', 'comment.line.double-hyphen'],
          color: '#6A9955',
        },
      ],
    },
  ],
  [
    {
      line: '  sample: true',
      tokens: [
        {startIndex: 0, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 2,
          type: ['source.malloy', 'keyword.control.sample'],
          color: '#C586C0',
        },
        {startIndex: 8, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 10,
          type: ['source.malloy', 'constant.language.true'],
          color: '#569CD6',
        },
      ],
    },
  ],
  [
    {
      line: 'fl1ght_y34r is `Year of Flight 256/* */`  -- escapes identifier',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'variable.other'],
          color: '#9CDCFE',
        },
        {startIndex: 11, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 12,
          type: ['source.malloy', 'keyword.control.is'],
          color: '#C586C0',
        },
        {startIndex: 14, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 15,
          type: ['source.malloy', 'variable.other.quoted'],
          color: '#9CDCFE',
        },
        {startIndex: 40, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 42,
          type: [
            'source.malloy',
            'comment.line.double-hyphen',
            'punctuation.definition.comment',
          ],
          color: '#6A9955',
        },
        {
          startIndex: 44,
          type: ['source.malloy', 'comment.line.double-hyphen'],
          color: '#6A9955',
        },
      ],
    },
  ],
  [
    {
      line: '`Year',
      tokens: [
        {startIndex: 0, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 1,
          type: ['source.malloy', 'keyword.other.timeframe'],
          color: '#569CD6',
        },
      ],
    },
    {
      line: '  -- escapes quoted identifier at newline',
      tokens: [
        {startIndex: 0, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 2,
          type: [
            'source.malloy',
            'comment.line.double-hyphen',
            'punctuation.definition.comment',
          ],
          color: '#6A9955',
        },
        {
          startIndex: 4,
          type: ['source.malloy', 'comment.line.double-hyphen'],
          color: '#6A9955',
        },
      ],
    },
  ],
  [
    {
      line: '`Disposable Income` is (0.88 * b1) + 84 / 100.00 * b2 + (.79 * `b3`)  ',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'variable.other.quoted'],
          color: '#9CDCFE',
        },
        {startIndex: 19, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 20,
          type: ['source.malloy', 'keyword.control.is'],
          color: '#C586C0',
        },
        {startIndex: 22, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 24,
          type: ['source.malloy', 'constant.numeric'],
          color: '#B5CEA8',
        },
        {startIndex: 28, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 31,
          type: ['source.malloy', 'variable.other'],
          color: '#9CDCFE',
        },
        {startIndex: 33, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 37,
          type: ['source.malloy', 'constant.numeric'],
          color: '#B5CEA8',
        },
        {startIndex: 39, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 42,
          type: ['source.malloy', 'constant.numeric'],
          color: '#B5CEA8',
        },
        {startIndex: 48, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 51,
          type: ['source.malloy', 'variable.other'],
          color: '#9CDCFE',
        },
        {startIndex: 53, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 57,
          type: ['source.malloy', 'constant.numeric'],
          color: '#B5CEA8',
        },
        {startIndex: 60, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 63,
          type: ['source.malloy', 'variable.other.quoted'],
          color: '#9CDCFE',
        },
        {startIndex: 67, type: ['source.malloy'], color: '#000000'},
      ],
    },
  ],
  [
    {
      line: '(123E4, 1E-27, E4, 0E+1)',
      tokens: [
        {startIndex: 0, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 1,
          type: ['source.malloy', 'constant.numeric'],
          color: '#B5CEA8',
        },
        {startIndex: 6, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 8,
          type: ['source.malloy', 'constant.numeric'],
          color: '#B5CEA8',
        },
        {startIndex: 13, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 15,
          type: ['source.malloy', 'variable.other'],
          color: '#9CDCFE',
        },
        {startIndex: 17, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 19,
          type: ['source.malloy', 'constant.numeric'],
          color: '#B5CEA8',
        },
        {startIndex: 23, type: ['source.malloy'], color: '#000000'},
      ],
    },
  ],
  [
    {
      line: 'avg(count(distinct session_id))',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'entity.name.function'],
          color: '#DCDCAA',
        },
        {startIndex: 3, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 4,
          type: ['source.malloy', 'entity.name.function'],
          color: '#DCDCAA',
        },
        {startIndex: 9, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 10,
          type: ['source.malloy', 'entity.name.function.modifier'],
          color: '#DCDCAA',
        },
        {startIndex: 18, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 19,
          type: ['source.malloy', 'variable.other'],
          color: '#9CDCFE',
        },
        {startIndex: 29, type: ['source.malloy'], color: '#000000'},
      ],
    },
  ],
  [
    {
      line: "`year` is year(dep_time)::string  // interpret year as 'categorical'",
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'variable.other.quoted'],
          color: '#9CDCFE',
        },
        {startIndex: 6, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 7,
          type: ['source.malloy', 'keyword.control.is'],
          color: '#C586C0',
        },
        {startIndex: 9, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 10,
          type: ['source.malloy', 'entity.name.function'],
          color: '#DCDCAA',
        },
        {startIndex: 14, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 15,
          type: ['source.malloy', 'variable.other'],
          color: '#9CDCFE',
        },
        {startIndex: 23, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 26,
          type: ['source.malloy', 'entity.name.type.string'],
          color: '#4EC9B0',
        },
        {startIndex: 32, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 34,
          type: [
            'source.malloy',
            'comment.line.double-slash',
            'punctuation.definition.comment',
          ],
          color: '#6A9955',
        },
        {
          startIndex: 36,
          type: ['source.malloy', 'comment.line.double-slash'],
          color: '#6A9955',
        },
      ],
    },
  ],
  [
    {
      line: 'is hash!number(us3r_n4me)  -- SQL function usage',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'keyword.control.is'],
          color: '#C586C0',
        },
        {startIndex: 2, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 3,
          type: ['source.malloy', 'entity.name.function'],
          color: '#DCDCAA',
        },
        {startIndex: 7, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 8,
          type: ['source.malloy', 'entity.name.type'],
          color: '#4EC9B0',
        },
        {startIndex: 14, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 15,
          type: ['source.malloy', 'variable.other'],
          color: '#9CDCFE',
        },
        {startIndex: 24, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 27,
          type: [
            'source.malloy',
            'comment.line.double-hyphen',
            'punctuation.definition.comment',
          ],
          color: '#6A9955',
        },
        {
          startIndex: 29,
          type: ['source.malloy', 'comment.line.double-hyphen'],
          color: '#6A9955',
        },
      ],
    },
  ],
  [
    {
      line: '(@2001-02-03 04:05:06.001[America/Mexico_City], @2005-01-28 12:12:12.999, @1961-02-14 09:30:15, @2017-10-03 07:23) ',
      tokens: [
        {startIndex: 0, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 1,
          type: ['source.malloy', 'constant.numeric.timestamp'],
          color: '#B5CEA8',
        },
        {startIndex: 46, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 48,
          type: ['source.malloy', 'constant.numeric.timestamp'],
          color: '#B5CEA8',
        },
        {startIndex: 72, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 74,
          type: ['source.malloy', 'constant.numeric.timestamp'],
          color: '#B5CEA8',
        },
        {startIndex: 94, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 96,
          type: ['source.malloy', 'constant.numeric.timestamp'],
          color: '#B5CEA8',
        },
        {
          startIndex: 113,
          type: ['source.malloy'],
          color: '#000000',
        },
      ],
    },
  ],
  [
    {
      line: 'event_time ~ @2003-Q1 for 6 quarters',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'variable.other'],
          color: '#9CDCFE',
        },
        {startIndex: 10, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 13,
          type: ['source.malloy', 'constant.numeric.date'],
          color: '#B5CEA8',
        },
        {startIndex: 21, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 22,
          type: ['source.malloy', 'keyword.other.for'],
          color: '#569CD6',
        },
        {startIndex: 25, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 26,
          type: ['source.malloy', 'constant.numeric'],
          color: '#B5CEA8',
        },
        {startIndex: 27, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 28,
          type: ['source.malloy', 'keyword.other.timeframe'],
          color: '#569CD6',
        },
      ],
    },
  ],
  [
    {
      line: '(@2021, @2022-06, @2022-09-09, @2023-06-25-WK)',
      tokens: [
        {startIndex: 0, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 1,
          type: ['source.malloy', 'constant.numeric.date'],
          color: '#B5CEA8',
        },
        {startIndex: 6, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 8,
          type: ['source.malloy', 'constant.numeric.date'],
          color: '#B5CEA8',
        },
        {startIndex: 16, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 18,
          type: ['source.malloy', 'constant.numeric.date'],
          color: '#B5CEA8',
        },
        {startIndex: 29, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 31,
          type: ['source.malloy', 'constant.numeric.date'],
          color: '#B5CEA8',
        },
        {startIndex: 45, type: ['source.malloy'], color: '#000000'},
      ],
    },
  ],
  [
    {
      line: "'a string with \\escapes\\u0FF1 \\'more\\",
      tokens: [
        {
          startIndex: 0,
          type: [
            'source.malloy',
            'string.quoted.single',
            'punctuation.definition.string.begin',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 1,
          type: ['source.malloy', 'string.quoted.single'],
          color: '#CE9178',
        },
        {
          startIndex: 15,
          type: [
            'source.malloy',
            'string.quoted.single',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 17,
          type: ['source.malloy', 'string.quoted.single'],
          color: '#CE9178',
        },
        {
          startIndex: 23,
          type: [
            'source.malloy',
            'string.quoted.single',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 29,
          type: ['source.malloy', 'string.quoted.single'],
          color: '#CE9178',
        },
        {
          startIndex: 30,
          type: [
            'source.malloy',
            'string.quoted.single',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 32,
          type: ['source.malloy', 'string.quoted.single'],
          color: '#CE9178',
        },
      ],
    },
  ],
  [
    {
      line: 'state ? """ multiple " " \\u "" \\u2001 \' /* -- // " \\',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'variable.other'],
          color: '#9CDCFE',
        },
        {startIndex: 5, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 8,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.begin',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 9,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.end',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 10,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.begin',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 11,
          type: ['source.malloy', 'string.quoted.double'],
          color: '#CE9178',
        },
        {
          startIndex: 21,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.end',
          ],
          color: '#CE9178',
        },
        {startIndex: 22, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 23,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.begin',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 24,
          type: ['source.malloy', 'string.quoted.double'],
          color: '#CE9178',
        },
        {
          startIndex: 25,
          type: [
            'source.malloy',
            'string.quoted.double',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 27,
          type: ['source.malloy', 'string.quoted.double'],
          color: '#CE9178',
        },
        {
          startIndex: 28,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.end',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 29,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.begin',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 30,
          type: ['source.malloy', 'string.quoted.double'],
          color: '#CE9178',
        },
        {
          startIndex: 31,
          type: [
            'source.malloy',
            'string.quoted.double',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 37,
          type: ['source.malloy', 'string.quoted.double'],
          color: '#CE9178',
        },
        {
          startIndex: 49,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.end',
          ],
          color: '#CE9178',
        },
        {startIndex: 50, type: ['source.malloy'], color: '#000000'},
      ],
    },
    {
      line: ' lines ',
      tokens: [
        {startIndex: 0, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 1,
          type: ['source.malloy', 'variable.other'],
          color: '#9CDCFE',
        },
        {startIndex: 6, type: ['source.malloy'], color: '#000000'},
      ],
    },
    {
      line: ' """  -- exited',
      tokens: [
        {startIndex: 0, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 1,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.begin',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 2,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.end',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 3,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.begin',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 4,
          type: ['source.malloy', 'string.quoted.double'],
          color: '#CE9178',
        },
      ],
    },
  ],
  [
    {
      line: "/'regexp string /*-- \\escapes\\uFFFF \\'more\\",
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'string.regexp'],
          color: '#D16969',
        },
        {
          startIndex: 2,
          type: ['source.malloy', 'string.regexp'],
          color: '#D16969',
        },
        {
          startIndex: 21,
          type: [
            'source.malloy',
            'string.regexp',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 23,
          type: ['source.malloy', 'string.regexp'],
          color: '#D16969',
        },
        {
          startIndex: 29,
          type: [
            'source.malloy',
            'string.regexp',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 31,
          type: ['source.malloy', 'string.regexp'],
          color: '#D16969',
        },
        {
          startIndex: 36,
          type: [
            'source.malloy',
            'string.regexp',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 38,
          type: ['source.malloy', 'string.regexp'],
          color: '#D16969',
        },
      ],
    },
  ],
  [
    {
      line: '"/* -- \\e\\uFFFF \\\'\\',
      tokens: [
        {
          startIndex: 0,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.begin',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 1,
          type: ['source.malloy', 'string.quoted.double'],
          color: '#CE9178',
        },
        {
          startIndex: 7,
          type: [
            'source.malloy',
            'string.quoted.double',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 9,
          type: [
            'source.malloy',
            'string.quoted.double',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 15,
          type: ['source.malloy', 'string.quoted.double'],
          color: '#CE9178',
        },
        {
          startIndex: 16,
          type: [
            'source.malloy',
            'string.quoted.double',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 18,
          type: ['source.malloy', 'string.quoted.double'],
          color: '#CE9178',
        },
      ],
    },
  ],
  [
    {
      line: "state ~ 'CA' | r'M.' | \"CO\" | /'O.'  -- end",
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'variable.other'],
          color: '#9CDCFE',
        },
        {startIndex: 5, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 8,
          type: [
            'source.malloy',
            'string.quoted.single',
            'punctuation.definition.string.begin',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 9,
          type: ['source.malloy', 'string.quoted.single'],
          color: '#CE9178',
        },
        {
          startIndex: 11,
          type: [
            'source.malloy',
            'string.quoted.single',
            'punctuation.definition.string.end',
          ],
          color: '#CE9178',
        },
        {startIndex: 12, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 15,
          type: ['source.malloy', 'string.regexp'],
          color: '#D16969',
        },
        {
          startIndex: 17,
          type: ['source.malloy', 'string.regexp'],
          color: '#D16969',
        },
        {
          startIndex: 19,
          type: ['source.malloy', 'string.regexp'],
          color: '#D16969',
        },
        {startIndex: 20, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 23,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.begin',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 24,
          type: ['source.malloy', 'string.quoted.double'],
          color: '#CE9178',
        },
        {
          startIndex: 26,
          type: [
            'source.malloy',
            'string.quoted.double',
            'punctuation.definition.string.end',
          ],
          color: '#CE9178',
        },
        {startIndex: 27, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 30,
          type: ['source.malloy', 'string.regexp'],
          color: '#D16969',
        },
        {
          startIndex: 32,
          type: ['source.malloy', 'string.regexp'],
          color: '#D16969',
        },
        {
          startIndex: 34,
          type: ['source.malloy', 'string.regexp'],
          color: '#D16969',
        },
        {startIndex: 35, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 37,
          type: [
            'source.malloy',
            'comment.line.double-hyphen',
            'punctuation.definition.comment',
          ],
          color: '#6A9955',
        },
        {
          startIndex: 39,
          type: ['source.malloy', 'comment.line.double-hyphen'],
          color: '#6A9955',
        },
      ],
    },
  ],
  [
    {
      line: 'run: duckdb.sql("""',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'keyword.control.run'],
          color: '#C586C0',
        },
        {startIndex: 3, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 5,
          type: ['source.malloy', 'source.sql', 'variable.other'],
          color: '#9CDCFE',
        },
        {
          startIndex: 11,
          type: ['source.malloy', 'source.sql'],
          color: '#000000',
        },
        {
          startIndex: 12,
          type: ['source.malloy', 'source.sql', 'keyword.control.sql'],
          color: '#C586C0',
        },
        {
          startIndex: 15,
          type: ['source.malloy', 'source.sql'],
          color: '#000000',
        },
        {
          startIndex: 16,
          type: ['source.malloy', 'source.sql', 'punctuation.sql-block.open'],
          color: '#000000',
        },
      ],
    },
    {
      line: '  SELECT 1',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'source.sql'],
          color: '#000000',
        },
      ],
    },
    {
      line: '""")',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'source.sql', 'punctuation.sql-block.close'],
          color: '#000000',
        },
        {startIndex: 3, type: ['source.malloy'], color: '#000000'},
      ],
    },
  ],
];
