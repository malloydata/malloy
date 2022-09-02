/*
 * Copyright 2022 Google LLC
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

import * as monaco from "monaco-editor";

export const getMonacoGrammar = (): monaco.languages.IMonarchLanguage => {
  return {
    // Set defaultToken to invalid to see what you do not tokenize yet
    // defaultToken: "invalid",

    keywords: [
      "accept",
      "aggregate",
      "declare",
      "dimension",
      "except",
      "explore",
      "group_by",
      "having",
      "index",
      "join_cross",
      "join_one",
      "join_many",
      "limit",
      "measure",
      "nest",
      "order_by",
      "primary_key",
      "project",
      "query",
      "rename",
      "sample",
      "source",
      "sql",
      "top",
      "where",

      "all",
      "and",
      "as",
      "asc",
      "avg",
      "by",
      "case",
      "cast",
      "condition",
      "count",
      "date",
      "day",
      "desc",
      "distinct",
      "else",
      "end",
      "exclude",
      "false",
      "for",
      "from",
      "from_sql",
      "has",
      "hour",
      "hours",
      "import",
      "is",
      "json",
      "last",
      "max",
      "min",
      "minute",
      "minutes",
      "month",
      "months",
      "not",
      "now",
      "null",
      "on",
      "or",
      "pick",
      "quarter",
      "quarters",
      "second",
      "seconds",
      "sum",
      "table",
      "then",
      "this",
      "to",
      "true",
      "turtle",
      "week",
      "weeks",
      "with",
      "year",
      "years",
      "ungrouped",
    ],

    typeKeywords: ["string", "number", "boolean", "date", "timestamp"],

    operators: [
      "&",
      "->",
      "=>",
      "::",
      ":",
      ",",
      ".",
      "<",
      ">",
      "=",
      "!=",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "**",
      "/",
      "|",
      ";",
      "!~",
      "~",
      "?",
    ],

    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*/^%]+/,

    // C# style strings
    escapes:
      /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    // The main tokenizer for our languages
    tokenizer: {
      root: [
        // identifiers and keywords
        [
          /[A-Za-z_$][\w$]*/,
          {
            cases: {
              "@typeKeywords": "keyword",
              "@keywords": "keyword",
              "@default": "identifier",
            },
          },
        ],

        // whitespace
        { include: "@whitespace" },

        // delimiters and operators
        [/[{}()[\]]/, "@brackets"],
        [/[<>](?!@symbols)/, "@brackets"],
        [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],

        // numbers
        [/\d*\.\d+([eE][-+]?\d+)?/, "number.float"],
        [/\d+/, "number"],

        // strings
        [/"([^"\\]|\\.)*$/, "string.invalid"], // non-terminated string
        [/'([^'\\]|\\.)*$/, "string.invalid"], // non-terminated string
        // [/`([^`\\]|\\.)*$/, "string.invalid"], // non-terminated string
        [/"/, "string", "@string_double"],
        [/'/, "string", "@string_single"],
        // [/`/, "identifier", "@identifier_quoted"],
      ],

      comment: [
        [/[^/*]+/, "comment"],
        [/\/\*/, "comment", "@push"], // nested comment
        ["\\*/", "comment", "@pop"],
        [/[/*]/, "comment"],
      ],

      string_double: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, "string", "@pop"],
      ],

      string_single: [
        [/[^\\']+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/'/, "string", "@pop"],
      ],

      // identifier_quoted: [
      //   [/[^\\`]+/, "identifier"],
      //   [/`/, "identifier", "@pop"],
      // ],

      whitespace: [
        [/[ \t\r\n]+/, "white"],
        [/\/\*/, "comment", "@comment"],
        [/\/\/.*$/, "comment"],
      ],
    },
  };
};
