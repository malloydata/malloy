/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {languages as Monaco} from 'monaco-editor';

export const monarch: Monaco.IMonarchLanguage = {
  includeLF: true,
  defaultToken: '',
  tokenPostfix: '.malloy',
  ignoreCase: true,
  tokenizer: {
    root: [{include: '@malloy_language'}],
    malloy_language: [
      {include: '@sql_string'},
      {include: '@comments'},
      {include: '@strings'},
      {include: '@given'},
      {include: '@percent'},
      {include: '@numbers'},
      {include: '@keywords'},
      {include: '@properties'},
      {include: '@functions'},
      {include: '@datetimes'},
      {include: '@identifiers_quoted'},
      {include: '@types'},
      {include: '@constants'},
      {include: '@timeframes'},
      {include: '@identifiers_unquoted'},
    ],
    sql_string: [
      [
        /(\b[A-Za-z_][A-Za-z_0-9]*)(\s*\.\s*)((?:sql))(\s*\(\s*)(""")/,
        [
          'variable.other.malloy',
          '',
          'keyword.control.sql.malloy',
          '',
          {
            next: '@sql_end_0',
            nextEmbedded: 'sql',
            token: 'punctuation.definition.string.begin.sql.malloy',
          },
        ],
      ],
      [
        /(\b[A-Za-z_][A-Za-z_0-9]*)(\s*\.\s*)((?:sql))(\s*\(\s*)(")/,
        [
          'variable.other.malloy',
          '',
          'keyword.control.sql.malloy',
          '',
          {
            next: '@sql_end_1',
            nextEmbedded: 'sql',
            token: 'punctuation.definition.string.begin.sql.malloy',
          },
        ],
      ],
      [
        /(\b[A-Za-z_][A-Za-z_0-9]*)(\s*\.\s*)((?:sql))(\s*\(\s*)(')/,
        [
          'variable.other.malloy',
          '',
          'keyword.control.sql.malloy',
          '',
          {
            next: '@sql_end_2',
            nextEmbedded: 'sql',
            token: 'punctuation.definition.string.begin.sql.malloy',
          },
        ],
      ],
    ],
    sql_end_0: [
      [
        /"""/,
        {
          next: '@pop',
          nextEmbedded: '@pop',
          token: 'punctuation.definition.string.end.sql.malloy',
        },
      ],
    ],
    sql_end_1: [
      [
        /"/,
        {
          next: '@pop',
          nextEmbedded: '@pop',
          token: 'punctuation.definition.string.end.sql.malloy',
        },
      ],
    ],
    sql_end_2: [
      [
        /'/,
        {
          next: '@pop',
          nextEmbedded: '@pop',
          token: 'punctuation.definition.string.end.sql.malloy',
        },
      ],
    ],
    comments: [
      [/\/\*/, {next: '@comment_block_end', token: 'comment.block'}],
      [/\/\//, {next: '@comment_line_double_slash_end', token: 'comment.line'}],
      [/--/, {next: '@comment_line_double_hyphen_end', token: 'comment.line'}],
    ],
    comment_block_end: [
      [/\*\//, {next: '@pop', token: 'comment.block'}],
      [/[^\*]+/, 'comment.block'],
      [/[\*]/, 'comment.block'],
    ],
    comment_line_double_slash_end: [
      [/\n/, {next: '@pop', token: 'comment.line.double.slash'}],
      [/[^\n]+/, 'comment.line.double.slash'],
      [/[\n]/, 'comment.line.double.slash'],
    ],
    comment_line_double_hyphen_end: [
      [/\n/, {next: '@pop', token: 'comment.line.double.hyphen'}],
      [/[^\n]+/, 'comment.line.double.hyphen'],
      [/[\n]/, 'comment.line.double.hyphen'],
    ],
    strings: [
      [
        /\bf'''/,
        {
          next: '@string_quoted_filter_malloy_end',
          token: 'string.quoted.filter.malloy',
        },
      ],
      [
        /\bf"""/,
        {
          next: '@string_quoted_filter_malloy_end_2',
          token: 'string.quoted.filter.malloy',
        },
      ],
      [
        /\bf'/,
        {
          next: '@string_quoted_filter_malloy_end_3',
          token: 'string.quoted.filter.malloy',
        },
      ],
      [
        /\bf"/,
        {
          next: '@string_quoted_filter_malloy_end_4',
          token: 'string.quoted.filter.malloy',
        },
      ],
      [
        /\bf`/,
        {
          next: '@string_quoted_filter_malloy_end_5',
          token: 'string.quoted.filter.malloy',
        },
      ],
      [
        /\bs'/,
        {
          next: '@string_quoted_raw_single_malloy_end',
          token: 'string.quoted.raw.single.malloy',
        },
      ],
      [
        /\bs"/,
        {
          next: '@string_quoted_raw_double_malloy_end',
          token: 'string.quoted.raw.double.malloy',
        },
      ],
      [
        /[r\/]'/,
        {next: '@string_regexp_malloy_end', token: 'string.regexp.malloy'},
      ],
      [
        /"""/,
        {next: '@string_quoted_triple_malloy_end', token: 'string.quoted'},
      ],
      [/'/, {next: '@string_quoted_single_malloy_end', token: 'string.quoted'}],
      [/"/, {next: '@string_quoted_double_malloy_end', token: 'string.quoted'}],
    ],
    string_quoted_filter_malloy_end: [
      [/'''/, {next: '@pop', token: 'string.quoted.filter.malloy'}],
      [/[^']+/, 'string.quoted.filter.malloy'],
      [/[']/, 'string.quoted.filter.malloy'],
    ],
    string_quoted_filter_malloy_end_2: [
      [/"""/, {next: '@pop', token: 'string.quoted.filter.malloy'}],
      [/[^"]+/, 'string.quoted.filter.malloy'],
      [/["]/, 'string.quoted.filter.malloy'],
    ],
    string_quoted_filter_malloy_end_3: [
      [/'/, {next: '@pop', token: 'string.quoted.filter.malloy'}],
      [/[^']+/, 'string.quoted.filter.malloy'],
      [/[']/, 'string.quoted.filter.malloy'],
    ],
    string_quoted_filter_malloy_end_4: [
      [/"/, {next: '@pop', token: 'string.quoted.filter.malloy'}],
      [/[^"]+/, 'string.quoted.filter.malloy'],
      [/["]/, 'string.quoted.filter.malloy'],
    ],
    string_quoted_filter_malloy_end_5: [
      [/`/, {next: '@pop', token: 'string.quoted.filter.malloy'}],
      [/[^`]+/, 'string.quoted.filter.malloy'],
      [/[`]/, 'string.quoted.filter.malloy'],
    ],
    string_quoted_raw_single_malloy_end: [
      [/'/, {next: '@pop', token: 'string.quoted.raw.single.malloy'}],
      [/[^']+/, 'string.quoted.raw.single.malloy'],
      [/[']/, 'string.quoted.raw.single.malloy'],
    ],
    string_quoted_raw_double_malloy_end: [
      [/"/, {next: '@pop', token: 'string.quoted.raw.double.malloy'}],
      [/[^"]+/, 'string.quoted.raw.double.malloy'],
      [/["]/, 'string.quoted.raw.double.malloy'],
    ],
    string_regexp_malloy_end: [
      [/'/, {next: '@pop', token: 'string.regexp.malloy'}],
      {include: '@regex_escapes'},
      [/[^'\\]+/, 'string.regexp.malloy'],
      [/['\\]/, 'string.regexp.malloy'],
    ],
    regex_escapes: [[/\\./, 'constant.character.escape']],
    string_quoted_triple_malloy_end: [
      [/"""/, {next: '@pop', token: 'string.quoted'}],
      [/[^"]+/, 'string.quoted.triple.malloy'],
      [/["]/, 'string.quoted.triple.malloy'],
    ],
    string_quoted_single_malloy_end: [
      [/'/, {next: '@pop', token: 'string.quoted'}],
      {include: '@escapes'},
      [/[^'\\]+/, 'string.quoted.single.malloy'],
      [/['\\]/, 'string.quoted.single.malloy'],
    ],
    escapes: [[/\\(u[A-Fa-f0-9]{4}|.)/, 'constant.character.escape']],
    string_quoted_double_malloy_end: [
      [/"/, {next: '@pop', token: 'string.quoted'}],
      {include: '@escapes'},
      [/[^"\\]+/, 'string.quoted.double.malloy'],
      [/["\\]/, 'string.quoted.double.malloy'],
    ],
    given: [[/\$[A-Za-z_][A-Za-z0-9_]*/, 'variable.parameter.malloy']],
    percent: [[/[0-9]+%/, 'constant.numeric.percentage.malloy']],
    numbers: [
      [
        /(\b((0|[1-9][0-9]*)(E[+-]?[0-9]+|\.[0-9]*)?)|\.[0-9]+)/,
        'constant.numeric',
      ],
    ],
    keywords: [[/\b(and|for|in|like|not|or|to)\b/, 'keyword.operator.malloy']],
    properties: [
      [
        /\b(accept|aggregate|calculate|calculation|connection|declare|dimension|drill|except|given|group_by|grouped_by|having|index|join_cross|join_many|join_one|limit|measure|nest|order_by|partition_by|primary_key|query|rename|run|sample|select|timezone|top|type|view|where)(?=:)/,
        'keyword.control.malloy',
      ],
      [
        /\b(as|asc|by|case|desc|distinct|else|end|export|extend|filter|from|full|has|import|include|inner|internal|is|left|on|pick|private|public|right|source|then|when|with)\b/,
        'keyword.control.malloy',
      ],
    ],
    functions: [
      [
        /\b(all|avg|cast|compose|count|exclude|max|min|sum)(\s*\()/,
        ['support.function.malloy', ''],
      ],
      [
        /\b([a-zA-Z_][a-zA-Z_0-9]*)(!)(timestamp|number|string|boolean|date|json)?(\s*\()/,
        ['entity.name.function.malloy', '', 'storage.type.malloy', ''],
      ],
      [
        /\b([a-zA-Z_][a-zA-Z_0-9]*)(\s*\()/,
        ['entity.name.function.malloy', ''],
      ],
    ],
    datetimes: [
      [
        /@[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}((:[0-9]{2})(([\.,][0-9]+)(\[[A-Za-z_\/]+\])?)?)?/,
        'constant.numeric.timestamp',
      ],
      [
        /@[0-9]{4}(-Q[1-4]|-[0-9]{2}(-[0-9]{2}(-WK)?)?)?/,
        'constant.numeric.date',
      ],
    ],
    identifiers_quoted: [[/`[^`]*`/, 'variable.other.quoted.malloy']],
    types: [
      [
        /\b(boolean|date|json|number|string|timestamp|timestamptz)\b/,
        'storage.type.malloy',
      ],
    ],
    constants: [
      [/\b(false|now|null|true)\b/, 'constant.language.malloy'],
      [/\bthis\b/, 'variable.language.malloy'],
    ],
    timeframes: [
      [
        /\b((year|quarter|month|week|day|hour|minute|second)s?)\b/,
        'keyword.other.timeframe.malloy',
      ],
      [/\b(day_of_year|day_of_month)\b/, 'keyword.other.timeframe.malloy'],
    ],
    identifiers_unquoted: [
      [/\b[A-Za-z_][A-Za-z_0-9]*\b/, 'variable.other.malloy'],
    ],
  },
};
