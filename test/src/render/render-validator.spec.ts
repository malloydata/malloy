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
