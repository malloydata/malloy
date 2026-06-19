import {runtimeFor} from '../runtimes';
import {validateRenderTags} from '@malloydata/render-validator';

const runtime = runtimeFor('duckdb');

afterAll(async () => {
  await runtime.connection.close();
});

interface LogMessage {
  severity: string;
  message: string;
}

async function getValidationLogs(malloySource: string): Promise<LogMessage[]> {
  const pr = await runtime
    .loadModel(malloySource)
    .loadQueryByName('q')
    .getPreparedResult();
  return validateRenderTags(pr.toStableResult());
}

function expectError(logs: LogMessage[], substring: string) {
  expect(logs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        message: expect.stringContaining(substring),
      }),
    ])
  );
}

function expectNoErrors(logs: LogMessage[]) {
  const errors = logs.filter(l => l.severity === 'error');
  expect(errors).toHaveLength(0);
}

function expectNoWarnings(logs: LogMessage[]) {
  const warnings = logs.filter(l => l.severity === 'warn');
  expect(warnings).toHaveLength(0);
}

// Reusable SQL fragments
const NUM_FIELD = 'duckdb.sql("SELECT 1 as val")';
const STR_FIELD = 'duckdb.sql("SELECT \'hello\' as val")';

describe('render tag validation', () => {
  describe('tags on wrong field types', () => {
    it.each(['link', 'image'])(
      'errors when # %s is on a number field',
      async tagName => {
        const logs = await getValidationLogs(`
          query: q is ${NUM_FIELD} -> {
            select:
              # ${tagName}
              val
          }
        `);
        expectError(logs, `'${tagName}'`);
      }
    );

    it.each(['currency', 'percent'])(
      'errors when # %s is on a string field',
      async tagName => {
        const logs = await getValidationLogs(`
          query: q is ${STR_FIELD} -> {
            select:
              # ${tagName}
              val
          }
        `);
        expectError(logs, `'${tagName}'`);
      }
    );

    it('errors when # duration is on a string field', async () => {
      const logs = await getValidationLogs(`
        query: q is ${STR_FIELD} -> {
          select:
            # duration=seconds
            val
        }
      `);
      expectError(logs, "'duration'");
    });

    it('errors when # number has a bare numeric value', async () => {
      const logs = await getValidationLogs(`
        query: q is ${NUM_FIELD} -> {
          select:
            # number=0.00
            val
        }
      `);
      expectError(logs, 'bare numeric');
    });

    it('no error when # number has a quoted format string', async () => {
      const logs = await getValidationLogs(`
        query: q is ${NUM_FIELD} -> {
          select:
            # number="#,##0.00"
            val
        }
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });
  });

  describe('invalid enum values', () => {
    it('errors on invalid currency code', async () => {
      const logs = await getValidationLogs(`
        query: q is ${NUM_FIELD} -> {
          select:
            # currency=yen
            val
        }
      `);
      expectError(logs, 'yen');
    });

    it('errors on invalid duration unit', async () => {
      const logs = await getValidationLogs(`
        query: q is ${NUM_FIELD} -> {
          select:
            # duration=fortnights
            val
        }
      `);
      expectError(logs, 'fortnights');
    });

    it('accepts valid currency code', async () => {
      const logs = await getValidationLogs(`
        query: q is ${NUM_FIELD} -> {
          select:
            # currency=usd
            val
        }
      `);
      expectNoErrors(logs);
    });

    it('accepts valid duration unit', async () => {
      const logs = await getValidationLogs(`
        query: q is ${NUM_FIELD} -> {
          select:
            # duration=milliseconds
            val
        }
      `);
      expectNoErrors(logs);
    });

    it('errors on invalid viz mode', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as x, 2 as y") extend {
          # viz=line viz { mode=sparkle }
          view: q is { group_by: x; aggregate: y is count() }
        }
        query: q is s -> q
      `);
      expectError(logs, 'sparkle');
    });

    it('errors on invalid big_value size', async () => {
      const logs = await getValidationLogs(`
        source: s is ${NUM_FIELD} extend {
          # big_value { size=huge }
          view: q is { aggregate: val is count() }
        }
        query: q is s -> q
      `);
      expectError(logs, 'huge');
    });

    it('errors on invalid big_value comparison_format', async () => {
      const logs = await getValidationLogs(`
        source: s is ${NUM_FIELD} extend {
          # big_value
          view: q is {
            aggregate: total is count()
            aggregate:
              # big_value { comparison_field=total comparison_format=ratio }
              prior is count()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, 'ratio');
    });

    it('errors on invalid number scale', async () => {
      const logs = await getValidationLogs(`
        query: q is ${NUM_FIELD} -> {
          select:
            # number { scale=z }
            val
        }
      `);
      expectError(logs, 'scale');
    });

    it('errors on invalid number suffix', async () => {
      const logs = await getValidationLogs(`
        query: q is ${NUM_FIELD} -> {
          select:
            # number { suffix=emoji }
            val
        }
      `);
      expectError(logs, 'emoji');
    });

    it('errors on invalid column word_break', async () => {
      const logs = await getValidationLogs(`
        query: q is ${STR_FIELD} -> {
          select:
            # column { word_break=wrap }
            val
        }
      `);
      expectError(logs, 'wrap');
    });
  });

  describe('nest-only tags on scalar fields', () => {
    it.each(['bar_chart', 'list', 'dashboard', 'transpose', 'table'])(
      'errors when # %s is on a scalar field',
      async tagName => {
        const logs = await getValidationLogs(`
          query: q is ${NUM_FIELD} -> {
            select:
              # ${tagName}
              val
          }
        `);
        expectError(logs, `'${tagName}'`);
      }
    );
  });

  describe('big_value', () => {
    it('errors when big_value view has group_by fields', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'Acme' as manufacturer, 5 as recall_count") extend {
          # big_value
          view: q is {
            group_by: manufacturer
            aggregate: total_recalls is count()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, 'group_by');
    });

    it('no error when big_value view has only aggregates', async () => {
      const logs = await getValidationLogs(`
        source: s is ${NUM_FIELD} extend {
          # big_value
          view: q is {
            aggregate: total is count()
          }
        }
        query: q is s -> q
      `);
      const bigValueErrors = logs.filter(
        l => l.severity === 'error' && l.message.includes('big_value')
      );
      expect(bigValueErrors).toHaveLength(0);
    });

    it('no error when big_value view has nests for sparklines', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as val, DATE '2024-01-01' as dt") extend {
          # big_value
          view: q is {
            aggregate: total is count()
            # line_chart { size=spark }
            # hidden
            nest: trend is {
              group_by: dt
              aggregate: total is count()
            }
          }
        }
        query: q is s -> q
      `);
      const bigValueGroupByErrors = logs.filter(
        l =>
          l.severity === 'error' &&
          l.message.includes('big_value') &&
          l.message.includes('group_by')
      );
      expect(bigValueGroupByErrors).toHaveLength(0);
    });

    it('no error when aggregate has big_value comparison config', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as val") extend {
          # big_value
          view: q is {
            aggregate: total is count()
            aggregate:
              # big_value { comparison_field=total }
              prior is count()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
    });

    it('no error when aggregate has big_value sparkline config', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as val, DATE '2024-01-01' as dt") extend {
          # big_value
          view: q is {
            aggregate: total is count()
            # big_value { sparkline=trend }
            aggregate: total2 is count()
            # hidden # line_chart { size=spark }
            nest: trend is {
              group_by: dt
              aggregate: c is count()
            }
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
    });

    it('errors when big_value child config is on a nested child field', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as val, DATE '2024-01-01' as dt") extend {
          # big_value
          view: q is {
            aggregate: total is count()
            # big_value { comparison_field=total }
            nest: trend is {
              group_by: dt
              aggregate: c is count()
            }
          }
        }
        query: q is s -> q
      `);
      expectError(logs, 'only valid on basic fields');
      expectNoWarnings(logs);
    });

    it('errors when big_value child config is on the big_value parent field', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as val") extend {
          # big_value { comparison_field=total }
          view: q is {
            aggregate: total is count()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, 'only valid on basic fields');
      expectNoWarnings(logs);
    });

    it('errors when big_value child config is outside big_value context', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as val") extend {
          view: q is {
            aggregate:
              total is count()
              # big_value { comparison_field=total }
              prior is count()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, 'only valid on basic fields');
      expectNoWarnings(logs);
    });

    it('errors when a child-only big_value (sparkline) is on the view itself', async () => {
      // The exact shape that rendered as "[object Object]" in Publisher: a
      // child-only `# big_value { sparkline=... }` placed on a view with no
      // activating big_value. The renderer declines to match it, so this error
      // must surface (now recorded on the field and rendered, see apply-renderer).
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as val") extend {
          # big_value { sparkline=trend }
          view: q is {
            aggregate: total is count()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, 'only valid on basic fields');
    });
  });

  describe('dashboard', () => {
    it('errors when # span is out of range (too high)', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a") extend {
          # dashboard
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=15
              a_total is a.sum()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, 'span');
    });

    it('errors when # span is out of range (zero)', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a") extend {
          # dashboard
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=0
              a_total is a.sum()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, 'span');
    });

    it('errors when # dashboard.columns is non-positive', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a") extend {
          # dashboard { columns=0 }
          view: q is {
            group_by: grp is 'all'
            aggregate: a_total is a.sum()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, 'dashboard.columns');
    });

    it('errors when # dashboard.gap is negative', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a") extend {
          # dashboard { gap=-5 }
          view: q is {
            group_by: grp is 'all'
            aggregate: a_total is a.sum()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, 'dashboard.gap');
    });

    it('warns when # span is set alongside # dashboard.columns', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b") extend {
          # dashboard { columns=3 }
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=6
              a_total is a.sum()
              b_total is b.sum()
          }
        }
        query: q is s -> q
      `);
      const warnings = logs.filter(l => l.severity === 'warn');
      expect(warnings.length).toBeGreaterThan(0);
      expect(
        warnings.some(
          w => w.message.includes('span') && w.message.includes('columns mode')
        )
      ).toBe(true);
    });

    it('warns when # span is used on a dashboard with no grid', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b") extend {
          # dashboard
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=6
              a_total is a.sum()
              b_total is b.sum()
          }
        }
        query: q is s -> q
      `);
      const warnings = logs.filter(l => l.severity === 'warn');
      expect(
        warnings.some(
          w => w.message.includes('span') && w.message.includes('no grid')
        )
      ).toBe(true);
    });

    it('does not warn for # span when the dashboard has a grid via gap', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b") extend {
          # dashboard { gap=16 }
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=6
              a_total is a.sum()
              b_total is b.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('span range error names the expected range, the bad value, and a fix', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a") extend {
          # dashboard
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=15
              a_total is a.sum()
          }
        }
        query: q is s -> q
      `);
      const spanError = logs.find(
        l => l.severity === 'error' && l.message.includes('span')
      );
      expect(spanError?.message).toContain('expected an integer 1–12');
      expect(spanError?.message).toContain('got 15');
      expect(spanError?.message).toContain('Fix: # span=6');
    });

    it('does not error when # dashboard.gap is zero', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a") extend {
          # dashboard { gap=0 }
          view: q is {
            group_by: grp is 'all'
            aggregate: a_total is a.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
    });

    it('warns no-grid (not columns mode) for # span with invalid columns', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b") extend {
          # dashboard { columns=0 }
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=6
              a_total is a.sum()
              b_total is b.sum()
          }
        }
        query: q is s -> q
      `);
      // columns=0 is invalid, so the renderer falls back to flex. The span
      // warning must describe the actual state (no grid), not columns mode.
      const warnings = logs.filter(l => l.severity === 'warn');
      expect(
        warnings.some(
          w => w.message.includes('span') && w.message.includes('no grid')
        )
      ).toBe(true);
      expect(warnings.some(w => w.message.includes('columns mode'))).toBe(
        false
      );
    });

    it('errors when # span is set to a non-numeric value', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a") extend {
          # dashboard
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span="foo"
              a_total is a.sum()
          }
        }
        query: q is s -> q
      `);
      const spanError = logs.find(
        l => l.severity === 'error' && l.message.includes('span')
      );
      expect(spanError?.message).toContain('Invalid # span');
      expect(spanError?.message).toContain('non-numeric');
    });

    it('does not also warn no-grid when # span fails the range check', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a") extend {
          # dashboard
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=15
              a_total is a.sum()
          }
        }
        query: q is s -> q
      `);
      // A single mistake should produce a single diagnostic: the range error
      // fires and the "ignored / no grid" warning is suppressed.
      const spanErrors = logs.filter(
        l => l.severity === 'error' && l.message.includes('span')
      );
      expect(spanErrors.length).toBe(1);
      const spanWarnings = logs.filter(
        l => l.severity === 'warn' && l.message.includes('span')
      );
      expect(spanWarnings.length).toBe(0);
    });

    it('labels an ignored (not invalid) # span as "Ignored"', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b") extend {
          # dashboard { columns=3 }
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=6
              a_total is a.sum()
              b_total is b.sum()
          }
        }
        query: q is s -> q
      `);
      const spanWarning = logs.find(
        l => l.severity === 'warn' && l.message.includes('span')
      );
      expect(spanWarning?.message).toContain('Ignored # span');
      expect(spanWarning?.message).not.toContain('Invalid # span');
    });

    it('labels the no-grid ignored # span as "Ignored"', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b") extend {
          # dashboard
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=6
              a_total is a.sum()
              b_total is b.sum()
          }
        }
        query: q is s -> q
      `);
      const spanWarning = logs.find(
        l => l.severity === 'warn' && l.message.includes('span')
      );
      expect(spanWarning?.message).toContain('Ignored # span');
      expect(spanWarning?.message).toContain('no grid');
      expect(spanWarning?.message).not.toContain('Invalid # span');
    });

    it('does not also warn columns-mode when # span fails the range check', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b") extend {
          # dashboard { columns=3 }
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=15
              a_total is a.sum()
              b_total is b.sum()
          }
        }
        query: q is s -> q
      `);
      // Even in columns mode, an out-of-range span yields a single range error
      // and no "columns mode" warning, because the else-if suppresses it.
      const spanErrors = logs.filter(
        l => l.severity === 'error' && l.message.includes('span')
      );
      expect(spanErrors.length).toBe(1);
      expect(spanErrors[0].message).toContain('got 15');
      const spanWarnings = logs.filter(
        l => l.severity === 'warn' && l.message.includes('span')
      );
      expect(spanWarnings.length).toBe(0);
    });

    it('coerces a unit-suffixed # span (e.g. "6px") to its numeric prefix', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b") extend {
          # dashboard { gap=16 }
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span="6px"
              a_total is a.sum()
              b_total is b.sum()
          }
        }
        query: q is s -> q
      `);
      // numeric() parseFloats "6px" to 6, so the span is treated as 6 and
      // honored with no diagnostic. The coercion lives in malloy-tag's shared
      // numeric(); this test pins the current behavior.
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });
  });

  describe('chart y-channel must be numeric', () => {
    it('errors when # y is on a non-numeric dimension in a bar chart', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 'B' as label, 1 as val") extend {
          # viz=bar
          view: q is {
            group_by:
              cat
              # y
              label
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, "Field 'label' is tagged '# y'");
    });

    it('errors when # y is on a non-numeric dimension in a line chart', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as x_val, 'B' as label, 1 as val") extend {
          # viz=line
          view: q is {
            group_by:
              x_val
              # y
              label
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, "Field 'label' is tagged '# y'");
    });

    it('errors when viz.y references a non-numeric field', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 'B' as label, 1 as val") extend {
          # viz=bar { y=label }
          view: q is {
            group_by: cat, label
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, "y-channel field 'label'");
    });

    it('no error when # y is on a numeric dimension in a bar chart', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 5 as num_dim, 1 as val") extend {
          # viz=bar
          view: q is {
            group_by:
              cat
              # y
              num_dim
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
    });

    it('no error when # y is on a measure in a bar chart', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 1 as val") extend {
          # viz=bar
          view: q is {
            group_by: cat
            aggregate:
              # y
              total is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
    });

    it('no error and no silent mis-render when a numeric dimension tagged # y precedes the intended x dimension', async () => {
      // Regression: when a numeric dimension is tagged # y and appears before
      // the intended x dimension, the implicit-x picker must skip the y-tagged
      // field rather than double-assigning it as both x and y.
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 100 as total_sales, 'A' as brand") extend {
          # viz=bar
          view: q is {
            group_by:
              # y
              total_sales
              brand
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
    });

    it('errors when legacy # bar_chart has # y on a non-numeric dimension', async () => {
      // Legacy # bar_chart { ... } tag must be validated through the same
      // rules as # viz=bar.
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 'B' as label, 1 as val") extend {
          # bar_chart
          view: q is {
            group_by:
              cat
              # y
              label
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, "Field 'label' is tagged '# y'");
    });

    it('errors when legacy # line_chart references a non-numeric y via viz.y', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as x_val, 'B' as label, 1 as val") extend {
          # line_chart { y=label }
          view: q is {
            group_by: x_val, label
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, "y-channel field 'label'");
    });

    it('logs (not throws) when # viz.x references a nonexistent field', async () => {
      // Missing field refs should be reported via validateFieldTags with a
      // source location — the chart must still render rather than replacing
      // itself with a red-box plugin-creation error.
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 1 as val") extend {
          # viz=bar { x=nonexistent }
          view: q is {
            group_by: cat
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, "'nonexistent'");
      // The error must be the validator's, not the wrapped plugin throw.
      const wrapped = logs.filter(l => l.message.includes('Plugin bar failed'));
      expect(wrapped).toHaveLength(0);
    });

    it('logs (not throws) when # viz.y references a nonexistent field on a line chart', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as x_val, 1 as val") extend {
          # viz=line { y=nonexistent }
          view: q is {
            group_by: x_val
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectError(logs, "'nonexistent'");
      const wrapped = logs.filter(l =>
        l.message.includes('Plugin line failed')
      );
      expect(wrapped).toHaveLength(0);
    });

    it('the only dimension being tagged # y leaves no dimension for x (instead of silently using it for both)', async () => {
      // Sharper regression: if the sole dimension is claimed as y, auto-x
      // should skip it and leave xChannel empty. Bar chart then correctly
      // reports that no x dimension is available.
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 100 as total_sales") extend {
          # viz=bar
          view: q is {
            group_by:
              # y
              total_sales
          }
        }
        query: q is s -> q
      `);
      expectError(logs, 'requires a dimension for the x axis');
    });
  });

  describe('no errors for valid tags', () => {
    it('no errors for # currency=usd on a number', async () => {
      const logs = await getValidationLogs(`
        query: q is ${NUM_FIELD} -> {
          select:
            # currency=usd
            val
        }
      `);
      expectNoErrors(logs);
    });

    it('no errors for # link on a string', async () => {
      const logs = await getValidationLogs(`
        query: q is duckdb.sql("SELECT 'http://example.com' as url") -> {
          select:
            # link
            url
        }
      `);
      expectNoErrors(logs);
    });

    it('no errors for # number on a date', async () => {
      const logs = await getValidationLogs(`
        query: q is duckdb.sql("SELECT DATE '2024-01-01' as dt") -> {
          select:
            # number
            dt
        }
      `);
      expectNoErrors(logs);
    });
  });

  describe('owned paths suppress unread warnings', () => {
    it('no warnings for # image with alt.field', async () => {
      const logs = await getValidationLogs(`
        query: q is duckdb.sql("SELECT 'http://img.png' as logo, 'Alt text' as alt_text") -> {
          select:
            # image { alt { field=alt_text } height=32 }
            logo
            alt_text
        }
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for # link with url_template', async () => {
      const logs = await getValidationLogs(`
        query: q is duckdb.sql("SELECT 'hello' as val") -> {
          select:
            # link { url_template='http://example.com/{val}' }
            val
        }
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for # duration=seconds { terse }', async () => {
      const logs = await getValidationLogs(`
        query: q is ${NUM_FIELD} -> {
          select:
            # duration=seconds { terse }
            val
        }
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for # break on dashboard child fields', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b") extend {
          # dashboard
          view: q is {
            group_by: grp is 'all'
            aggregate:
              a_total is a.sum()
              # break
              b_total is b.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for # span, # subtitle, # borderless on dashboard child fields', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b, 3 as c") extend {
          # dashboard { gap=16 }
          view: q is {
            group_by: grp is 'all'
            aggregate:
              # span=6
              # subtitle="Total A"
              a_total is a.sum()
              # borderless
              b_total is b.sum()
              c_total is c.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for # tooltip on chart child fields', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as category, 1 as value, 'hello' as note") extend {
          # viz=bar
          view: q is {
            group_by:
              category
              # tooltip
              note
            aggregate: value is value.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for embedded channel tags on child fields', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b") extend {
          # viz=bar
          view: q is {
            group_by:
              # x
              a
            aggregate:
              # y
              b is count()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for bar chart top-level channel tags', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 'B' as series_val, 1 as val") extend {
          # viz=bar { x=cat y=val series=series_val stack }
          view: q is {
            group_by: cat, series_val
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for bar chart channel settings (independent and limits)', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 'B' as series_val, 1 as val") extend {
          # viz=bar { x.independent=true y.independent=true series.independent=false series.limit=5 x.limit=10 }
          view: q is {
            group_by: cat, series_val
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for bar chart disable_embedded and mode tags', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 1 as val") extend {
          # viz=bar { disable_embedded mode=normal }
          view: q is {
            group_by: cat
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for line chart channel settings and mode', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 1 as val") extend {
          # viz=line { x.independent=true y.independent=true series.independent=false series.limit=5 zero_baseline=true mode=normal disableEmbedded }
          view: q is {
            group_by: cat
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for bar chart legacy bar_chart tag', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 1 as val") extend {
          # bar_chart
          view: q is {
            group_by: cat
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for line chart legacy line_chart tag', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as x_val, 2 as y_val") extend {
          # line_chart
          view: q is {
            group_by: x_val
            aggregate: y_val is y_val.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });

    it('no warnings for chart title and subtitle', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as cat, 1 as val") extend {
          # viz=bar { title="My Chart" subtitle="Some data" }
          view: q is {
            group_by: cat
            aggregate: val is val.sum()
          }
        }
        query: q is s -> q
      `);
      expectNoErrors(logs);
      expectNoWarnings(logs);
    });
  });

  describe('unknown tags produce warnings', () => {
    it('warns on unknown tag # xyzzy', async () => {
      const logs = await getValidationLogs(`
        query: q is ${NUM_FIELD} -> {
          select:
            # xyzzy
            val
        }
      `);
      const warnings = logs.filter(l => l.severity === 'warn');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain('xyzzy');
    });

    it('warns on # break outside dashboard context', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a, 2 as b") extend {
          view: q is {
            aggregate:
              a_total is a.sum()
              # break
              b_total is b.sum()
          }
        }
        query: q is s -> q
      `);
      const warnings = logs.filter(l => l.severity === 'warn');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.message.includes('break'))).toBe(true);
    });

    it('warns on # span outside dashboard context', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 1 as a") extend {
          view: q is {
            aggregate:
              # span=6
              a_total is a.sum()
          }
        }
        query: q is s -> q
      `);
      const warnings = logs.filter(l => l.severity === 'warn');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.message.includes('span'))).toBe(true);
    });

    it('warns on # tooltip outside chart context', async () => {
      const logs = await getValidationLogs(`
        source: s is duckdb.sql("SELECT 'A' as category, 'hello' as note") extend {
          view: q is {
            group_by:
              category
              # tooltip
              note
          }
        }
        query: q is s -> q
      `);
      const warnings = logs.filter(l => l.severity === 'warn');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.message.includes('tooltip'))).toBe(true);
    });
  });
});
