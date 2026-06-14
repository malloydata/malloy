/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export default [
  [
    {
      line: `// / ' " """ // unable to break out of /* line comments`,
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
      line: `    /* *** / * // " " ' \\'`,
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
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 8, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 10,
          type: ['source.malloy', 'constant.language.malloy'],
          color: '#569CD6',
        },
      ],
    },
  ],
  [
    {
      line: 'type: t is filter<timestamptz>  given: g is number',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 4, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 6,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 7, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 8,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 10, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 11,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 17, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 18,
          type: ['source.malloy', 'storage.type.malloy'],
          color: '#569CD6',
        },
        {startIndex: 29, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 32,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 37, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 39,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 40, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 41,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 43, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 44,
          type: ['source.malloy', 'storage.type.malloy'],
          color: '#569CD6',
        },
      ],
    },
  ],
  [
    {
      line: "export source: s is from(q) extend { where: name like r'A' and id in (1) }",
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 6, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 7,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 13, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 15,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 16, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 17,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 19, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 20,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 24, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 25,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 26, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 28,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 34, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 37,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 42, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 44,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 48, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 49,
          type: ['source.malloy', 'keyword.operator.malloy'],
          color: '#D4D4D4',
        },
        {startIndex: 53, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 54,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {
          startIndex: 56,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {
          startIndex: 57,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {startIndex: 58, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 59,
          type: ['source.malloy', 'keyword.operator.malloy'],
          color: '#D4D4D4',
        },
        {startIndex: 62, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 63,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 65, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 66,
          type: ['source.malloy', 'keyword.operator.malloy'],
          color: '#D4D4D4',
        },
        {startIndex: 68, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 70,
          type: ['source.malloy', 'constant.numeric'],
          color: '#B5CEA8',
        },
        {startIndex: 71, type: ['source.malloy'], color: '#000000'},
      ],
    },
  ],
  [
    {
      line: 'view: v is { group_by: g is case when x then cast(y as string) else z end }',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 4, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 6,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 7, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 8,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 10, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 13,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 21, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 23,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 24, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 25,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 27, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 28,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 32, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 33,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 37, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 38,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 39, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 40,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 44, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 45,
          type: ['source.malloy', 'support.function.malloy'],
          color: '#DCDCAA',
        },
        {startIndex: 49, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 50,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 51, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 52,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 54, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 55,
          type: ['source.malloy', 'storage.type.malloy'],
          color: '#569CD6',
        },
        {startIndex: 61, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 63,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 67, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 68,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 69, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 70,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 73, type: ['source.malloy'], color: '#000000'},
      ],
    },
  ],
  [
    {
      line: 'run: m -> { aggregate: a is all(sum(n)) exclude(count()) compose(b, c) } join_one: o is t on a = b inner left right full',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 3, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 5,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 6, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 12,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 21, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 23,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 24, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 25,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 27, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 28,
          type: ['source.malloy', 'support.function.malloy'],
          color: '#DCDCAA',
        },
        {startIndex: 31, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 32,
          type: ['source.malloy', 'support.function.malloy'],
          color: '#DCDCAA',
        },
        {startIndex: 35, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 36,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 37, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 40,
          type: ['source.malloy', 'support.function.malloy'],
          color: '#DCDCAA',
        },
        {startIndex: 47, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 48,
          type: ['source.malloy', 'support.function.malloy'],
          color: '#DCDCAA',
        },
        {startIndex: 53, type: ['source.malloy'], color: '#000000'},
        {startIndex: 54, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 57,
          type: ['source.malloy', 'support.function.malloy'],
          color: '#DCDCAA',
        },
        {startIndex: 64, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 65,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 66, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 68,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 69, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 73,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 81, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 83,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 84, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 85,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 87, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 88,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 89, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 90,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 92, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 93,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 94, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 97,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 98, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 99,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {
          startIndex: 104,
          type: ['source.malloy'],
          color: '#000000',
        },
        {
          startIndex: 105,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {
          startIndex: 109,
          type: ['source.malloy'],
          color: '#000000',
        },
        {
          startIndex: 110,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {
          startIndex: 115,
          type: ['source.malloy'],
          color: '#000000',
        },
        {
          startIndex: 116,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
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
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 11, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 12,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 14, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 15,
          type: ['source.malloy', 'variable.other.quoted.malloy'],
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
          type: ['source.malloy', 'keyword.other.timeframe.malloy'],
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
          type: ['source.malloy', 'variable.other.quoted.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 19, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 20,
          type: ['source.malloy', 'keyword.control.malloy'],
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
          type: ['source.malloy', 'variable.other.malloy'],
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
          type: ['source.malloy', 'variable.other.malloy'],
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
          type: ['source.malloy', 'variable.other.quoted.malloy'],
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
          type: ['source.malloy', 'variable.other.malloy'],
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
          type: ['source.malloy', 'support.function.malloy'],
          color: '#DCDCAA',
        },
        {startIndex: 3, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 4,
          type: ['source.malloy', 'support.function.malloy'],
          color: '#DCDCAA',
        },
        {startIndex: 9, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 10,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 18, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 19,
          type: ['source.malloy', 'variable.other.malloy'],
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
          type: ['source.malloy', 'variable.other.quoted.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 6, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 7,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 9, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 10,
          type: ['source.malloy', 'entity.name.function.malloy'],
          color: '#DCDCAA',
        },
        {startIndex: 14, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 15,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 23, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 26,
          type: ['source.malloy', 'storage.type.malloy'],
          color: '#569CD6',
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
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 2, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 3,
          type: ['source.malloy', 'entity.name.function.malloy'],
          color: '#DCDCAA',
        },
        {startIndex: 7, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 8,
          type: ['source.malloy', 'storage.type.malloy'],
          color: '#569CD6',
        },
        {startIndex: 14, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 15,
          type: ['source.malloy', 'variable.other.malloy'],
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
          type: ['source.malloy', 'variable.other.malloy'],
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
          type: ['source.malloy', 'keyword.operator.malloy'],
          color: '#D4D4D4',
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
          type: ['source.malloy', 'keyword.other.timeframe.malloy'],
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
            'string.quoted.single.malloy',
            'punctuation.definition.string.begin.malloy',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 1,
          type: ['source.malloy', 'string.quoted.single.malloy'],
          color: '#CE9178',
        },
        {
          startIndex: 15,
          type: [
            'source.malloy',
            'string.quoted.single.malloy',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 17,
          type: ['source.malloy', 'string.quoted.single.malloy'],
          color: '#CE9178',
        },
        {
          startIndex: 23,
          type: [
            'source.malloy',
            'string.quoted.single.malloy',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 29,
          type: ['source.malloy', 'string.quoted.single.malloy'],
          color: '#CE9178',
        },
        {
          startIndex: 30,
          type: [
            'source.malloy',
            'string.quoted.single.malloy',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 32,
          type: ['source.malloy', 'string.quoted.single.malloy'],
          color: '#CE9178',
        },
      ],
    },
  ],
  [
    {
      line: `state ? """ multiple " " \\u "" \\u2001 ' /* -- // " \\`,
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 5, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 8,
          type: [
            'source.malloy',
            'string.quoted.triple.malloy',
            'punctuation.definition.string.begin.malloy',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 11,
          type: ['source.malloy', 'string.quoted.triple.malloy'],
          color: '#CE9178',
        },
      ],
    },
    {
      line: ' lines ',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'string.quoted.triple.malloy'],
          color: '#CE9178',
        },
      ],
    },
    {
      line: ' """  -- exited',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'string.quoted.triple.malloy'],
          color: '#CE9178',
        },
        {
          startIndex: 1,
          type: [
            'source.malloy',
            'string.quoted.triple.malloy',
            'punctuation.definition.string.end.malloy',
          ],
          color: '#CE9178',
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
      line: "/'regexp string /*-- \\escapes\\uFFFF \\'more\\",
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {
          startIndex: 2,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {
          startIndex: 21,
          type: [
            'source.malloy',
            'string.regexp.malloy',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 23,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {
          startIndex: 29,
          type: [
            'source.malloy',
            'string.regexp.malloy',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 31,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {
          startIndex: 36,
          type: [
            'source.malloy',
            'string.regexp.malloy',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 38,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
      ],
    },
  ],
  [
    {
      line: `"/* -- \\e\\uFFFF \\'\\`,
      tokens: [
        {
          startIndex: 0,
          type: [
            'source.malloy',
            'string.quoted.double.malloy',
            'punctuation.definition.string.begin.malloy',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 1,
          type: ['source.malloy', 'string.quoted.double.malloy'],
          color: '#CE9178',
        },
        {
          startIndex: 7,
          type: [
            'source.malloy',
            'string.quoted.double.malloy',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 9,
          type: [
            'source.malloy',
            'string.quoted.double.malloy',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 15,
          type: ['source.malloy', 'string.quoted.double.malloy'],
          color: '#CE9178',
        },
        {
          startIndex: 16,
          type: [
            'source.malloy',
            'string.quoted.double.malloy',
            'constant.character.escape',
            'constant.character.escape',
          ],
          color: '#D7BA7D',
        },
        {
          startIndex: 18,
          type: ['source.malloy', 'string.quoted.double.malloy'],
          color: '#CE9178',
        },
      ],
    },
  ],
  [
    {
      line: `state ~ 'CA' | r'M.' | "CO" | /'O.'  -- end`,
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 5, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 8,
          type: [
            'source.malloy',
            'string.quoted.single.malloy',
            'punctuation.definition.string.begin.malloy',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 9,
          type: ['source.malloy', 'string.quoted.single.malloy'],
          color: '#CE9178',
        },
        {
          startIndex: 11,
          type: [
            'source.malloy',
            'string.quoted.single.malloy',
            'punctuation.definition.string.end.malloy',
          ],
          color: '#CE9178',
        },
        {startIndex: 12, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 15,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {
          startIndex: 17,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {
          startIndex: 19,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {startIndex: 20, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 23,
          type: [
            'source.malloy',
            'string.quoted.double.malloy',
            'punctuation.definition.string.begin.malloy',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 24,
          type: ['source.malloy', 'string.quoted.double.malloy'],
          color: '#CE9178',
        },
        {
          startIndex: 26,
          type: [
            'source.malloy',
            'string.quoted.double.malloy',
            'punctuation.definition.string.end.malloy',
          ],
          color: '#CE9178',
        },
        {startIndex: 27, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 30,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {
          startIndex: 32,
          type: ['source.malloy', 'string.regexp.malloy'],
          color: '#D16969',
        },
        {
          startIndex: 34,
          type: ['source.malloy', 'string.regexp.malloy'],
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
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 3, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 5,
          type: [
            'source.malloy',
            'meta.embedded.block.sql.malloy',
            'variable.other.malloy',
          ],
          color: '#9CDCFE',
        },
        {
          startIndex: 11,
          type: ['source.malloy', 'meta.embedded.block.sql.malloy'],
          color: '#D4D4D4',
        },
        {
          startIndex: 12,
          type: [
            'source.malloy',
            'meta.embedded.block.sql.malloy',
            'keyword.control.sql.malloy',
          ],
          color: '#C586C0',
        },
        {
          startIndex: 15,
          type: ['source.malloy', 'meta.embedded.block.sql.malloy'],
          color: '#D4D4D4',
        },
        {
          startIndex: 16,
          type: [
            'source.malloy',
            'meta.embedded.block.sql.malloy',
            'punctuation.definition.string.begin.sql.malloy',
          ],
          color: '#D4D4D4',
        },
      ],
    },
    {
      line: '  SELECT 1',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'meta.embedded.block.sql.malloy'],
          color: '#D4D4D4',
        },
      ],
    },
    {
      line: '""")',
      tokens: [
        {
          startIndex: 0,
          type: [
            'source.malloy',
            'meta.embedded.block.sql.malloy',
            'punctuation.definition.string.end.sql.malloy',
          ],
          color: '#D4D4D4',
        },
        {startIndex: 3, type: ['source.malloy'], color: '#000000'},
      ],
    },
  ],
  [
    {
      line: '#|',
      tokens: [
        {
          startIndex: 0,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'punctuation.definition.annotation.begin.malloy',
          ],
          color: '#000000',
        },
      ],
    },
    {
      line: '  renderer=sparkline size=large',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 2,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 10,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'keyword.operator.assignment.malloy',
          ],
          color: '#D4D4D4',
        },
        {
          startIndex: 11,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 20,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 21,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 25,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'keyword.operator.assignment.malloy',
          ],
          color: '#D4D4D4',
        },
        {
          startIndex: 26,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
      ],
    },
    {
      line: '|#',
      tokens: [
        {
          startIndex: 0,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'punctuation.definition.annotation.end.malloy',
          ],
          color: '#000000',
        },
      ],
    },
    {
      line: 'dimension: x is 1',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 9, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 11,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 12, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 13,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 15, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 16,
          type: ['source.malloy', 'constant.numeric'],
          color: '#B5CEA8',
        },
      ],
    },
  ],
  [
    {
      line: '##|',
      tokens: [
        {
          startIndex: 0,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'punctuation.definition.annotation.begin.malloy',
          ],
          color: '#000000',
        },
      ],
    },
    {
      line: '  model_tag=value',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 2,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 11,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'keyword.operator.assignment.malloy',
          ],
          color: '#D4D4D4',
        },
        {
          startIndex: 12,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
      ],
    },
    {
      line: '|##',
      tokens: [
        {
          startIndex: 0,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'punctuation.definition.annotation.end.malloy',
          ],
          color: '#000000',
        },
      ],
    },
  ],
  [
    {
      line: '#|',
      tokens: [
        {
          startIndex: 0,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'punctuation.definition.annotation.begin.malloy',
          ],
          color: '#000000',
        },
      ],
    },
    {
      line: '  This stuff is a comment, seee',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 2,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 6,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 7,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 12,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 13,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 15,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 16,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 17,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 18,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 25,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 27,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
      ],
    },
    {
      line: '  source: jst a comment',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 2,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 8,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 10,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 13,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 14,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 15,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 16,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
      ],
    },
    {
      line: '  and i can indeent',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 2,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 5,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 6,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 7,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 8,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 11,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 12,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
      ],
    },
    {
      line: '  #| more comments',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 5,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
        {
          startIndex: 9,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
        {
          startIndex: 10,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'entity.name.tag.malloy',
          ],
          color: '#569CD6',
        },
      ],
    },
    {
      line: '    |#',
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'meta.annotation.block.malloy'],
          color: '#000000',
        },
      ],
    },
    {
      line: '|#',
      tokens: [
        {
          startIndex: 0,
          type: [
            'source.malloy',
            'meta.annotation.block.malloy',
            'punctuation.definition.annotation.end.malloy',
          ],
          color: '#000000',
        },
      ],
    },
    {
      line: "source: flights is trino_test.table('malloytest.flights')",
      tokens: [
        {
          startIndex: 0,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 6, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 8,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 15, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 16,
          type: ['source.malloy', 'keyword.control.malloy'],
          color: '#C586C0',
        },
        {startIndex: 18, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 19,
          type: ['source.malloy', 'variable.other.malloy'],
          color: '#9CDCFE',
        },
        {startIndex: 29, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 30,
          type: ['source.malloy', 'entity.name.function.malloy'],
          color: '#DCDCAA',
        },
        {startIndex: 35, type: ['source.malloy'], color: '#000000'},
        {
          startIndex: 36,
          type: [
            'source.malloy',
            'string.quoted.single.malloy',
            'punctuation.definition.string.begin.malloy',
          ],
          color: '#CE9178',
        },
        {
          startIndex: 37,
          type: ['source.malloy', 'string.quoted.single.malloy'],
          color: '#CE9178',
        },
        {
          startIndex: 55,
          type: [
            'source.malloy',
            'string.quoted.single.malloy',
            'punctuation.definition.string.end.malloy',
          ],
          color: '#CE9178',
        },
        {startIndex: 56, type: ['source.malloy'], color: '#000000'},
      ],
    },
  ],
];
