/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AtomicTypeDef,
  FieldDef,
  RunSQLOptions,
  StructDef,
} from '@malloydata/malloy';
import type {BaseRunner} from '.';
import {TrinoConnection, TrinoExecutor, TrinoPrestoConnection} from '.';
import {PrestoConnection, PrestoRunner, TrinoRunner} from './trino_connection';

// array(varchar) is array
const ARRAY_SCHEMA = 'array(integer)';

// row(...) is inline
const INLINE_SCHEMA = 'row(a double, b integer, c varchar(60))';

// array(row(....)) is nested
const NESTED_SCHEMA = 'array(row(a double, b integer, c varchar(60)))';

// array(row(..., array(row(....)))) is deeply nested
const DEEP_SCHEMA =
  'array(row(a double, b array(row(c integer, d varchar(60)))))';

const intType: AtomicTypeDef = {type: 'number', numberType: 'integer'};
const doubleType: AtomicTypeDef = {type: 'number', numberType: 'float'};
const stringType: AtomicTypeDef = {type: 'string'};
const recordSchema: FieldDef[] = [
  {name: 'a', ...doubleType},
  {name: 'b', ...intType},
  {name: 'c', ...stringType},
];

class TestTrinoConnection extends TrinoPrestoConnection {
  protected async fillStructDefForSqlBlockSchema(
    _sql: string,
    _structDef: StructDef
  ): Promise<void> {}
}

describe('Trino rowLimit', () => {
  it.each([
    ['configured value', undefined, 25],
    ['per-run override', 5, 5],
    ['zero', 0, 0],
  ])('passes %s to the runner', async (_name, perRunRowLimit, expected) => {
    let receivedOptions: RunSQLOptions | undefined;
    const runner: BaseRunner = {
      runSQL: jest.fn(async (_sql, options) => {
        receivedOptions = options;
        return {rows: [], columns: []};
      }),
    };
    const connection = new TestTrinoConnection('trino', runner, {rowLimit: 25});
    const options =
      perRunRowLimit === undefined ? {} : {rowLimit: perRunRowLimit};

    await connection.runSQL('SELECT 1', options);

    expect(receivedOptions?.rowLimit).toBe(expected);
  });

  it('cancels the Trino query when the limit stops pagination', async () => {
    const runner = new TrinoRunner({});
    const cancel = jest.fn(async () => ({}));
    const query = jest.fn(async () => ({
      next: jest.fn(async () => ({
        done: false,
        value: {
          id: 'query-id',
          nextUri: 'https://trino.test/next',
          columns: [{name: 'value', type: 'integer'}],
          data: [[1], [2]],
        },
      })),
    }));
    (
      runner as unknown as {
        client: {query: typeof query; cancel: typeof cancel};
      }
    ).client = {query, cancel};

    const result = await runner.runSQL('SELECT value', {rowLimit: 1});

    expect(result.rows).toEqual([[1]]);
    expect(cancel).toHaveBeenCalledWith('query-id');
  });

  it('does not cancel a completed Trino result page', async () => {
    const runner = new TrinoRunner({});
    const cancel = jest.fn(async () => ({}));
    const query = jest.fn(async () => ({
      next: jest.fn(async () => ({
        done: false,
        value: {
          id: 'query-id',
          columns: [{name: 'value', type: 'integer'}],
          data: [[1], [2]],
        },
      })),
    }));
    (
      runner as unknown as {
        client: {query: typeof query; cancel: typeof cancel};
      }
    ).client = {query, cancel};

    const result = await runner.runSQL('SELECT value', {rowLimit: 1});

    expect(result.rows).toEqual([[1]]);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('slices Presto results without wrapping the SQL', async () => {
    const runner = new PrestoRunner({});
    const query = jest.fn(async () => ({
      columns: [{name: 'value', type: 'integer'}],
      data: [[1], [2]],
    }));
    (runner as unknown as {client: {query: typeof query}}).client = {query};

    const result = await runner.runSQL('EXPLAIN SELECT 1', {rowLimit: 0});

    expect(query).toHaveBeenCalledWith('EXPLAIN SELECT 1');
    expect(result.rows).toEqual([]);
  });

  it('lets Presto schema discovery bypass a configured zero limit', async () => {
    class SchemaTestPrestoConnection extends PrestoConnection {
      receivedOptions: RunSQLOptions | undefined;

      override async runSQL(_sql: string, options: RunSQLOptions = {}) {
        this.receivedOptions = options;
        return {rows: [{'Query Plan': 'unused'}], totalRows: 1};
      }

      fill(sql: string, structDef: StructDef) {
        return this.fillStructDefForSqlBlockSchema(sql, structDef);
      }
    }

    const connection = new SchemaTestPrestoConnection(
      'presto',
      {rowLimit: 0},
      {}
    );
    const schemaFromExplain = jest
      .spyOn(PrestoConnection, 'schemaFromExplain')
      .mockImplementation(() => undefined);

    try {
      await connection.fill('SELECT 1', {} as StructDef);
      expect(connection.receivedOptions).toEqual({rowLimit: 1});
    } finally {
      schemaFromExplain.mockRestore();
    }
  });
});

describe('Trino connection', () => {
  let connection: TrinoConnection;

  beforeAll(() => {
    connection = new TrinoConnection(
      'trino',
      {},
      TrinoExecutor.getConnectionOptionsFromEnv('trino')
    );
  });

  afterAll(() => {
    connection.close();
  });

  describe('schema parser', () => {
    it('parses arrays', () => {
      expect(connection.malloyTypeFromTrinoType(ARRAY_SCHEMA)).toEqual({
        type: 'array',
        elementTypeDef: intType,
      });
    });

    it('parses inline', () => {
      expect(connection.malloyTypeFromTrinoType(INLINE_SCHEMA)).toEqual({
        'type': 'record',
        'fields': recordSchema,
      });
    });

    it('parses nested', () => {
      expect(connection.malloyTypeFromTrinoType(NESTED_SCHEMA)).toEqual({
        'type': 'array',
        'elementTypeDef': {type: 'record_element'},
        'fields': recordSchema,
      });
    });

    it('parses a simple type', () => {
      expect(connection.malloyTypeFromTrinoType('varchar(60)')).toEqual(
        stringType
      );
    });

    it('parses a decimal integer type', () => {
      expect(connection.malloyTypeFromTrinoType('decimal(10)')).toEqual({
        type: 'number',
        numberType: 'integer',
      });
    });

    it('parses a decimal float type', () => {
      expect(connection.malloyTypeFromTrinoType('decimal(10,10)')).toEqual({
        type: 'number',
        numberType: 'float',
      });
    });

    it('parses row with timestamp(3)', () => {
      expect(
        connection.malloyTypeFromTrinoType('row(la_time timestamp(3))')
      ).toEqual({
        type: 'record',
        fields: [{name: 'la_time', type: 'timestamp'}],
      });
    });

    it('parses timestamp with time zone', () => {
      expect(
        connection.malloyTypeFromTrinoType('timestamp(3) with time zone)')
      ).toEqual({type: 'timestamptz'});
    });

    it('parses deep nesting', () => {
      expect(connection.malloyTypeFromTrinoType(DEEP_SCHEMA)).toEqual({
        'type': 'array',
        'elementTypeDef': {type: 'record_element'},
        'fields': [
          {'name': 'a', ...doubleType},
          {
            'name': 'b',
            'type': 'array',
            'elementTypeDef': {type: 'record_element'},
            'join': 'many',
            'fields': [
              {'name': 'c', ...intType},
              {'name': 'd', ...stringType},
            ],
          },
        ],
      });
    });

    describe('integer type mappings', () => {
      it('maps integer to integer', () => {
        expect(connection.malloyTypeFromTrinoType('integer')).toEqual({
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps smallint to integer', () => {
        expect(connection.malloyTypeFromTrinoType('smallint')).toEqual({
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps tinyint to integer', () => {
        expect(connection.malloyTypeFromTrinoType('tinyint')).toEqual({
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps bigint to bigint', () => {
        expect(connection.malloyTypeFromTrinoType('bigint')).toEqual({
          type: 'number',
          numberType: 'bigint',
        });
      });
    });
  });
});
