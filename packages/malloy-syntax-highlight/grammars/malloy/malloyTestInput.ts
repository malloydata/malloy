export default [
  ['// / \' " """ // unable to break out of /* line comments'],
  [' -- a different -- line comment'],
  // [ '# bar_chart (tags are line comments for the time being)   ' ],
  [
    "    /* *** / * // \" \" ' \\'",
    '   """ multi-line * /*',
    '" */  -- escaped block',
  ],
  ['  sample: true'],
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
  ["\"/* -- \\e\\uFFFF \\'\\"],
  ["state ~ 'CA' | r'M.' | \"CO\" | /'O.'  -- end"],
  ['select: """ SELECT 1 """'],
  ['run: duckdb.sql("""', '  SELECT 1', '""")'],
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
