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
      //{ include: '@tags' },
      {include: '@strings'},
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
        /\b(select)(\s*:\s*)(""")/,
        [
          'keyword.control.select',
          '',
          {
            next: '@sql_end',
            nextEmbedded: 'sql',
            token: 'punctuation.sql.block.open',
          },
        ],
      ],
      [
        /(\b[A-Za-z_][A-Za-z_0-9]*)(\s*\.\s*)(sql)(\s*\(\s*)(""")/,
        [
          'variable.other',
          '',
          'keyword.control.sql',
          '',
          {
            next: '@sql_end',
            nextEmbedded: 'sql',
            token: 'punctuation.sql.block.open',
          },
        ],
      ],
    ],
    sql_end: [
      [
        /"""/,
        {
          next: '@pop',
          nextEmbedded: '@pop',
          token: 'punctuation.sql.block.close',
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
      {include: '@tag_values'},
      [/[^\n(]+/, 'comment.line.double.slash'],
      [/[\n(]/, 'comment.line.double.slash'],
    ],
    comment_line_double_hyphen_end: [
      [/\n/, {next: '@pop', token: 'comment.line.double.hyphen'}],
      [/[^\n]+/, 'comment.line.double.hyphen'],
      [/[\n]/, 'comment.line.double.hyphen'],
    ],
    tags: [
      [/##\n/, 'string.quoted'],
      [/#"/, {next: '@comment_line_double_slash_end', token: 'comment.line'}],
      [/#\n/, 'string.quoted'],
      [
        /#\s/,
        {
          next: '@comment_line_double_slash_end',
          token: 'support.type.property.name.json',
        },
      ],
      [
        /##\s/,
        {
          next: '@comment_line_double_slash_end',
          token: 'support.type.property.name.json',
        },
      ],
      [/#/, {next: '@string_quoted_end', token: 'string.quoted'}],
    ],
    tag_values: [
      [
        /(-)?((?:[^\s=#]+)|(?:"[^#]+"))(?:\s*(=)\s*((?:[^\s=#]+)|(?:"[^#]+")))?/,
        [
          'keyword.control.negate',
          'support.type.property.name.json',
          'keyword.operator.comparison.ts',
          'string.quoted',
        ],
      ],
    ],
    string_quoted_end: [
      [/\n/, {next: '@pop', token: 'string.quoted'}],
      [/[^\n]+/, 'string.quoted'],
      [/[\n]/, 'string.quoted'],
    ],
    strings: [
      [/'/, {next: '@string_quoted_single_end', token: 'string.quoted'}],
      [/"/, {next: '@string_quoted_double_end', token: 'string.quoted'}],
      [/"""/, {next: '@string_quoted_triple_end', token: 'string.quoted'}],
      [/[r|\/]'/, {next: '@string_regexp_end', token: 'string.regexp'}],
    ],
    string_quoted_single_end: [
      [/'/, {next: '@pop', token: 'string.quoted'}],
      {include: '@escapes'},
      [/[^'\\]+/, 'string.quoted.single'],
      [/['\\]/, 'string.quoted.single'],
    ],
    escapes: [[/\\(u[A-Fa-f0-9]{4}|.)/, 'constant.character.escape']],
    string_quoted_double_end: [
      [/"/, {next: '@pop', token: 'string.quoted'}],
      {include: '@escapes'},
      [/[^"\\]+/, 'string.quoted.double'],
      [/["\\]/, 'string.quoted.double'],
    ],
    string_quoted_triple_end: [
      [/"""/, {next: '@pop', token: 'string.quoted'}],
      [/[^"]+/, 'string.quoted.triple'],
      [/["]/, 'string.quoted.triple'],
    ],
    string_regexp_end: [
      [/'/, {next: '@pop', token: 'string.regexp'}],
      {include: '@regex_escapes'},
      [/[^'\\]+/, 'string.regexp'],
      [/['\\]/, 'string.regexp'],
    ],
    regex_escapes: [[/\\./, 'constant.character.escape']],
    numbers: [
      [
        /(\b((0|[1-9][0-9]*)(E[+-]?[0-9]+|\.[0-9]*)?)|\.[0-9]+)/,
        'constant.numeric',
      ],
    ],
    keywords: [
      [/\bis\b/, 'keyword.control.is'],
      [/\bon\b/, 'keyword.control.on'],
      [/\bnot\b/, 'keyword.other.not'],
      [/\bor\b/, 'keyword.other.or'],
      [/\bdesc\b/, 'keyword.control.desc'],
      [/\bby\b/, 'keyword.control.by'],
      [/\band\b/, 'keyword.other.and'],
      [/\basc\b/, 'keyword.control.asc'],
      [/\bfor\b/, 'keyword.other.for'],
      [/\belse\b/, 'keyword.other.else'],
      [/\bto\b/, 'keyword.other.to'],
      [/\bwhen\b/, 'keyword.other.when'],
      [/\bpick\b/, 'keyword.other.pick'],
      [/\bimport\b/, 'keyword.control.import'],
    ],
    properties: [
      [/\baccept\b/, 'keyword.control.accept'],
      [/\bsql\b/, 'keyword.control.sql'],
      [/\bselect\b/, 'keyword.control.select'],
      [/\bconnection\b/, 'keyword.control.connection'],
      [/\brun\b/, 'keyword.control.run'],
      [/\bextend\b/, 'keyword.control.extend'],
      [/\brefine\b/, 'keyword.control.refine'],
      [/\baggregate\b/, 'keyword.control.aggregate'],
      [/\bsample\b/, 'keyword.control.sample'],
      [/\bcalculate\b/, 'keyword.control.calculate'],
      [/\btimezone\b/, 'keyword.control.timezone'],
      [/\bdimension\b/, 'keyword.control.dimension'],
      [/\bexcept\b/, 'keyword.control.except'],
      [/\bsource\b/, 'keyword.control.source'],
      [/\bgroup_by\b/, 'keyword.control.group_by'],
      [/\bhaving\b/, 'keyword.control.having'],
      [/\bindex\b/, 'keyword.control.index'],
      [/\bjoin_one\b/, 'keyword.control.join_one'],
      [/\bwith\b/, 'keyword.control.with'],
      [/\bjoin_many\b/, 'keyword.control.join_many'],
      [/\bjoin_cross\b/, 'keyword.control.join_cross'],
      [/\blimit\b/, 'keyword.control.limit'],
      [/\bmeasure\b/, 'keyword.control.measure'],
      [/\bnest\b/, 'keyword.control.nest'],
      [/\border_by\b/, 'keyword.control.order_by'],
      [/\bpartition_by\b/, 'keyword.control.partition_by'],
      [/\bprimary_key\b/, 'keyword.control.primary_key'],
      [/\bproject\b/, 'keyword.control.project'],
      [/\bquery\b/, 'keyword.control.query'],
      [/\brename\b/, 'keyword.control.rename'],
      [/\btop\b/, 'keyword.control.top'],
      [/\bview\b/, 'keyword.control.view'],
      [/\bwhere\b/, 'keyword.control.where'],
      [/\bdeclare\b/, 'keyword.control.declare'],
    ],
    functions: [
      [
        /\b(count)(\s*\()(distinct)/,
        ['entity.name.function', '', 'entity.name.function.modifier'],
      ],
      [
        /\b(AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE|TABLE|FROM|FROM_SQL|UNGROUPED)(\s*\()/,
        ['entity.name.function', ''],
      ],
      [/\b([a-zA-Z_][a-zA-Z_0-9]*)(\s*\()/, ['entity.name.function', '']],
      [
        /\b([a-zA-Z_][a-zA-Z_0-9]*)(!)(timestamp|number|string|boolean|date)?(\s*\()/,
        ['entity.name.function', '', 'entity.name.type', ''],
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
    identifiers_quoted: [[/`[^`]*`/, 'variable.other.quoted']],
    types: [
      [/\bstring\b/, 'entity.name.type.string'],
      [/\bnumber\b/, 'entity.name.type.number'],
      [/\bdate\b/, 'entity.name.type.date'],
      [/\btimestamp\b/, 'entity.name.type.timestamp'],
      [/\bboolean\b/, 'entity.name.type.boolean'],
    ],
    constants: [
      [/\bnull\b/, 'constant.language.null'],
      [/\btrue\b/, 'constant.language.true'],
      [/\bfalse\b/, 'constant.language.false'],
    ],
    timeframes: [
      [
        /\b((year|quarter|month|week|day|hour|minute|second)s?)\b/,
        'keyword.other.timeframe',
      ],
      [/\b(day_of_year|day_of_month)\b/, 'keyword.other.timeframe'],
    ],
    identifiers_unquoted: [[/\b[A-Za-z_][A-Za-z_0-9]*\b/, 'variable.other']],
  },
};
