/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MySQLConnection, MySQLExecutor} from '.';
import {createTestRuntime, mkTestModel} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';

const config = MySQLExecutor.getConnectionOptionsFromEnv();
const hasCredentials = !!config.user;

const describeMySQL = hasCredentials ? describe : describe.skip;

describeMySQL('db:MySQL', () => {
  const connection = new MySQLConnection('mysql', config, {});

  afterAll(async () => {
    await connection.close();
  });

  it('runs a SQL query', async () => {
    const res = await connection.runSQL('SELECT 1 as t');
    expect(res.rows[0]['t']).toBe(1);
  });

  it('fetches schema for SQL block', async () => {
    const res = await connection.fetchSchemaForSQLStruct(
      {
        selectStr: 'SELECT 1 as one',
        connection: 'mysql',
      },
      {}
    );
    expect(res.structDef?.fields[0].name).toBe('one');
  });

  it('maps integer types correctly', async () => {
    const res = await connection.fetchSchemaForSQLStruct(
      {
        selectStr: `
          SELECT
            CAST(1 AS SIGNED) as signed_int,
            CAST(2 AS UNSIGNED) as unsigned_int
        `,
        connection: 'mysql',
      },
      {}
    );
    expect(res.structDef?.fields[0]).toEqual({
      name: 'signed_int',
      type: 'number',
      numberType: 'bigint',
    });
  });

  it('fetches schema for tables whose names contain dashes', async () => {
    // fetchSchemaForTables expects canonical SQL (post-translator), so
    // we pass the backtick-quoted form directly.
    await connection.runRawSQL('DROP TABLE IF EXISTS `arrests-latest`');
    await connection.runRawSQL(
      'CREATE TABLE `arrests-latest` (id INT, name VARCHAR(50))'
    );
    try {
      const res = await connection.fetchSchemaForTables(
        {dashed: '`arrests-latest`'},
        {}
      );
      expect(res.errors).toEqual({});
      const fields = res.schemas['dashed']?.fields ?? [];
      expect(fields.map(f => f.name).sort()).toEqual(['id', 'name']);
    } finally {
      await connection.runRawSQL('DROP TABLE `arrests-latest`');
    }
  });

  // The unit spec (packages/malloy/src/dialect/mysql/mysql_types.spec.ts)
  // pins what each reported spelling means. This pins that these are the
  // spellings a live server reports -- including the ones MySQL rewrites on
  // the way in, which is why the declared and reported columns differ here.
  //
  // Declared columns are the point, so this is the one case a SELECT cannot
  // stand in for. The table is TEMPORARY, which scopes it to this connection
  // and leaves parallel workers alone.
  it('reads the declared types a live server reports', async () => {
    await connection.runRawSQL('DROP TEMPORARY TABLE IF EXISTS type_survey');
    await connection.runRawSQL(`CREATE TEMPORARY TABLE type_survey (
      c_tinyint    TINYINT,
      c_boolean    BOOLEAN,
      c_tinyint_u  TINYINT UNSIGNED,
      c_int_u      INT UNSIGNED,
      c_bigint_u   BIGINT UNSIGNED,
      c_serial     SERIAL,
      c_float      FLOAT,
      c_real       REAL,
      c_dec_scaled DECIMAL(10,2),
      c_dec_small  DECIMAL(15,0),
      c_dec_big    DECIMAL(16,0),
      c_longtext   LONGTEXT,
      c_mediumtext MEDIUMTEXT,
      c_tinytext   TINYTEXT,
      c_varbinary  VARBINARY(20),
      c_enum       ENUM('a','b'),
      c_year       YEAR
    )`);
    try {
      const res = await connection.fetchSchemaForTables({t: 'type_survey'}, {});
      expect(res.errors).toEqual({});
      const byName = Object.fromEntries(
        (res.schemas['t']?.fields ?? []).map(f => [f.name, f])
      );
      const num = (numberType: string) => ({type: 'number', numberType});
      expect(byName).toMatchObject({
        // TINYINT is not a boolean: BOOLEAN is only a spelling of TINYINT(1),
        // the (1) is a display width, and the column accepts 42.
        'c_tinyint': num('integer'),
        'c_boolean': num('integer'),
        // `unsigned` never changes the Malloy type.
        'c_tinyint_u': num('integer'),
        'c_int_u': num('integer'),
        'c_bigint_u': num('bigint'),
        'c_serial': num('bigint'),
        // REAL is reported as double; FLOAT is its own spelling.
        'c_float': num('float'),
        'c_real': num('float'),
        // Scale decides float vs exact; precision decides whether an exact
        // value survives a JS double.
        'c_dec_scaled': num('float'),
        'c_dec_small': num('integer'),
        'c_dec_big': num('bigint'),
        'c_longtext': {type: 'string'},
        'c_mediumtext': {type: 'string'},
        'c_tinytext': {type: 'string'},
        // Deliberately opaque.
        'c_varbinary': {type: 'sql native', rawType: 'varbinary'},
        'c_enum': {type: 'sql native', rawType: 'enum'},
        'c_year': {type: 'sql native', rawType: 'year'},
      });
    } finally {
      await connection.runRawSQL('DROP TEMPORARY TABLE type_survey');
    }
  });
});

/**
 * Tests for reading numeric values through Malloy queries
 */
describeMySQL('numeric value reading', () => {
  const connection = new MySQLConnection('mysql_numeric_tests', config, {});
  const runtime = createTestRuntime(connection);
  const testModel = mkTestModel(runtime, {});

  afterAll(async () => {
    await connection.close();
  });

  const half = BigInt('9007199254740993'); // 2^53 + 1

  describe('integer types', () => {
    // MySQL infers int for values <= 2^31-1, bigint for larger
    it('reads int correctly', async () => {
      await expect('run: mysql.sql("SELECT 2147483647 as d")').toMatchResult(
        testModel,
        {d: 2147483647}
      );
    });

    it('reads bigint correctly', async () => {
      await expect('run: mysql.sql("SELECT 2147483648 as d")').toMatchResult(
        testModel,
        {d: 2147483648}
      );
    });

    it('preserves precision for literal integers > 2^53', async () => {
      const largeInt = BigInt('9007199254740993'); // 2^53 + 1
      await expect(`
        run: mysql.sql("select 1") -> { select: d is ${largeInt} }
      `).toMatchResult(testModel, {d: largeInt});
    });

    // MySQL returns SUM() of an integer column as a DECIMAL, so a sum is not
    // covered by supportBigNumbers the way the column itself is.
    it('preserves precision when summing above 2^53', async () => {
      await expect(`
        run: mysql.sql("""
          SELECT CAST(${half} AS SIGNED) as v
          UNION ALL SELECT CAST(${half} AS SIGNED)
        """) -> { aggregate: s is v.sum() }
      `).toMatchResult(testModel, {s: half * BigInt(2)});
    });

    // A sum across a join_many is computed symmetrically, in a fixed-point
    // domain wide enough to hold the join key's hash -- DECIMAL(55,10). Its
    // result therefore carries a ten-place fraction that BigInt() rejects
    // unless the driver strips it.
    it('preserves precision when summing above 2^53 across a join', async () => {
      await expect(`
        run: mysql.sql("""
          SELECT 1 as id, CAST(${half} AS SIGNED) as v
          UNION ALL SELECT 2, CAST(${half} AS SIGNED)
        """) extend {
          join_many: kid is mysql.sql("""
            SELECT 1 as parent_id
            UNION ALL SELECT 1
            UNION ALL SELECT 1
            UNION ALL SELECT 2
            UNION ALL SELECT 2
          """) on id = kid.parent_id
        } -> {
          aggregate: s is v.sum()
          // Referencing the join is what keeps it from being elided, which is
          // what makes the sum symmetric.
          aggregate: kids is kid.count()
        }
      `).toMatchResult(testModel, {s: half * BigInt(2), kids: 5});
    });
  });

  describe('float types', () => {
    it.each(['FLOAT', 'DOUBLE', 'DECIMAL(10,2)'])(
      'reads %s correctly',
      async sqlType => {
        await expect(
          `run: mysql.sql("SELECT CAST(10.5 AS ${sqlType}) as f")`
        ).toMatchResult(testModel, {f: 10.5});
      }
    );
  });
});
