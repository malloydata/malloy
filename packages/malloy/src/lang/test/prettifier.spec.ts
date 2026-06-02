/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * Self-contained tests for the prettifier rules.
 *
 * Each `describe` block corresponds to a rule documented at the top of
 * `prettify.ts`. Tests are intentionally small — one behaviour per case — and
 * use full-string equality so what's expected is unambiguous in the source.
 *
 * Two invariants apply to *every* test (asserted explicitly in the
 * "invariants" describe and checked implicitly by `pp` for any case that calls
 * it more than once):
 *   - Idempotence: prettify(prettify(x)).result === prettify(x).result
 *   - No new parse errors: errors don't grow when re-formatting the output.
 */

import {prettify} from '../prettify';

// Run prettify and assert:
//   - no parse errors on input
//   - idempotence: prettify(prettify(src)) === prettify(src)
//   - no new parse errors on the second pass
// Returns the formatted string with one trailing newline trimmed for
// convenient template-literal comparison.
function pp(src: string): string {
  const {result, errors} = prettify(src);
  if (errors.length > 0) {
    throw new Error(
      `prettify produced ${errors.length} parse error(s):\n` +
        errors.map(e => `  ${e.line}:${e.column}  ${e.message}`).join('\n') +
        `\n--- input ---\n${src}\n--- output ---\n${result}`
    );
  }
  const second = prettify(result);
  if (second.result !== result) {
    throw new Error(
      `prettify is not idempotent:\n--- input ---\n${src}\n` +
        `--- first pass ---\n${result}\n--- second pass ---\n${second.result}`
    );
  }
  if (second.errors.length > errors.length) {
    throw new Error(
      `prettify introduced ${second.errors.length - errors.length} new parse ` +
        `error(s) on second pass:\n--- input ---\n${src}\n--- output ---\n${result}`
    );
  }
  return result.replace(/\n$/, '');
}

// String-equality assertion that normalizes the expected value's leading
// indentation (so test bodies can use template literals without messing with
// indentation) and trims one trailing newline.
function eq(input: string, expected: string): void {
  expect(pp(input)).toBe(expected.replace(/\n$/, ''));
}

describe('prettify — per-token spacing (leaf)', () => {
  test('curly braces indent in/out', () => {
    eq(
      "source: x is duckdb.table('t') extend {dimension: y is 1}",
      "source: x is duckdb.table('t') extend {\n  dimension: y is 1\n}"
    );
  });

  test('. and :: are glued', () => {
    eq(
      "source: x is duckdb.table('t') extend { dimension: a is b.c.d :: number }",
      "source: x is duckdb.table('t') extend {\n  dimension: a is b.c.d :: number\n}"
    );
  });

  test('binary operators get spaces both sides', () => {
    eq(
      "source: x is duckdb.table('t') extend { dimension: a is b+c*d }",
      "source: x is duckdb.table('t') extend {\n  dimension: a is b + c * d\n}"
    );
  });

  test('call hug: count(), f(x), a.table(...)', () => {
    eq(
      "source: x is duckdb.table('t') extend { measure: c is count(), s is sum(x), m is some_fn(a, b) }",
      "source: x is duckdb.table('t') extend {\n" +
        '  measure:\n' +
        '    c is count()\n' +
        '    s is sum(x)\n' +
        '    m is some_fn(a, b)\n' +
        '}'
    );
  });

  test('grouping paren after `is` is not hugged', () => {
    eq(
      "source: x is duckdb.table('t') extend { dimension: a is(b + c) }",
      "source: x is duckdb.table('t') extend {\n  dimension: a is (b + c)\n}"
    );
  });
});

describe('prettify — section-list rule', () => {
  test('all bare items, fits on one line → inline', () => {
    eq(
      "source: x is duckdb.table('t') -> { group_by: a, b, c }",
      "source: x is duckdb.table('t') -> {\n  group_by: a, b, c\n}"
    );
  });

  test('single is-item that fits → stays inline', () => {
    eq(
      "source: x is duckdb.table('t') extend { dimension: a is b + 1 }",
      "source: x is duckdb.table('t') extend {\n  dimension: a is b + 1\n}"
    );
  });

  test('multiple is-items → wrapped, each on own line, no commas', () => {
    eq(
      "source: x is duckdb.table('t') extend { measure: a is sum(x) , b is avg(x) , c is count() }",
      "source: x is duckdb.table('t') extend {\n" +
        '  measure:\n' +
        '    a is sum(x)\n' +
        '    b is avg(x)\n' +
        '    c is count()\n' +
        '}'
    );
  });

  test('annotation on item forces wrapped form', () => {
    eq(
      "source: x is duckdb.table('t') extend { measure: # currency \n a is sum(x) }",
      "source: x is duckdb.table('t') extend {\n" +
        '  measure:\n' +
        '    # currency\n' +
        '    a is sum(x)\n' +
        '}'
    );
  });

  test('mixed bare + is-item: bare items flow, is on own line', () => {
    eq(
      "source: x is duckdb.table('t') -> { group_by: a, b, c is region_id + 1 }",
      "source: x is duckdb.table('t') -> {\n" +
        '  group_by:\n' +
        '    a, b\n' +
        '    c is region_id + 1\n' +
        '}'
    );
  });

  test('bare items overflow → flow-fill at line budget, no trailing commas', () => {
    const longList = Array.from({length: 30}, (_, i) => `field_${i}`).join(
      ', '
    );
    const out = pp(
      `source: x is duckdb.table('t') -> { group_by: ${longList} }`
    );
    // First line should be `group_by:` with no trailing items (we go wrapped).
    expect(out).toMatch(/^source: x[\s\S]*\n {2}group_by:\n/);
    // Wrapped lines should end on an identifier (no trailing comma).
    const wrappedLines = out.split('\n').filter(l => l.match(/^ {4}field_/));
    for (const line of wrappedLines) {
      expect(line).not.toMatch(/,\s*$/);
    }
    // No line exceeds the budget.
    for (const line of out.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(100);
    }
  });
});

describe('prettify — postfix curly (filter shortcut)', () => {
  test('short filter shortcut stays inline', () => {
    eq(
      "source: x is duckdb.table('t') extend { measure: c is count() { where: color = 'red' } }",
      "source: x is duckdb.table('t') extend {\n  measure: c is count() { where: color = 'red' }\n}"
    );
  });

  test('long filter shortcut wraps to a block', () => {
    const out = pp(
      "source: x is duckdb.table('t') extend { measure: c is count() { where: brand_name = 'Acme Corporation' and category_name = 'Furniture' and region_name = 'NorthEast' } }"
    );
    expect(out).toContain('count() {\n');
    expect(out).toMatch(/where:[^\n]*\n\s*}/);
  });

  test('inline form keeps `;` between clauses', () => {
    eq(
      "source: x is duckdb.table('t') extend { measure: c is count() { where: a = 1; partition_by: b } }",
      "source: x is duckdb.table('t') extend {\n  measure: c is count() { where: a = 1; partition_by: b }\n}"
    );
  });
});

describe('prettify — block-body blank lines', () => {
  test('same-kind adjacent statements: no blank between', () => {
    eq(
      "source: x is duckdb.table('t') extend {\n  dimension: a is 1\n\n  dimension: b is 2\n}",
      "source: x is duckdb.table('t') extend {\n  dimension: a is 1\n  dimension: b is 2\n}"
    );
  });

  test('different-kind with user blank: preserved (one blank)', () => {
    eq(
      "source: x is duckdb.table('t') extend {\n  dimension: a is 1\n\n  measure: b is sum(a)\n}",
      "source: x is duckdb.table('t') extend {\n  dimension: a is 1\n\n  measure: b is sum(a)\n}"
    );
  });

  test('different-kind without user blank: still no blank', () => {
    eq(
      "source: x is duckdb.table('t') extend {\n  dimension: a is 1\n  measure: b is sum(a)\n}",
      "source: x is duckdb.table('t') extend {\n  dimension: a is 1\n  measure: b is sum(a)\n}"
    );
  });
});

describe('prettify — pick statement', () => {
  test('short pick stays inline', () => {
    eq(
      "source: x is duckdb.table('t') extend { dimension: c is a ? pick 'low' when < 5 else 'high' }",
      "source: x is duckdb.table('t') extend {\n  dimension: c is a ? pick 'low' when < 5 else 'high'\n}"
    );
  });

  test('overflow → wrapped with column-aligned `when`, else flush', () => {
    const out = pp(
      "source: x is duckdb.table('t') extend { dimension: c is title ? pick 'Facebook' when ~ r'(Facebook|Instagram|Whatsapp)' pick 'Apple' when ~ r'(Apple|iPhone|IOS)' pick 'Amazon' when ~ r'(Amazon|AWS)' else 'OTHER' }"
    );
    // Find the lines starting with "pick" — they should all have "when" at the
    // same column.
    const lines = out.split('\n');
    const pickLines = lines.filter(l => l.match(/^\s+pick /));
    expect(pickLines.length).toBe(3);
    const whenCols = pickLines.map(l => l.indexOf(' when '));
    expect(new Set(whenCols).size).toBe(1); // all the same column
    // else aligns with pick (left edge).
    const elseLine = lines.find(l => l.match(/^\s+else /));
    const pickIndent = pickLines[0].match(/^\s*/)![0].length;
    const elseIndent = elseLine!.match(/^\s*/)![0].length;
    expect(elseIndent).toBe(pickIndent);
  });

  test('single pick still too long → break at WHEN', () => {
    const out = pp(
      "source: x is duckdb.table('t') extend { dimension: c is x ? pick 'this is an unusually long value that overflows the budget on its own' when 'this is also a long matching condition' else 'fallback' }"
    );
    // Expect a line that's just `pick '...'` followed by another line that
    // starts with `when '...'`.
    expect(out).toMatch(/\n\s+pick '[^']+'\n\s+when '/);
  });
});

describe('prettify — case statement', () => {
  test('short case stays inline', () => {
    eq(
      "source: x is duckdb.table('t') extend { dimension: c is case when a > 5 then 'big' else 'small' end }",
      "source: x is duckdb.table('t') extend {\n  dimension: c is case when a > 5 then 'big' else 'small' end\n}"
    );
  });

  test('overflow → wrapped with column-aligned THEN', () => {
    const out = pp(
      "source: x is duckdb.table('t') extend { dimension: c is case when category = 'electronics' then price * 1.2 when category = 'food' then price * 0.95 when category = 'household' then price * 1.0 else price end }"
    );
    const lines = out.split('\n');
    const whenLines = lines.filter(l => l.match(/^\s+when /));
    expect(whenLines.length).toBe(3);
    const thenCols = whenLines.map(l => l.indexOf(' then '));
    expect(new Set(thenCols).size).toBe(1);
    expect(lines.some(l => l.trim() === 'end')).toBe(true);
  });
});

describe('prettify — binary chain', () => {
  test('short and-chain stays inline', () => {
    eq(
      "source: x is duckdb.table('t') extend { measure: c is count() { where: a > 5 and b < 10 } }",
      "source: x is duckdb.table('t') extend {\n  measure: c is count() { where: a > 5 and b < 10 }\n}"
    );
  });

  test('long + chain wraps with leading +', () => {
    const out = pp(
      "source: x is duckdb.table('t') extend { measure: t is total_a + total_b + total_c + total_d + total_e + total_f + total_g + total_h + total_i + total_j }"
    );
    expect(out).toMatch(/total_a\n\s+\+ total_b\n\s+\+ total_c/);
  });

  test('long ?? chain wraps with leading ??', () => {
    const out = pp(
      "source: x is duckdb.table('t') extend { dimension: v is (event_params.value.int_value ?? event_params.value.float_value ?? event_params.value.double_value) }"
    );
    expect(out).toMatch(/\n\s+\?\? event_params\.value\./);
  });

  test('comparisons do NOT break (we keep them glued)', () => {
    // Long AND chain whose operands are comparisons. AND chain breaks at AND;
    // each comparison stays glued on its own line.
    const out = pp(
      "source: x is duckdb.table('t') extend { dimension: c is field_aa = 'AA' and field_bb = 'BB' and field_cc = 'CC' and field_dd = 'DD' and field_ee = 'EE' and field_ff = 'FF' }"
    );
    // Lines starting with `and` should each contain exactly one `=`
    // (the comparison wasn't split across lines).
    const andLines = out.split('\n').filter(l => l.match(/^\s*and /));
    expect(andLines.length).toBeGreaterThan(0);
    for (const line of andLines) {
      expect((line.match(/=/g) ?? []).length).toBe(1);
    }
  });
});

describe('prettify — paren wrap', () => {
  test('single-arg long call: does NOT wrap (no useful break point)', () => {
    eq(
      "source: x is duckdb.table('this_is_a_very_long_table_name_that_pushes_things_past_the_budget_easily.parquet')",
      "source: x is duckdb.table('this_is_a_very_long_table_name_that_pushes_things_past_the_budget_easily.parquet')"
    );
  });

  test('multi-arg long call: wraps each arg on own line', () => {
    const args = Array.from({length: 30}, (_, i) => `\`arg_${i}\``).join(', ');
    const out = pp(`source: x is compose(${args})`);
    expect(out).toMatch(/^source: x is compose\(\n/);
    // Each arg starts a line at +1 indent, followed by `,` (except the last).
    const argLines = out.split('\n').filter(l => l.match(/^\s+`arg_/));
    expect(argLines.length).toBe(30);
    expect(out.endsWith(')')).toBe(true);
  });

  test('grouping paren `(LONG + LONG)`: wraps and binary chain breaks inside', () => {
    // Operand names long enough that even at +1 indent the chain itself
    // overflows, forcing the inner binary-chain rule to break.
    const out = pp(
      "source: x is duckdb.table('t') extend { dimension: c is (alpha_long_operand + beta_long_operand + gamma_long_operand + delta_long_operand + epsilon_long_operand + zeta_long_operand) }"
    );
    expect(out).toMatch(/c is \(\n/);
    expect(out).toMatch(/\n\s+\+ beta_long_operand/);
    expect(out).toMatch(/\)\n/);
  });
});

describe('prettify — comments', () => {
  test('trailing comment stays on the previous line', () => {
    const out = pp(
      "source: x is duckdb.table('t') // table comment\n" +
        '// description above source\n' +
        'source: y is x extend { dimension: a is 1 }'
    );
    expect(out).toContain("source: x is duckdb.table('t') // table comment");
  });

  test('leading comment for a top-level statement gets a blank line above it', () => {
    const out = pp(
      "source: x is duckdb.table('t')\n\n// describes y\nsource: y is x"
    );
    // There should be a blank line before the `//` comment block.
    expect(out).toMatch(/source: x[^\n]*\n\n\/\/ describes y\nsource: y is x/);
  });
});

describe('prettify — comment preservation', () => {
  test('block comment inside an inline section list is preserved (forces wrap)', () => {
    const out = pp(
      "source: x is duckdb.table('t') -> { group_by: a, b /* keep */, c }"
    );
    expect(out).toContain('/* keep */');
  });

  test('block comment inside an inline postfix `{...}` is preserved', () => {
    const out = pp(
      "source: x is duckdb.table('t') extend { measure: c is count() { where: a /* keep */ = 1 } }"
    );
    expect(out).toContain('/* keep */');
  });

  test('block comment between is-items is preserved', () => {
    const out = pp(
      "source: x is duckdb.table('t') extend { measure: a is sum(x) /* keep */, b is avg(x) }"
    );
    expect(out).toContain('/* keep */');
  });

  test('block comment inside a pick value is preserved', () => {
    const out = pp(
      "source: x is duckdb.table('t') extend { dimension: c is title ? pick 'Facebook' when ~ r'(Facebook|Instagram|Whatsapp)' /* fb-tag */ pick 'Apple' when ~ r'(Apple|iPhone|IOS)' pick 'Amazon' when ~ r'(Amazon|AWS)' else 'OTHER' }"
    );
    expect(out).toContain('/* fb-tag */');
  });

  test('EOL comment inside an inline candidate forces wrapped form', () => {
    const out = pp(
      "source: x is duckdb.table('t') -> { group_by: a, b, // keep\n c }"
    );
    expect(out).toContain('// keep');
  });
});

describe('prettify — annotations', () => {
  test('annotation above a top-level statement stays attached', () => {
    eq(
      "# tag\nsource: x is duckdb.table('t')",
      "# tag\nsource: x is duckdb.table('t')"
    );
  });

  test('source-trailing annotation reformats onto its own line above next statement', () => {
    eq(
      "source: x is duckdb.table('t') extend {\n  dimension: a is 1 # tag\n  measure: b is sum(a)\n}",
      "source: x is duckdb.table('t') extend {\n  dimension: a is 1\n  # tag\n  measure: b is sum(a)\n}"
    );
  });

  test('annotation on a section item lands above the item at the same indent', () => {
    eq(
      "source: x is duckdb.table('t') extend { measure: # currency \n a is sum(x) }",
      "source: x is duckdb.table('t') extend {\n" +
        '  measure:\n' +
        '    # currency\n' +
        '    a is sum(x)\n' +
        '}'
    );
  });
});

describe('prettify — SQL string', () => {
  test('verbatim from source (incl. malloy interpolation)', () => {
    const sql = '"""\n  SELECT * FROM %{ stuff } WHERE x > 0\n"""';
    eq(`source: x is duckdb.sql(${sql})`, `source: x is duckdb.sql(${sql})`);
  });
});

describe('prettify — semicolons', () => {
  test('wrapped form drops `;`', () => {
    eq(
      "source: x is duckdb.table('t') extend {\n  dimension: a is 1;\n  dimension: b is 2;\n}",
      "source: x is duckdb.table('t') extend {\n  dimension: a is 1\n  dimension: b is 2\n}"
    );
  });

  test('inline postfix `{…}` keeps `; `', () => {
    eq(
      "source: x is duckdb.table('t') extend { measure: c is count() { where: a = 1; partition_by: b } }",
      "source: x is duckdb.table('t') extend {\n  measure: c is count() { where: a = 1; partition_by: b }\n}"
    );
  });
});

describe('prettify — invariants', () => {
  const samples = [
    "source: x is duckdb.table('t') extend { measure: c is count() }",
    "# tag\nsource: x is duckdb.table('t') extend { dimension: a is 1, b is 2 }",
    "source: x is duckdb.table('t') -> { group_by: a, b, c is region_id + 1 }",
    "source: x is duckdb.table('t') extend { measure: c is count() { where: a > 5 and b < 10 } }",
    "source: x is duckdb.table('t') extend { dimension: c is a ? pick 'lo' when < 5 else 'hi' }",
    "source: x is duckdb.table('t') extend { dimension: c is case when a > 5 then 'big' else 'small' end }",
  ];

  test.each(samples)('idempotent: %s', src => {
    const a = prettify(src).result;
    const b = prettify(a).result;
    expect(b).toBe(a);
  });

  test.each(samples)('output parses cleanly: %s', src => {
    const r = prettify(src);
    const out = prettify(r.result);
    expect(out.errors.length).toBeLessThanOrEqual(r.errors.length);
  });

  test('parse errors in input are surfaced, output still produced', () => {
    const r = prettify("source: x is duckdb.table('t' extend {"); // missing )
    expect(r.errors.length).toBeGreaterThan(0);
    expect(typeof r.result).toBe('string');
  });
});

describe('prettify — keyword-named function calls hug `(`', () => {
  // Names that lex as keywords (ALL, EXCLUDE, YEAR, MONTH, …) but are
  // commonly used as function calls. Without the explicit hug rule the
  // prettifier inserts a space — `all (x)`, `year (created_at)` — which
  // neither idiomatic Malloy nor the lexer expects.
  const callableKeywords = [
    ['all', 'all(population)'],
    ['exclude', 'exclude(population, name)'],
    ['year', 'year(created_at)'],
    ['month', 'month(created_at)'],
    ['day', 'day(created_at)'],
    ['hour', 'hour(created_at)'],
    ['minute', 'minute(created_at)'],
    ['second', 'second(created_at)'],
    ['week', 'week(created_at)'],
    ['quarter', 'quarter(created_at)'],
  ];
  test.each(callableKeywords)('%s hugs its (', (_name, call) => {
    const out = pp(
      `source: x is duckdb.table('t') extend { measure: r is ${call} }`
    );
    expect(out).toContain(call);
    // No space inserted before the open paren — the call hugs.
    expect(out).not.toMatch(/\b\w+ \(/);
  });

  // Type names (TIMESTAMP, DATE, NUMBER, STRING, BOOLEAN, JSON) appear as
  // function-call targets only via the `!` cast operator (`epoch_ms!timestamp(x)`).
  // Confirm that form hugs.
  const castTypes = ['timestamp', 'date', 'number', 'string', 'boolean'];
  test.each(castTypes)('event_ms!%s(x) hugs', typeName => {
    const out = pp(
      `source: x is duckdb.table('t') extend { dimension: t is event_ms!${typeName}(x) }`
    );
    expect(out).toContain(`event_ms!${typeName}(x)`);
  });

  test('`!` cast operator with a 0-arg call form glues both sides', () => {
    eq(
      "source: x is duckdb.table('t') extend { dimension: t is event_ms!timestamp(x) }",
      "source: x is duckdb.table('t') extend {\n" +
        '  dimension: t is event_ms!timestamp(x)\n' +
        '}'
    );
  });
});

describe('prettify — join_one / index / include sections', () => {
  test('multi-item join_one wraps one per line', () => {
    eq(
      'source: x is users extend {\n' +
        '  join_one: orders with user_id, profiles with id, prefs with id\n' +
        '}',
      'source: x is users extend {\n' +
        '  join_one:\n' +
        '    orders with user_id\n' +
        '    profiles with id\n' +
        '    prefs with id\n' +
        '}'
    );
  });

  test('single join_one stays inline if short', () => {
    eq(
      'source: x is users extend { join_one: orders with user_id }',
      'source: x is users extend {\n  join_one: orders with user_id\n}'
    );
  });

  test('long index list wraps with continuation indented past keyword', () => {
    const fields = Array.from({length: 20}, (_, i) => `field_${i}`).join(', ');
    const out = pp(
      `source: x is duckdb.table('t') extend { view: i is { index: ${fields} } }`
    );
    // Wrapped index list lines must be indented further than the `index:`
    // keyword itself.
    const lines = out.split('\n');
    const indexLine = lines.find(l => l.match(/^\s*index:\s*$/));
    expect(indexLine).toBeDefined();
    const indexCol = indexLine!.length - indexLine!.trimStart().length;
    const fieldLines = lines.filter(l => l.match(/^\s+field_\d+/));
    expect(fieldLines.length).toBeGreaterThan(0);
    for (const line of fieldLines) {
      const col = line.length - line.trimStart().length;
      expect(col).toBeGreaterThan(indexCol);
    }
  });

  test('include block items wrap with continuation indented past keyword', () => {
    const fields = Array.from({length: 12}, (_, i) => `_field_${i}`).join(', ');
    const out = pp(
      'source: x is base include {\n' + `  internal: ${fields}\n` + '}'
    );
    const lines = out.split('\n');
    const internalLine = lines.find(l => l.match(/^\s*internal:\s*$/));
    expect(internalLine).toBeDefined();
    const internalCol = internalLine!.length - internalLine!.trimStart().length;
    const itemLines = lines.filter(l => l.match(/^\s+_field_/));
    expect(itemLines.length).toBeGreaterThan(0);
    for (const line of itemLines) {
      const col = line.length - line.trimStart().length;
      expect(col).toBeGreaterThan(internalCol);
    }
  });
});

describe('prettify — view: blank-line policy', () => {
  test('forces blank between two view: definitions even without user blank', () => {
    const out = pp(
      "source: x is duckdb.table('t') extend {\n" +
        '  view: a is { aggregate: c is count() }\n' +
        '  view: b is { aggregate: c is count() }\n' +
        '}'
    );
    // A blank line must sit between the two `view:` definitions. The body
    // shape itself is the block-body rule's call — only the inter-view
    // blank is what this test asserts.
    expect(out).toMatch(/^ {2}}\n\n {2}view: b is/m);
  });

  test('inserts blank between non-view and following view: even without user blank', () => {
    const out = pp(
      "source: x is duckdb.table('t') extend {\n" +
        '  measure: c is count()\n' +
        '  view: a is { aggregate: c }\n' +
        '}'
    );
    expect(out).toMatch(/measure: c is count\(\)\n\n {2}view: a is/);
  });
});

describe('prettify — multi-statement {…} bodies do not collapse inline', () => {
  test('nest with multi-statement body wraps even when it fits', () => {
    const out = pp(
      'source: x is t -> { nest: by_y is { group_by: y aggregate: c is count() } }'
    );
    // The body has two statements (group_by + aggregate); even if it would
    // fit on one line, force the wrapped form.
    expect(out).toMatch(
      /nest: by_y is \{\n\s+group_by: y\n\s+aggregate: c is count\(\)\n\s+\}/
    );
  });

  test('nest with single-statement body still inlines if it fits', () => {
    const out = pp('source: x is t -> { nest: by_y is { group_by: y } }');
    expect(out).toContain('nest: by_y is { group_by: y }');
  });
});

describe('prettify — single-item nest: NAME stays on same line as nest:', () => {
  test('single nest with multi-line body opens with `nest: name is {`', () => {
    const out = pp(
      'source: x is t -> { nest: dash is { group_by: y aggregate: c is count() } }'
    );
    // Opener is on one line — name is NOT broken onto its own line.
    expect(out).not.toMatch(/nest:\s*\n\s+dash is \{/);
    expect(out).toMatch(/nest: dash is \{/);
  });
});

describe('prettify — empty {} stays one line', () => {
  test('empty extend block', () => {
    eq('source: x is users extend {}', 'source: x is users extend {}');
  });
  test('empty body in a join target', () => {
    eq(
      'source: x is users extend { join_one: o is orders extend {} on user_id = o.user_id }',
      'source: x is users extend {\n' +
        '  join_one: o is orders extend {} on user_id = o.user_id\n' +
        '}'
    );
  });
  test('comment inside otherwise-empty {} is preserved (does not collapse)', () => {
    // Empty-body inline collapse drops the comment if applied here, so the
    // inline shortcut must be skipped when hidden tokens sit in the gap.
    const out = pp('source: x is users extend { /* keep */ }');
    expect(out).toContain('/* keep */');
  });
});

describe('prettify — import select', () => {
  test('single-name import stays on one line', () => {
    eq(
      "import {flights_cube_base} from 'flights_cube.malloy'",
      "import {flights_cube_base} from 'flights_cube.malloy'"
    );
  });
  test('few-name import stays on one line', () => {
    eq("import {a, b, c} from 'x.malloy'", "import {a, b, c} from 'x.malloy'");
  });
  test('long import wraps each item on its own line', () => {
    const names = Array.from({length: 12}, (_, i) => `name_number_${i}`).join(
      ', '
    );
    const out = pp(`import {${names}} from 'x.malloy'`);
    expect(out).toMatch(/^import \{\n/);
    expect(out).toMatch(/\n\} from 'x\.malloy'/);
  });
  test('block comment between import and select brace is preserved', () => {
    const out = pp("import /* tag */ {a} from 'x.malloy'");
    expect(out).toContain('/* tag */');
  });
  test('block comment between import items is preserved', () => {
    // The inline form would drop the comment (renderItemInline strips
    // hidden tokens). When any comment is present in the items' span the
    // formatter must fall back to a comment-safe wrapped form.
    const out = pp("import {a, /* keep */ b} from 'x.malloy'");
    expect(out).toContain('/* keep */');
  });
});

describe('prettify — comment placement inside aggregate/measure blocks', () => {
  test('trailing comment inside aggregate stays at item indent (not hoisted out)', () => {
    const out = pp(
      'source: x is t -> { aggregate: a is count() // keep here\n}'
    );
    // The comment should sit on the line of `a is count()` (same-line tail).
    expect(out).toContain('a is count() // keep here');
  });

  test('own-line comment between last aggregate item and `}` stays inside aggregate', () => {
    const out = pp(
      'source: x is t extend {\n' +
        '  measure:\n' +
        '    a is count()\n' +
        '    b is sum(a)\n' +
        '    // belongs to the measure block\n' +
        '}'
    );
    // The comment line should be indented at the measure items level (4
    // spaces under the source body), not flush with the closing `}`.
    const lines = out.split('\n');
    const commentLine = lines.find(l => l.includes('// belongs to'));
    expect(commentLine).toBeDefined();
    const itemLine = lines.find(l => l.includes('a is count()'));
    const itemIndent = itemLine!.length - itemLine!.trimStart().length;
    const commentIndent = commentLine!.length - commentLine!.trimStart().length;
    expect(commentIndent).toBe(itemIndent);
  });
});

// Regressions caught by external review. Each was a comment-handling bug:
// dropped, duplicated, or landing at the wrong indent. Idempotence (asserted
// inside `pp()`) is the load-bearing property here — these all originally
// failed it.
describe('prettify — given:', () => {
  test('single bare given stays inline', () => {
    eq('given: A :: number', 'given: A :: number');
  });

  test('single given with default stays inline', () => {
    eq('given: A :: number is 1', 'given: A :: number is 1');
  });

  test('multiple bare givens that fit pack inline', () => {
    eq('given: A :: number, B :: string', 'given: A :: number, B :: string');
  });

  test('mixed bare and is-bearing givens wrap, each on its own line', () => {
    eq(
      'given: A :: number is 1, B :: string',
      'given:\n  A :: number is 1\n  B :: string'
    );
  });

  test('all is-bearing givens wrap, each on its own line', () => {
    eq(
      'given: A :: number is 1, B :: string is "hi"',
      'given:\n  A :: number is 1\n  B :: string is "hi"'
    );
  });

  test('adjacent given: statements get a blank line between them', () => {
    eq(
      'given: A :: number\ngiven: B :: string',
      'given: A :: number\n\ngiven: B :: string'
    );
  });

  test('annotation on a given is preserved above the keyword', () => {
    eq('# label="x"\ngiven: A :: number', '# label="x"\ngiven: A :: number');
  });

  test('filter<T> given type renders glued', () => {
    eq('given: F :: filter<string>', 'given: F :: filter<string>');
  });

  test('filter<T> in inline section list renders glued', () => {
    eq(
      'given: A :: number, F :: filter<string>',
      'given: A :: number, F :: filter<string>'
    );
  });
});

describe('prettify — filter<T> on source parameters', () => {
  test('filter<T> parameter type renders glued', () => {
    eq(
      "source: x(F :: filter<string>) is duckdb.table('t')",
      "source: x(F :: filter<string>) is duckdb.table('t')"
    );
  });
});

describe('prettify — repro', () => {
  test('tail comment in wrapped postfix `{...}` is preserved', () => {
    eq(
      "source: x is duckdb.table('t') extend { measure: c is count() { where: a = 1 /* keep1 */ } }",
      "source: x is duckdb.table('t') extend {\n" +
        '  measure:\n' +
        '    c is count() {\n' +
        '      where: a = 1 /* keep1 */\n' +
        '    }\n' +
        '}'
    );
  });

  test('gap + internal pick comments emit once, idempotently', () => {
    eq(
      "source: x is duckdb.table('t') extend { dimension: c is title ? pick 'A' when ~ r'a' /* gap */ pick 'B' /* internal */ when ~ r'b' else 'O' }",
      "source: x is duckdb.table('t') extend {\n" +
        '  dimension:\n' +
        '    c is title ?\n' +
        "      pick 'A' when ~ r'a' /* gap */\n" +
        "      pick 'B' /* internal */\n" +
        "      when ~ r'b'\n" +
        "      else 'O'\n" +
        '}'
    );
  });

  test('EOL tail comment in wrapped section list stays at inner indent', () => {
    eq(
      "source: x is duckdb.table('t') extend { measure: a is sum(x), b is avg(x) // keep3\n}",
      "source: x is duckdb.table('t') extend {\n" +
        '  measure:\n' +
        '    a is sum(x)\n' +
        '    b is avg(x) // keep3\n' +
        '}'
    );
  });
});
