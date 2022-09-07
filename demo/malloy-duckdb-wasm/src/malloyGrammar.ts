/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

export const MALLOY_GRAMMAR = {
  scopeName: "source.malloy",
  patterns: [
    { include: "#sql-statement" },
    { include: "#comments" },
    { include: "#strings" },
    { include: "#numbers" },
    { include: "#keywords" },
    { include: "#properties" },
    { include: "#functions" },
    { include: "#dates" },
    { include: "#identifiers-quoted" },
    { include: "#types" },
    { include: "#constants" },
    { include: "#timeframes" },
    { include: "#identifiers-unquoted" },
  ],
  repository: {
    "sql-statement": {
      begin: "\\|\\|",
      end: ";;",
      beginCaptures: {
        "0": { name: "punctuation.sql-block.open" },
      },
      endCaptures: {
        "0": { name: "punctuation.sql-block.close" },
      },
      name: "source.sql",
      patterns: [{ include: "source.sql" }],
    },
    functions: {
      patterns: [
        {
          match: "(?i)\\b(count)(\\s*\\()(distinct)",
          captures: {
            "1": { name: "entity.name.function" },
            "3": { name: "entity.name.function.modifier" },
          },
        },
        {
          match:
            "(?i)\\b(AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE|TABLE|FROM|FROM_SQL|UNGROUPED)(\\s*\\()",
          captures: {
            "1": { name: "entity.name.function" },
          },
        },
        {
          match: "(?i)\\b([a-zA-Z]*)(\\s*\\()",
          captures: {
            "1": { name: "entity.name.function" },
          },
        },
      ],
    },
    dates: {
      patterns: [
        {
          match:
            "(?i)@[0-9A-Z-]*(\\s[0-9A-Z-][0-9A-Z-](:[0-9A-Z-][0-9A-Z-])?(:[0-9A-Z-][0-9A-Z-])?)?",
          name: "constant.numeric.date",
        },
      ],
    },
    "identifiers-quoted": {
      patterns: [
        {
          match: "(?i)`[A-z_][A-z_0-9]*`",
          name: "variable.other.quoted",
        },
      ],
    },
    "identifiers-unquoted": {
      patterns: [
        {
          match: "(?i)\\b[A-z_][A-z_0-9]*\\b",
          name: "variable.other",
        },
      ],
    },
    timeframes: {
      patterns: [
        {
          match:
            "(?i)\\b((year|quarter|month|week|day|hour|minute|second)s?)\\b",
          name: "keyword.other.timeframe",
        },
        {
          match: "(?i)\\b(day_of_year|day_of_month)\\b",
          name: "keyword.other.timeframe",
        },
      ],
    },
    comments: {
      patterns: [
        {
          begin: "/\\*",
          end: "\\*/",
          beginCaptures: {
            "0": { name: "punctuation.definition.comment.begin" },
          },
          endCaptures: {
            "0": { name: "punctuation.definition.comment.end" },
          },
          name: "comment.block",
        },
        {
          begin: "//",
          end: "\\n",
          beginCaptures: {
            "0": { name: "punctuation.definition.comment" },
          },
          name: "comment.line.double-slash",
        },
        {
          begin: "--",
          end: "\\n",
          beginCaptures: {
            "0": { name: "punctuation.definition.comment" },
          },
          name: "comment.line.double-hyphen",
        },
      ],
    },
    strings: {
      patterns: [
        {
          begin: "'",
          end: "'",
          beginCaptures: {
            "0": { name: "punctuation.definition.string.begin" },
          },
          endCaptures: {
            "0": { name: "punctuation.definition.string.end" },
          },
          name: "string.unquoted.single",
          patterns: [{ include: "#escapes" }],
        },
        {
          begin: '"',
          end: '"',
          beginCaptures: {
            "0": { name: "punctuation.definition.string.begin" },
          },
          endCaptures: {
            "0": { name: "punctuation.definition.string.end" },
          },
          name: "string.unquoted.double",
          patterns: [{ include: "#escapes" }],
        },
        {
          begin: "(?i)[r|/]'",
          end: "'",
          name: "string.regexp",
          patterns: [{ include: "#escapes" }],
        },
      ],
      repository: {
        escapes: {
          name: "constant.character.escape",
          match:
            "\\\\(x\\h{2}|[0-2][0-7]{0,2}|3[0-6][0-7]|37[0-7]?|[4-7][0-7]?|.)",
          captures: {
            "0": { name: "constant.character.escape" },
          },
        },
      },
    },
    numbers: {
      match: "\\b((0|[1-9][0-9]*)(\\.[0-9]*)?| \\.[0-9]+)\\b",
      name: "constant.numeric",
    },
    constants: {
      patterns: [
        {
          match: "(?i)\\bnull\\b",
          name: "constant.language.null",
        },
        {
          match: "(?i)\\btrue\\b",
          name: "constant.language.true",
        },
        {
          match: "(?i)\\bfalse\\b",
          name: "constant.language.false",
        },
      ],
    },
    types: {
      patterns: [
        {
          match: "(?i)\\bstring\\b",
          name: "entity.name.type.string",
        },
        {
          match: "(?i)\\bnumber\\b",
          name: "entity.name.type.number",
        },
        {
          match: "(?i)\\bdate\\b",
          name: "entity.name.type.date",
        },
        {
          match: "(?i)\\btimestamp\\b",
          name: "entity.name.type.timestamp",
        },
        {
          match: "(?i)\\bboolean\\b",
          name: "entity.name.type.boolean",
        },
      ],
    },
    properties: {
      patterns: [
        {
          match: "(?i)\\baccept\\b",
          name: "keyword.control.accept",
        },
        {
          match: "(?i)\\bsql\\b",
          name: "keyword.control.sql",
        },
        {
          match: "(?i)\\baggregate\\b",
          name: "keyword.control.aggregate",
        },
        {
          match: "(?i)\\bdimension\\b",
          name: "keyword.control.dimension",
        },
        {
          match: "(?i)\\bexcept\\b",
          name: "keyword.control.except",
        },
        {
          match: "(?i)\\bexplore\\b",
          name: "keyword.control.explore",
        },
        {
          match: "(?i)\\bgroup_by\\b",
          name: "keyword.control.group_by",
        },
        {
          match: "(?i)\\bhaving\\b",
          name: "keyword.control.having",
        },
        {
          match: "(?i)\\bindex\\b",
          name: "keyword.control.index",
        },
        {
          match: "(?i)\\bjoin_one\\b",
          name: "keyword.control.join_one",
        },
        {
          match: "(?i)\\bwith\\b",
          name: "keyword.control.with",
        },
        {
          match: "(?i)\\bjoin_many\\b",
          name: "keyword.control.join_many",
        },
        {
          match: "(?i)\\bjoin_cross\\b",
          name: "keyword.control.join_cross",
        },
        {
          match: "(?i)\\blimit\\b",
          name: "keyword.control.limit",
        },
        {
          match: "(?i)\\bmeasure\\b",
          name: "keyword.control.measure",
        },
        {
          match: "(?i)\\bnest\\b",
          name: "keyword.control.nest",
        },
        {
          match: "(?i)\\border_by\\b",
          name: "keyword.control.order_by",
        },
        {
          match: "(?i)\\bprimary_key\\b",
          name: "keyword.control.primary_key",
        },
        {
          match: "(?i)\\bproject\\b",
          name: "keyword.control.project",
        },
        {
          match: "(?i)\\bquery\\b",
          name: "keyword.control.query",
        },
        {
          match: "(?i)\\brename\\b",
          name: "keyword.control.rename",
        },
        {
          match: "(?i)\\btop\\b",
          name: "keyword.control.top",
        },
        {
          match: "(?i)\\bwhere\\b",
          name: "keyword.control.where",
        },
      ],
    },
    keywords: {
      patterns: [
        {
          match: "(?i)\\bis\\b",
          name: "keyword.control.is",
        },
        {
          match: "(?i)\\bon\\b",
          name: "keyword.control.on",
        },
        {
          match: "(?i)\\bnot\\b",
          name: "keyword.other.not",
        },
        {
          match: "(?i)\\bor\\b",
          name: "keyword.other.or",
        },
        {
          match: "(?i)\\bdesc\\b",
          name: "keyword.control.desc",
        },
        {
          match: "(?i)\\bby\\b",
          name: "keyword.control.by",
        },
        {
          match: "(?i)\\band\\b",
          name: "keyword.other.and",
        },
        {
          match: "(?i)\\basc\\b",
          name: "keyword.control.asc",
        },
        {
          match: "(?i)\\bfor\\b",
          name: "keyword.other.for",
        },
        {
          match: "(?i)\\belse\\b",
          name: "keyword.other.else",
        },
        {
          match: "(?i)\\bto\\b",
          name: "keyword.other.to",
        },
        {
          match: "(?i)\\bwhen\\b",
          name: "keyword.other.when",
        },
        {
          match: "(?i)\\bpick\\b",
          name: "keyword.other.pick",
        },
        {
          match: "(?i)\\bimport\\b",
          name: "keyword.control.import",
        },
      ],
    },
  },
};
