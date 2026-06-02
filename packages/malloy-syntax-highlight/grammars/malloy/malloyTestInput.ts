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

/*
 * Test input for Monarch and TextMate syntax highlighting tests.
 *
 * `commonTestInput` holds blocks that both grammars tokenize identically — the real
 * parity surface, exercised by BOTH the TextMate (Jest) and Monarch (Karma) suites.
 *
 * `monarchDivergentTestInput` holds blocks the TextMate grammar handles correctly but
 * the Monarch generator structurally cannot reproduce, so they are exercised by the
 * TextMate (Jest) suite ONLY — the Monarch config excludes them so the Karma suite
 * stays green. The Monarch generator:
 *   - hard-codes commenting out the `@tags` include, so tag/annotation content is not
 *     highlighted under Monarch
 *   - cannot express the column-matching backreferences block annotations (#|…|#) need
 *   - does not handle multiple levels of embedding (the commented-out blocks below)
 * Do NOT delete this coverage or try to force Monarch to match — see CONTEXT.md. If the
 * generator ever gains support, move the block up into `commonTestInput`.
 *
 * The default export concatenates both (common first) so the TextMate suite and the
 * generated darkPlus.ts ground truth still cover everything; the Monarch config consumes
 * only `commonTestInput` plus the matching leading slice of the ground truth.
 */
export const commonTestInput = [
  ['// / \' " """ // unable to break out of /* line comments'],
  [' -- a different -- line comment'],
  // [ '# bar_chart (tags are line comments for the time being)   ' ],
  [
    '    /* *** / * // " " \' \\\'',
    '   """ multi-line * /*',
    '" */  -- escaped block',
  ],
  ['  sample: true'],
  ['type: t is filter<timestamptz>  given: g is number'],
  [
    "export source: s is from(q) extend { where: name like r'A' and id in (1) }",
  ],
  [
    'view: v is { group_by: g is case when x then cast(y as string) else z end }',
  ],
  [
    'run: m -> { aggregate: a is all(sum(n)) exclude(count()) compose(b, c) } join_one: o is t on a = b inner left right full',
  ],
  ['fl1ght_y34r is `Year of Flight 256/* */`  -- escapes identifier'],
  ['`Year', '  -- escapes quoted identifier at newline'],
  ['`Disposable Income` is (0.88 * b1) + 84 / 100.00 * b2 + (.79 * `b3`)  '],
  ['(123E4, 1E-27, E4, 0E+1)'],
  ['avg(count(distinct session_id))'],
  ["`year` is year(dep_time)::string  // interpret year as 'categorical'"],
  ['is hash!number(us3r_n4me)  -- SQL function usage'],
  [
    '(@2001-02-03 04:05:06.001[America/Mexico_City], @2005-01-28 12:12:12.999, @1961-02-14 09:30:15, @2017-10-03 07:23) ',
  ],
  ['event_time ~ @2003-Q1 for 6 quarters'],
  ['(@2021, @2022-06, @2022-09-09, @2023-06-25-WK)'],
  ["'a string with \\escapes\\u0FF1 \\'more\\"],
  [
    'state ? """ multiple " " \\u "" \\u2001 \' /* -- // " \\',
    ' lines ',
    ' """  -- exited',
  ],
  ["/'regexp string /*-- \\escapes\\uFFFF \\'more\\"],
  ['"/* -- \\e\\uFFFF \\\'\\'],
  ["state ~ 'CA' | r'M.' | \"CO\" | /'O.'  -- end"],
  ['run: duckdb.sql("""', '  SELECT 1', '""")'],
];

export const monarchDivergentTestInput = [
  ['#|', '  renderer=sparkline size=large', '|#', 'dimension: x is 1'],
  ['##|', '  model_tag=value', '|##'],
  [
    '#|',
    '  This stuff is a comment, seee',
    '  source: jst a comment',
    '  and i can indeent',
    '  #| more comments',
    '    |#',
    '|#',
    "source: flights is trino_test.table('malloytest.flights')",
  ],
  // Multi-level embedding — Monarch supports only one level (kept commented; the
  // TextMate suite can be extended to cover these when desired):
  // [
  //   'select: """',
  //   '-- SQL CONTEXT',
  //   '%{  airports -> { group_by: state }',
  //   '// MALLOY CONTEXT',
  //   '}  -- SQL CONTEXT',
  //   '"""  // MALLOY CONTEXT'
  // ],
  // [
  //   'select: """',
  //   '%{  run: duckdb.sql("""',
  //   '    -- SQL CONTEXT',
  //   '    %{  // MALLOY CONTEXT',
  //   '    }  ',
  //   '  """  // MALLOY CONTEXT',
  //   ')}  ',
  //   '"""  // MALLOY CONTEXT'
  // ]
];

export default [...commonTestInput, ...monarchDivergentTestInput];
