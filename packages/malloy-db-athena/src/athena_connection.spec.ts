/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AtomicTypeDef, FieldDef} from '@malloydata/malloy';
import {AthenaConnection, AthenaExecutor} from '.';

/*
 * Runs against a live engine v3 workgroup named by ATHENA_WORKGROUP (see
 * AthenaExecutor.getConnectionOptionsFromEnv); skipped when it is unset.
 */
const config = AthenaExecutor.getConnectionOptionsFromEnv();
const describeLive = config ? describe : describe.skip;

describeLive('AthenaConnection', () => {
  const athena = new AthenaConnection('athena', config);

  afterAll(async () => {
    await athena.close();
  });

  async function schemaFor(selectStr: string): Promise<FieldDef[]> {
    const res = await athena.fetchSchemaForSQLStruct(
      {selectStr, connection: 'athena'},
      {}
    );
    if (res.error) {
      throw new Error(res.error);
    }
    return res.structDef!.fields;
  }

  function typeOf(fields: FieldDef[], name: string): AtomicTypeDef {
    const field = fields.find(f => f.name === name);
    if (field === undefined) {
      throw new Error(`no field ${name} in ${fields.map(f => f.name)}`);
    }
    const {name: _name, ...typeDef} = field;
    return typeDef as AtomicTypeDef;
  }

  describe('basic connectivity', () => {
    it('runs SELECT 1', async () => {
      const res = await athena.runSQL('SELECT 1 AS t');
      expect(res.rows).toEqual([{t: 1}]);
    });

    it('passes test() on an engine v3 workgroup', async () => {
      await expect(athena.test()).resolves.toBeUndefined();
    });
  });

  describe('schema recognition: atomic types', () => {
    let fields: FieldDef[];
    beforeAll(async () => {
      fields = await schemaFor(`
        SELECT 1 AS i, CAST(1 AS bigint) AS big, 1.5 AS dbl, CAST(1.5 AS real) AS r,
          CAST(1.5 AS decimal(10,2)) AS dec, CAST(1 AS decimal(10)) AS whole,
          'x' AS s, true AS b, DATE '2024-01-02' AS d,
          TIMESTAMP '2024-01-02 03:04:05.678' AS t,
          with_timezone(TIMESTAMP '2024-01-02 03:04:05', 'UTC') AS tz,
          X'01' AS bin`);
    });
    const cases: [string, AtomicTypeDef][] = [
      ['i', {type: 'number', numberType: 'integer'}],
      ['big', {type: 'number', numberType: 'bigint'}],
      ['dbl', {type: 'number', numberType: 'float'}],
      ['r', {type: 'number', numberType: 'float'}],
      ['dec', {type: 'number', numberType: 'float'}],
      // EXPLAIN spells decimal(10) as decimal(10,0), and the shared type
      // parser reads any written scale as a float.
      ['whole', {type: 'number', numberType: 'float'}],
      ['s', {type: 'string'}],
      ['b', {type: 'boolean'}],
      ['d', {type: 'date'}],
      ['t', {type: 'timestamp'}],
      ['tz', {type: 'timestamptz'}],
      ['bin', {type: 'sql native', rawType: 'varbinary'}],
    ];
    for (const [name, expected] of cases) {
      it(`maps ${name} to ${JSON.stringify(expected)}`, () => {
        expect(typeOf(fields, name)).toEqual(expected);
      });
    }
  });

  describe('schema recognition: complex types', () => {
    let fields: FieldDef[];
    beforeAll(async () => {
      fields = await schemaFor(`
        SELECT CAST(ROW(1, 'x') AS ROW(n integer, s varchar)) AS rec,
          ARRAY[1, 2] AS arr,
          ARRAY[CAST(ROW(1, 'x') AS ROW(n integer, s varchar))] AS recs,
          MAP(ARRAY['k'], ARRAY[1]) AS m,
          1 AS "MixedCase"`);
    });

    it('reads a row and an array as sql native, with the type text', () => {
      expect(typeOf(fields, 'rec')).toEqual({
        type: 'sql native',
        rawType: 'row(n integer, s varchar)',
      });
      expect(typeOf(fields, 'arr')).toEqual({
        type: 'sql native',
        rawType: 'array(integer)',
      });
      expect(typeOf(fields, 'recs').type).toBe('sql native');
    });

    it('maps a map to sql native', () => {
      expect(typeOf(fields, 'm').type).toBe('sql native');
    });

    it('keeps the case of a quoted output name', () => {
      expect(fields.map(f => f.name)).toContain('MixedCase');
    });
  });

  describe('schema of a table', () => {
    it('reads columns from information_schema in Trino type spelling', async () => {
      const table = await athena.fetchTableSchema(
        'columns',
        'information_schema.columns'
      );
      expect(table.dialect).toBe('athena');
      expect(typeOf(table.fields, 'column_name')).toEqual({type: 'string'});
      expect(typeOf(table.fields, 'ordinal_position')).toEqual({
        type: 'number',
        numberType: 'bigint',
      });
    });
  });

  describe('data hydration', () => {
    it('reads each scalar kind, a NULL, and a JSON-encoded nest', async () => {
      const res = await athena.runSQL(`
        SELECT 1 AS i, CAST(9007199254740993 AS bigint) AS big, 1.5 AS dbl,
          CAST(1.5 AS decimal(10,2)) AS dec, nan() AS nan, 'x' AS s, true AS b,
          CAST(NULL AS integer) AS z, DATE '2024-01-02' AS d,
          TIMESTAMP '2024-01-02 03:04:05.678' AS t,
          with_timezone(TIMESTAMP '2024-01-02 03:04:05', 'America/Mexico_City') AS tz,
          CAST(ARRAY[CAST(ROW(1, 'a') AS ROW(n integer, s varchar))] AS JSON) AS nest`);
      const row = res.rows[0];
      expect(row['i']).toBe(1);
      expect(row['big']).toBe(9007199254740992);
      expect(row['dbl']).toBe(1.5);
      expect(row['dec']).toBe(1.5);
      expect(row['nan']).toBeNaN();
      expect(row['s']).toBe('x');
      expect(row['b']).toBe(true);
      expect(row['z']).toBeNull();
      expect(row['d']).toBe('2024-01-02');
      expect(row['t']).toEqual(new Date('2024-01-02T03:04:05.678Z'));
      expect(row['tz']).toEqual(new Date('2024-01-02T09:04:05Z'));
      expect(row['nest']).toEqual([{n: 1, s: 'a'}]);
    });

    it('applies rowLimit', async () => {
      const res = await athena.runSQL(
        'SELECT x FROM UNNEST(sequence(1, 2500)) AS t(x) ORDER BY x',
        {rowLimit: 1200}
      );
      expect(res.rows).toHaveLength(1200);
      expect(res.rows[1199]).toEqual({x: 1200});
    });
  });

  describe('errors', () => {
    it('reports a missing table from the schema fetch', async () => {
      await expect(
        athena.fetchTableSchema('nope', 'malloytest.no_such_table_malloy')
      ).rejects.toThrow(
        "Table 'malloytest.no_such_table_malloy' does not exist"
      );
    });

    it('reports a parser rejection of a SQL block as the error string', async () => {
      const res = await athena.fetchSchemaForSQLStruct(
        {selectStr: 'SELEC 1', connection: 'athena'},
        {}
      );
      expect(res.error).toMatch(
        /InvalidRequestException: .*mismatched input 'SELEC'/
      );
    });

    it('throws the engine failure reason from runSQL', async () => {
      await expect(
        athena.runSQL('SELECT * FROM malloytest.no_such_table_malloy')
      ).rejects.toThrow(/TABLE_NOT_FOUND: .*no_such_table_malloy/);
    });
  });

  describe('digest', () => {
    it('is the same for the same configuration and differs by workgroup', () => {
      const same = new AthenaConnection('athena', {...config});
      const other = new AthenaConnection('athena', {
        ...config,
        workGroup: `${config?.workGroup}-other`,
      });
      expect(same.getDigest()).toBe(athena.getDigest());
      expect(other.getDigest()).not.toBe(athena.getDigest());
    });
  });
});
