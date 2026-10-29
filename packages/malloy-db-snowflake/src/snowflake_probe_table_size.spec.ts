/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {SnowflakeConnection} from './snowflake_connection';
import {SnowflakeExecutor} from './snowflake_executor';

// Unit test for the INFORMATION_SCHEMA.TABLES size probe in
// SnowflakeConnection. The probe used to interpolate decoded
// identifier text into a SQL string literal with hand-rolled ANSI
// quoting (' -> ''). Snowflake also honors backslash escapes in
// string literals, so a decoded segment containing `\` could break
// out of the literal. The fix is to send the values as parameter
// binds. These tests assert that:
//   - the SQL has placeholders, not interpolated literals
//   - the literal text travels in the binds array
//   - the bind values are exactly the decoded identifier text
//   - a backslash-containing decoded segment doesn't end up in SQL
describe('probeTableSize: parameterized literal segments', () => {
  const openConns: SnowflakeConnection[] = [];
  function makeConnAndSpy() {
    const conn = new SnowflakeConnection('snowflake_test', {
      // Minimum non-empty options so the executor doesn't try to
      // read connections.toml from disk. The pool is lazy; we never
      // actually open a connection because tryBatch is stubbed.
      connOptions: {account: 'stub', username: 'stub', password: 'stub'},
      // Pool min=0 so the executor doesn't eagerly try to open a
      // real connection to the stub account. tryBatch is stubbed
      // anyway, so the pool is never used.
      poolOptions: {min: 0, max: 1},
    });
    openConns.push(conn);
    const tryBatch = jest
      .spyOn(SnowflakeExecutor.prototype, 'tryBatch')
      .mockResolvedValue([{RC: 1, BY: 1}]);
    return {conn, tryBatch};
  }

  afterEach(async () => {
    jest.restoreAllMocks();
    // Drain pools so jest doesn't see open handles from background
    // reconnect attempts by snowflake-sdk against the stub account.
    while (openConns.length > 0) {
      const c = openConns.pop()!;
      await c.close().catch(() => {});
    }
  });

  it('sends decoded literals as binds, not as SQL string literals', async () => {
    const {conn, tryBatch} = makeConnAndSpy();
    // Two-part bare name → both segments upper-case in the catalog.
    await (
      conn as unknown as {
        probeTableSize: (t: string) => Promise<unknown>;
      }
    ).probeTableSize('malloytest.aircraft');
    expect(tryBatch).toHaveBeenCalledTimes(1);
    const [sql, , , binds] = tryBatch.mock.calls[0];
    expect(sql).toContain('table_schema = ?');
    expect(sql).toContain('table_name = ?');
    expect(sql).not.toMatch(/'.*MALLOYTEST.*'/);
    expect(binds).toEqual(['MALLOYTEST', 'AIRCRAFT']);
  });

  it('passes a backslash-containing decoded segment verbatim in the bind', async () => {
    // A quoted Snowflake identifier may contain a literal backslash.
    // The old code would put this directly in a string literal and
    // Snowflake would consume the trailing `\'` as an escape,
    // breaking out of the literal. With binds, the backslash never
    // touches the SQL text.
    const {conn, tryBatch} = makeConnAndSpy();
    await (
      conn as unknown as {
        probeTableSize: (t: string) => Promise<unknown>;
      }
    ).probeTableSize('"foo\\".bar');
    expect(tryBatch).toHaveBeenCalledTimes(1);
    const [sql, , , binds] = tryBatch.mock.calls[0];
    expect(sql).not.toContain('\\');
    expect(sql).toContain('table_schema = ?');
    expect(sql).toContain('table_name = ?');
    expect(binds).toEqual(['foo\\', 'BAR']);
  });

  it('qualifies the catalog with the database part when given a three-part name', async () => {
    const {conn, tryBatch} = makeConnAndSpy();
    await (
      conn as unknown as {
        probeTableSize: (t: string) => Promise<unknown>;
      }
    ).probeTableSize('mydb.sch.t');
    const [sql, , , binds] = tryBatch.mock.calls[0];
    expect(sql).toContain('MYDB.information_schema.tables');
    expect(binds).toEqual(['SCH', 'T']);
  });
});
