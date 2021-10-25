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
  function:
    /\b(?:AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE)(?=\s*\()/i, // Should we highlight user defined functions too?
  keyword:
    /\b(?:IMPORT|JOIN|RENAMES|TURTLE|PICK|WHEN|ELSE|TO|FOR|TOP|EXPORT|ACCEPT|AND|AS|ASC|BY|COUNT|CROSS|DESC|DEFINE|DISTINCT|ENHANCE|EXCEPT|EXPLORE|FOREIGN|FROM|IS|INDEX|JOINS|KEY|LIMIT|NOT|NULL|ORDER|ON|OR|PROJECT|PRIMARY|REDUCE|RENAME|SUM)\b/i,
  boolean: /\b(?:TRUE|FALSE|NULL)\b/i,
  date: /@[0-9A-Z-]*(\s[0-9A-Z-][0-9A-Z-](:[0-9A-Z-][0-9A-Z-])?(:[0-9A-Z-][0-9A-Z-])?)?/,
  number: /\b0\b-?\d+(?:\.\d*)?|\B\.\d+\b/i,
  operator:
    /[-+*/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?|\b(?:AND|BETWEEN|IN|LIKE|NOT|OR|IS|DIV|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
  punctuation: /[;[\]()`,.]/,
  timeframe:
    /\b((year|quarter|month|week|day|hour|minute|second|day_of_year|day_of_month)s?)\b/i,
  type: /\b((string|number|date|timestamp|boolean)s?)\b/i,
  variable: [],
};
