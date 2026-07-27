/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {BaseConnection} from './connection/base_connection';
import type {SQLSourceRequest} from './lang/translate-response';
import type {
  MalloyQueryData,
  SQLSourceDef,
  TableSourceDef,
} from './model/malloy_types';
import type {QueryMetadata} from './query_metadata';
import {queryMetadataProblems, validateQueryMetadata} from './query_metadata';

describe('queryMetadataProblems / validateQueryMetadata', () => {
  it('accepts a conforming bag (mixed case allowed)', () => {
    const meta = {
      CostCenter: 'Eng',
      team_name: 'finance',
      application_name: 'My-App',
    };
    expect(queryMetadataProblems(meta)).toEqual([]);
    expect(() => validateQueryMetadata(meta)).not.toThrow();
  });

  it('accepts an empty bag', () => {
    expect(queryMetadataProblems({})).toEqual([]);
  });

  it('rejects property names outside [A-Za-z0-9_]', () => {
    expect(queryMetadataProblems({'team.name': 'v'})).toHaveLength(1);
    expect(queryMetadataProblems({'a-b': 'v'})).toHaveLength(1);
    expect(() => validateQueryMetadata({'a b': 'v'})).toThrow(
      /Invalid query metadata/
    );
  });

  it('rejects values with a double-quote or non-printable-ASCII', () => {
    expect(queryMetadataProblems({k: 'a"b'})).toHaveLength(1);
    expect(queryMetadataProblems({k: 'a\nb'})).toHaveLength(1);
    expect(queryMetadataProblems({k: 'a\r'})).toHaveLength(1);
    expect(queryMetadataProblems({k: 'say "hi"'})).toHaveLength(1);
  });

  it('rejects over-long values and too many properties', () => {
    expect(queryMetadataProblems({k: 'x'.repeat(300)})).toHaveLength(1);
    const many: Record<string, string> = {};
    for (let i = 0; i < 100; i++) many[`k${i}`] = 'v';
    expect(queryMetadataProblems(many)).not.toHaveLength(0);
  });
});

/**
 * The bag-applying helpers are protected on BaseConnection — a connector
 * inherits them, they are not public API. Republish them to test them.
 */
class MetadataConnection extends BaseConnection {
  get name() {
    return 'test';
  }
  get dialectName() {
    return 'standardsql';
  }
  getDigest() {
    return 'test';
  }
  async runSQL(): Promise<MalloyQueryData> {
    return {rows: [], totalRows: 0};
  }
  async fetchTableSchema(): Promise<TableSourceDef | string> {
    return 'no schemas here';
  }
  async fetchSelectSchema(
    _sqlSource: SQLSourceRequest
  ): Promise<SQLSourceDef | string> {
    return 'no schemas here';
  }

  bag(meta: QueryMetadata | undefined) {
    return this.queryMetadataBag(meta);
  }
  comment(meta: QueryMetadata | undefined) {
    return this.queryMetadataComment(meta);
  }
  withMetadata(sql: string, meta: QueryMetadata | undefined) {
    return this.sqlWithQueryMetadata(sql, meta);
  }
}

const conn = new MetadataConnection();

describe('queryMetadataBag', () => {
  it('returns the bag when non-empty', () => {
    expect(conn.bag({team: 'fin'})).toEqual({team: 'fin'});
  });

  it('returns undefined for an absent or empty bag', () => {
    expect(conn.bag(undefined)).toBeUndefined();
    expect(conn.bag({})).toBeUndefined();
  });

  it('throws on an invalid bag', () => {
    expect(() => conn.bag({'bad key': 'v'})).toThrow();
  });
});

describe('queryMetadataComment', () => {
  it('serializes to a single leading comment line', () => {
    expect(conn.comment({env: 'prod', application_name: 'app'})).toBe(
      '-- env="prod" application_name="app"\n'
    );
  });

  it('returns the empty string for an absent or empty bag', () => {
    expect(conn.comment(undefined)).toBe('');
    expect(conn.comment({})).toBe('');
  });

  it('throws on an invalid bag rather than emitting an unsafe comment', () => {
    expect(() => conn.comment({k: 'a"b'})).toThrow();
  });
});

describe('sqlWithQueryMetadata', () => {
  it('prepends the comment when metadata is present', () => {
    expect(conn.withMetadata('SELECT 1', {env: 'prod'})).toBe(
      '-- env="prod"\nSELECT 1'
    );
  });

  it('returns the sql unchanged for absent or empty metadata', () => {
    expect(conn.withMetadata('SELECT 1', undefined)).toBe('SELECT 1');
    expect(conn.withMetadata('SELECT 1', {})).toBe('SELECT 1');
  });
});
