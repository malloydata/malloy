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

/*
 * A simple Prism grammar for Malloy. Not very rigorous, but good enough for
 * docs.
 */
export const MALLOY_GRAMMAR = {
  comment: [
    {
      pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|(?:--|\/\/|#).*)/,
      lookbehind: true,
    },
    {
      pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
      lookbehind: true,
      greedy: true,
    },
  ],
  regular_expression: {
    pattern: /(^|[^@\\])(r|\/)("|')(?:\\[\s\S]|(?!\3)[^\\]|\3\3)*\3/,
    greedy: true,
    lookbehind: true,
  },
  string: {
    pattern: /(^|[^@\\])("|')(?:\\[\s\S]|(?!\2)[^\\]|\2\2)*\2/,
    greedy: true,
    lookbehind: true,
  },
  identifier: /`[A-z_][A-z_0-9]*`/,
  timeframe:
    /\b((year|quarter|month|week|day|hour|minute|second|day_of_year|day_of_month)s?)\b/i,
  keyword:
    /\b(?:IMPORT|PICK|WHEN|ELSE|TO|FOR|EXPORT|AND|AS|ASC|BY|CROSS|DESC|DEFINE|ENHANCE|FOREIGN|FROM|IS|JOINS|KEY|NOT|NULL|ORDER|ON|OR|REDUCE|ACCEPT|AGGREGATE|DIMENSION|EXCEPT|EXPLORE|GROUP_BY|HAVING|INDEX|JOIN|LIMIT|MEASURE|NEST|ORDER_BY|PRIMARY_KEY|PROJECT|QUERY|RENAME|TOP|WHERE)\b/i,
  function_keyword: /\b(?:DISTINCT)\b/i,
  function:
    /\b(?:AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE|TABLE|FROM|[a-zA-Z]*)(?=\s*\()/i, // Should we highlight user defined functions too?
  boolean: /\b(?:TRUE|FALSE|NULL)\b/i,
  date: /@[0-9A-Z-]*(\s[0-9A-Z-][0-9A-Z-](:[0-9A-Z-][0-9A-Z-])?(:[0-9A-Z-][0-9A-Z-])?)?/,
  number: /\b\d+(?:\.\d*)?\b/i,
  operator:
    /[-+*/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?|\b(?:AND|BETWEEN|IN|LIKE|NOT|OR|IS|DIV|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
  punctuation: /[;[\]()`,.]/,
  type: /\b((string|number|date|timestamp|boolean)s?)\b/i,
  variable: [],
};
