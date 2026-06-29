/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  getConnectionTypeDisplayName,
  getConnectionProperties,
  getRegisteredConnectionTypes,
} from '@malloydata/malloy';
import type {TableSourceDef} from '@malloydata/malloy';
import {
  RedshiftConnection,
  PooledRedshiftConnection,
} from './redshift_connection';
import './index';

describe('redshift connection', () => {
  describe('registration', () => {
    it('registers the "redshift" connection type', () => {
      expect(getRegisteredConnectionTypes()).toContain('redshift');
      expect(getConnectionTypeDisplayName('redshift')).toBe('Amazon Redshift');
    });

    it('exposes host/port/credentials connection properties', () => {
      const props = getConnectionProperties('redshift') ?? [];
      const names = props.map(p => p.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'host',
          'port',
          'username',
          'password',
          'databaseName',
          'connectionString',
          'setupSQL',
        ])
      );
    });
  });

  describe('dialect selection', () => {
    it('reports dialectName "redshift"', () => {
      const conn = new RedshiftConnection('mock_redshift');
      expect(conn.dialectName).toBe('redshift');
    });

    it('reports supportsNesting = false', () => {
      const conn = new RedshiftConnection('mock_redshift');
      expect(conn.supportsNesting).toBe(false);
    });
  });

  describe('schema introspection query', () => {
    it('queries svv_columns with no element_types join', async () => {
      const conn = new RedshiftConnection('mock_redshift');
      let capturedSQL = '';
      let capturedValues: unknown[] | undefined;
      jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(conn as any, 'runPostgresQuery')
        .mockImplementation(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async (...args: any[]) => {
            capturedSQL = args[0];
            capturedValues = args[4];
            return {
              rows: [
                {column_name: 'id', data_type: 'integer'},
                {column_name: 'name', data_type: 'character varying'},
                {
                  column_name: 'created',
                  data_type: 'timestamp without time zone',
                },
              ],
              totalRows: 3,
            };
          }
        );

      const schema = (await conn.fetchTableSchema(
        'public.events',
        'public.events'
      )) as TableSourceDef;

      expect(capturedSQL.toLowerCase()).toContain('svv_columns');
      expect(capturedSQL.toLowerCase()).not.toContain('element_types');
      expect(capturedSQL.toLowerCase()).not.toContain(
        'collection_type_identifier'
      );
      expect(capturedValues).toEqual(['events', 'public']);

      expect(schema.dialect).toBe('redshift');
      expect(schema.fields.map(f => f.name)).toEqual(['id', 'name', 'created']);
      const createdField = schema.fields.find(f => f.name === 'created');
      expect(createdField).toMatchObject({type: 'timestamp'});
    });

    it('rejects an unqualified table path', async () => {
      const conn = new RedshiftConnection('mock_redshift');
      const result = await conn.fetchTableSchema('events', 'events');
      expect(typeof result).toBe('string');
      expect(result).toContain('Default schema not yet supported');
    });
  });

  describe('pooled connection parity', () => {
    it('reports redshift dialect and no nesting', () => {
      const conn = new PooledRedshiftConnection('mock_redshift');
      expect(conn.dialectName).toBe('redshift');
      expect(conn.supportsNesting).toBe(false);
    });

    it('introspects via svv_columns with no element_types join', async () => {
      const conn = new PooledRedshiftConnection('mock_redshift');
      let capturedSQL = '';
      jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(conn as any, 'runPostgresQuery')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementation(async (...args: any[]) => {
          capturedSQL = args[0];
          return {
            rows: [{column_name: 'id', data_type: 'integer'}],
            totalRows: 1,
          };
        });

      const schema = (await conn.fetchTableSchema(
        'public.events',
        'public.events'
      )) as TableSourceDef;

      expect(capturedSQL.toLowerCase()).toContain('svv_columns');
      expect(capturedSQL.toLowerCase()).not.toContain('element_types');
      expect(schema.dialect).toBe('redshift');
      expect(schema.fields.map(f => f.name)).toEqual(['id']);
    });
  });

  describe('ssl defaults', () => {
    const readConfig = (conn: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (conn as any).readConfig() as Promise<{
        connectionString?: string;
        host?: string;
      }>;

    it('folds discrete host/port fields into an sslmode=require connection string', async () => {
      const conn = new RedshiftConnection(
        'rs',
        {},
        {
          host: 'my-cluster.redshift.amazonaws.com',
          port: 5439,
          username: 'admin',
          password: 'p@ss/word',
          databaseName: 'dev',
        }
      );
      const config = await readConfig(conn);
      expect(config.host).toBeUndefined();
      expect(config.connectionString).toBe(
        'postgresql://admin:p%40ss%2Fword@my-cluster.redshift.amazonaws.com:5439/dev?sslmode=require'
      );
    });

    it('leaves a user-supplied connectionString untouched', async () => {
      const conn = new RedshiftConnection(
        'rs',
        {},
        {
          connectionString:
            'postgresql://admin:pw@host:5439/dev?sslmode=verify-full',
        }
      );
      const config = await readConfig(conn);
      expect(config.connectionString).toBe(
        'postgresql://admin:pw@host:5439/dev?sslmode=verify-full'
      );
    });

    it('applies the same ssl default to the pooled connection', async () => {
      const conn = new PooledRedshiftConnection(
        'rs',
        {},
        {
          host: 'h.redshift.amazonaws.com',
          port: 5439,
          databaseName: 'dev',
        }
      );
      const config = await readConfig(conn);
      expect(config.connectionString).toBe(
        'postgresql://h.redshift.amazonaws.com:5439/dev?sslmode=require'
      );
    });
  });
});
