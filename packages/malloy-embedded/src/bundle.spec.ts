/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import type * as Malloy from '@malloydata/malloy-interfaces';

// Tests the built artifact, not the sources: the point is that the bundle
// runs in an engine offering nothing but the ECMAScript built-ins. A fresh
// vm context is exactly that (no process, require, Buffer, URL, TextEncoder,
// crypto, performance, console) once Intl is removed, which embedded engines
// such as QuickJS also lack.
const BUNDLE = path.join(__dirname, '../dist/malloy-embedded.js');

interface Embedded {
  version: string;
  compileModel(requestJSON: string): string;
  compileModelContents(requestJSON: string): string;
  compileQuery(requestJSON: string): string;
  duckdbSchema(columnsJSON: string): string;
}

function loadBare(): {embedded: Embedded; context: vm.Context} {
  if (!fs.existsSync(BUNDLE)) {
    throw new Error(
      `${BUNDLE} is missing; run \`npm run dev\` in packages/malloy-embedded`
    );
  }
  const context = vm.createContext({});
  vm.runInContext('delete globalThis.Intl;', context);
  vm.runInContext(fs.readFileSync(BUNDLE, 'utf8'), context, {
    filename: BUNDLE,
  });
  return {embedded: context['malloyEmbedded'], context};
}

// A stand-in for the host (a DuckDB extension, say): it owns the files and
// the catalog, and answers whatever the compiler says it needs.
const FILES: Record<string, string> = {
  'file:///models/flights.malloy': `
    import 'carriers.malloy'
    source: flights is duckdb.table('flights') extend {
      join_one: carriers with carrier
      measure: flight_count is count()
      view: by_carrier is {
        group_by: carriers.nickname
        aggregate: flight_count
      }
    }`,
  'file:///models/carriers.malloy': `
    source: carriers is duckdb.table('carriers') extend {
      primary_key: code
    }`,
};

const TABLES: Record<string, [string, Malloy.AtomicType['kind']][]> = {
  flights: [
    ['carrier', 'string_type'],
    ['distance', 'number_type'],
  ],
  carriers: [
    ['code', 'string_type'],
    ['nickname', 'string_type'],
  ],
};

type CompileResponse = {
  compiler_needs?: Malloy.CompilerNeeds;
  logs?: Malloy.LogMessage[];
};

function runNeedsLoop<T extends CompileResponse>(
  compile: (requestJSON: string) => string,
  request: object
): {response: T; rounds: number} {
  const needs: Malloy.CompilerNeeds = {
    connections: [{name: 'duckdb', dialect: 'duckdb'}],
    files: [],
    table_schemas: [],
  };
  for (let rounds = 0; rounds < 10; rounds++) {
    const response = JSON.parse(
      compile(JSON.stringify({...request, compiler_needs: needs}))
    ) as T;
    const asked = response.compiler_needs;
    if (!asked || response.logs?.some(l => l.severity === 'error')) {
      return {response, rounds};
    }
    for (const file of asked.files ?? []) {
      needs.files!.push({url: file.url, contents: FILES[file.url]});
    }
    for (const table of asked.table_schemas ?? []) {
      needs.table_schemas!.push({
        ...table,
        schema: {
          fields: TABLES[table.name].map(([name, kind]) => ({
            kind: 'dimension',
            name,
            type: {kind} as Malloy.AtomicType,
          })),
        },
      });
    }
  }
  throw new Error('compiler kept asking for more');
}

describe('malloy-embedded bundle', () => {
  const {embedded, context} = loadBare();

  test('loads without defining a global process', () => {
    expect(typeof embedded.compileQuery).toBe('function');
    expect(embedded.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(vm.runInContext('typeof process', context)).toBe('undefined');
  });

  test('compiles a query against a model, resolving imports and tables', () => {
    const {response, rounds} = runNeedsLoop<Malloy.CompileQueryResponse>(
      embedded.compileQuery,
      {
        model_url: 'file:///models/flights.malloy',
        query_malloy:
          'run: flights -> by_carrier + { where: distance > 100; limit: 3 }',
      }
    );
    expect(response.logs ?? []).toEqual([]);
    expect(rounds).toBeGreaterThan(0);
    const sql = response.result?.sql ?? '';
    expect(sql).toContain('FROM flights as base');
    expect(sql).toContain('LEFT JOIN carriers');
    expect(sql).toContain('base."distance">100');
    expect(sql).toContain('LIMIT 3');
  });

  test('compiles a model', () => {
    const {response} = runNeedsLoop<Malloy.CompileModelResponse>(
      embedded.compileModel,
      {model_url: 'file:///models/flights.malloy'}
    );
    expect(response.logs ?? []).toEqual([]);
    // Imported sources are visible inside the model but not exported from it.
    expect(response.model?.entries.map(e => e.name)).toEqual(['flights']);
  });

  test('lists imported sources and named queries', () => {
    FILES['file:///models/with_query.malloy'] = `
      import 'flights.malloy'
      query: top is flights -> by_carrier`;
    const {response} = runNeedsLoop<Malloy.CompileModelResponse>(
      embedded.compileModelContents,
      {model_url: 'file:///models/with_query.malloy'}
    );
    expect(response.logs ?? []).toEqual([]);
    // flights is imported, so compileModel would not list it. carriers is
    // not visible here at all: flights.malloy imports it but does not export it.
    const entries = response.model?.entries.map(e => [e.kind, e.name]);
    expect(entries).toEqual([
      ['source', 'flights'],
      ['query', 'top'],
    ]);
    const flights = response.model?.entries.find(e => e.name === 'flights');
    const fieldKinds = flights?.schema.fields.map(f => [f.kind, f.name]);
    expect(fieldKinds).toEqual(
      expect.arrayContaining([
        ['dimension', 'carrier'],
        ['measure', 'flight_count'],
        ['join', 'carriers'],
        ['view', 'by_carrier'],
      ])
    );
  });

  test('turns DuckDB column types into a schema, nested types included', () => {
    const schema: Malloy.Schema = JSON.parse(
      embedded.duckdbSchema(
        JSON.stringify([
          ['genres', 'VARCHAR[]'],
          ['people', 'STRUCT(name VARCHAR, "job title" VARCHAR)[]'],
          ['n', 'BIGINT'],
        ])
      )
    );
    expect(schema.fields).toEqual([
      {
        kind: 'dimension',
        name: 'genres',
        type: {kind: 'array_type', element_type: {kind: 'string_type'}},
      },
      {
        kind: 'dimension',
        name: 'people',
        type: {
          kind: 'array_type',
          element_type: {
            kind: 'record_type',
            fields: [
              {name: 'name', type: {kind: 'string_type'}},
              {name: 'job title', type: {kind: 'string_type'}},
            ],
          },
        },
      },
      {
        kind: 'dimension',
        name: 'n',
        type: {kind: 'number_type', subtype: 'bigint'},
      },
    ]);
  });

  test('reports translation errors as logs', () => {
    const {response} = runNeedsLoop<Malloy.CompileQueryResponse>(
      embedded.compileQuery,
      {
        model_url: 'file:///models/flights.malloy',
        query_malloy: 'run: flights -> no_such_view',
      }
    );
    expect(response.result).toBeUndefined();
    expect(response.logs?.[0]?.severity).toBe('error');
  });

  test('returns bad requests as logs instead of throwing', () => {
    const response = JSON.parse(embedded.compileQuery('{not json'));
    expect(response.logs[0].severity).toBe('error');
  });
});
