const monarch = {
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
      {include: '@numbers'},
      {include: '@keywords'},
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
          'keyword',
          '',
          {
            next: '@sql_end',
            nextEmbedded: 'sql',
            token: 'punctuation.sql-block.open',
          },
        ],
      ],
      [
        /(\b[A-Za-z_][A-Za-z_0-9]*)(\s*\.\s*)(sql)(\s*\(\s*)(""")/,
        [
          'variable.other',
          '',
          'keyword',
          '',
          {
            next: '@sql_end',
            nextEmbedded: 'sql',
            token: 'punctuation.sql-block.open',
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
          token: 'punctuation.sql-block.close',
        },
      ],
    ],
    comments: [
      [
        /\/\*/,
        {
          next: '@comment_block_end',
          token: 'punctuation.definition.comment.begin',
        },
      ],
      [
        /\/\//,
        {
          next: '@comment_line_double_slash_end',
          token: 'punctuation.definition.comment',
        },
      ],
      [
        /--/,
        {
          next: '@comment_line_double_hyphen_end',
          token: 'punctuation.definition.comment',
        },
      ],
    ],
    comment_block_end: [
      [/\*\//, {next: '@pop', token: 'punctuation.definition.comment.end'}],
      [/[^\*]+/, 'comment.block'],
      [/[\*]/, 'comment.block'],
    ],
    comment_line_double_slash_end: [
      [/\n/, {next: '@pop', token: 'comment.line.double-slash'}],
      [/[^\n]+/, 'comment.line.double-slash'],
      [/[\n]/, 'comment.line.double-slash'],
    ],
    comment_line_double_hyphen_end: [
      [/\n/, {next: '@pop', token: 'comment.line.double-hyphen'}],
      [/[^\n]+/, 'comment.line.double-hyphen'],
      [/[\n]/, 'comment.line.double-hyphen'],
    ],
    strings: [
      [
        /'/,
        {
          next: '@string_quoted_single_end',
          token: 'punctuation.definition.string.begin',
        },
      ],
      [
        /"/,
        {
          next: '@string_quoted_double_end',
          token: 'punctuation.definition.string.begin',
        },
      ],
      [
        /"""/,
        {
          next: '@string_quoted_triple_end',
          token: 'punctuation.definition.string.begin',
        },
      ],
      [/[r|\/]'/, {next: '@string_regexp_end', token: 'string.regexp'}],
    ],
    string_quoted_single_end: [
      [/'/, {next: '@pop', token: 'punctuation.definition.string.end'}],
      {include: '@escapes'},
      [/[^'\\]+/, 'string.quoted.single'],
      [/['\\]/, 'string.quoted.single'],
    ],
    escapes: [[/\\(u[A-Fa-f0-9]{4}|.)/, 'constant.character.escape']],
    string_quoted_double_end: [
      [/"/, {next: '@pop', token: 'punctuation.definition.string.end'}],
      {include: '@escapes'},
      [/[^"\\]+/, 'string.quoted.double'],
      [/["\\]/, 'string.quoted.double'],
    ],
    string_quoted_triple_end: [
      [/"""/, {next: '@pop', token: 'punctuation.definition.string.end'}],
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
        /(\b(0|[1-9][0-9]*(E[+-]?[0-9]+|\.[0-9]*)?)|\.[0-9]+)/,
        'constant.numeric',
      ],
    ],
    keywords: [
      [
        /\b(accept|sql|select|connection|run|extend|refine|aggregate|sample|calculate|timezone|dimension|except|source|group_by|having|index|join_one|with|join_many|join_cross|limit|measure|nest|order_by|primary_key|project|query|rename|top|where|declare|is|on|desc|by|asc|import|day_of_year|day_of_month|not|or|and|for|else|to|when|pick)\b/,
        'keyword',
      ],
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
      [/([a-zA-Z_][a-zA-Z_0-9]*)(\s*\!?\s*\()/, ['entity.name.function', '']],
      [
        /\b([a-zA-Z_][a-zA-Z_0-9]*)(\!)(timestamp|number|string|boolean|date)(\s*\()/,
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
    types: [[/\b(string|number|date|timestamp|boolean)\b/, 'entity.name.type']],
    constants: [[/\b(null|true|false)\b/, 'constant.language']],
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
