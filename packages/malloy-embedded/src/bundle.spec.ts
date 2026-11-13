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
  compileModelCatalog(requestJSON: string): string;
  compileQuery(requestJSON: string): string;
  duckdbSchema(columnsJSON: string): string;
}

function loadBare(): {embedded: Embedded; context: vm.Context} {
  if (!fs.existsSync(BUNDLE)) {
    throw new Error(
      `${BUNDLE} is missing; run \`npm run dev\` in packages/malloy-embedded`
    );
  }
  // These tests run the built bundle, so a bundle older than its sources
  // would quietly test old code.
  const built = fs.statSync(BUNDLE).mtimeMs;
  const sources = path.join(__dirname);
  for (const file of fs.readdirSync(sources)) {
    if (file.endsWith('.spec.ts')) continue;
    if (fs.statSync(path.join(sources, file)).mtimeMs > built) {
      throw new Error(
        `${BUNDLE} is older than src/${file}; run \`npm run dev\` in packages/malloy-embedded`
      );
    }
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

// A column's type: a kind, or a whole type for nested columns.
type ColumnType = Malloy.AtomicType['kind'] | Malloy.AtomicType;

const TABLES: Record<string, [string, ColumnType][]> = {
  flights: [
    ['carrier', 'string_type'],
    ['distance', 'number_type'],
  ],
  carriers: [
    ['code', 'string_type'],
    ['nickname', 'string_type'],
  ],
  // Nested columns: an array, and an array of records.
  aircraft: [
    ['tail', 'string_type'],
    ['seats', 'number_type'],
    ['owners', {kind: 'array_type', element_type: {kind: 'string_type'}}],
    [
      'services',
      {
        kind: 'array_type',
        element_type: {
          kind: 'record_type',
          fields: [
            {name: 'shop', type: {kind: 'string_type'}},
            {name: 'hours', type: {kind: 'number_type'}},
          ],
        },
      },
    ],
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
          fields: TABLES[table.name].map(([name, type]) => ({
            kind: 'dimension',
            name,
            type: (typeof type === 'string'
              ? {kind: type}
              : type) as Malloy.AtomicType,
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

  type CatalogResponse = Malloy.CompileModelResponse & {
    catalog?: {
      entries: {
        kind: string;
        name: string;
        description?: string;
        primary_key?: string;
        fields: {
          path: string;
          kind: string;
          type: string;
          grain: string;
          description?: string;
          definition?: string;
          annotations: string[];
          usage: string;
          examples: string[];
        }[];
      }[];
    };
  };

  FILES['file:///models/described.malloy'] = `
    #" Planes
    source: planes is duckdb.table('aircraft') extend {
      primary_key: tail
      measure: plane_count is count()
    }
    #" Flights, one row per flight
    source: described is duckdb.table('flights') extend {
      #" How many flights
      # number="#,###"
      measure: flight_count is count()
      join_many: carrier_rows is duckdb.table('carriers')
        on carrier_rows.code = carrier
      join_one: plane is planes with carrier
      view: by_carrier is { group_by: carrier; aggregate: flight_count }
    }`;

  function catalog() {
    const {response} = runNeedsLoop<CatalogResponse>(
      embedded.compileModelCatalog,
      {model_url: 'file:///models/described.malloy'}
    );
    expect(response.logs ?? []).toEqual([]);
    return response.catalog!;
  }

  test('catalogs sources: descriptions, definitions, joins and grain', () => {
    const entry = catalog().entries.find(e => e.name === 'described');
    expect(entry).toMatchObject({
      description: 'Flights, one row per flight',
    });
    const field = (path: string) => entry?.fields.find(f => f.path === path);
    expect(field('flight_count')).toMatchObject({
      kind: 'measure',
      description: 'How many flights',
      definition: 'count()',
      annotations: ['# number="#,###"'],
      examples: ['aggregate: flight_count'],
    });
    expect(field('carrier_rows')).toMatchObject({
      kind: 'join',
      type: 'join_many',
    });
    expect(field('carrier_rows.nickname')).toMatchObject({
      type: 'string',
      grain: 'carrier_rows',
    });
    expect(field('plane')).toMatchObject({
      kind: 'join',
      type: 'join_one',
      description: 'Planes',
    });
    // Through the join_one, then into nested data in the joined source.
    expect(field('plane.owners')).toMatchObject({type: 'string[]', grain: ''});
    expect(field('plane.owners.each')).toMatchObject({grain: 'plane.owners'});
    expect(field('plane.services')).toMatchObject({
      type: '{shop :: string, hours :: number}[]',
    });
    // `hours` is a reserved word, so the path quotes it.
    expect(field('plane.services.`hours`')).toMatchObject({
      grain: 'plane.services',
    });
    expect(field('plane.plane_count')).toMatchObject({kind: 'measure'});
  });

  test('catalogs parameters, query field descriptions and the model', () => {
    FILES['file:///models/extras.malloy'] = `
      ##" Flights for testing
      ##! experimental.parameters
      source: long_flights(min_distance::number is 100) is duckdb.table('flights') extend {
        where: distance > min_distance
      }
      query: by_carrier is duckdb.table('flights') -> {
        #" The airline
        group_by: carrier
      }`;
    const {response} = runNeedsLoop<CatalogResponse>(
      embedded.compileModelCatalog,
      {model_url: 'file:///models/extras.malloy'}
    );
    expect(response.logs ?? []).toEqual([]);
    const catalog = response.catalog as CatalogResponse['catalog'] & {
      description?: string;
    };
    expect(catalog.description).toBe('Flights for testing');
    const entry = (name: string) =>
      catalog.entries.find(e => e.name === name) as
        | ((typeof catalog.entries)[number] & {parameters?: string[]})
        | undefined;
    expect(entry('long_flights')?.parameters).toEqual([
      'min_distance :: number',
    ]);
    expect(entry('by_carrier')?.fields[0]).toMatchObject({
      path: 'carrier',
      description: 'The airline',
    });
  });

  test('decodes malformed UTF-8 to U+FFFD rather than throwing', () => {
    const {context} = loadBare();
    const decode = (bytes: number[]) =>
      vm.runInContext(
        `new TextDecoder().decode(new Uint8Array(${JSON.stringify(bytes)}))`,
        context
      );
    expect(decode([0xf4, 0x90, 0x80, 0x80])).toBe('\ufffd'); // past U+10FFFF
    expect(decode([0xe0, 0x80, 0xaf])).toBe('\ufffd'); // overlong
    expect(decode([0xed, 0xa0, 0x80])).toBe('\ufffd'); // a surrogate
    expect(decode([0xe2, 0x82, 0xac])).toBe('\u20ac'); // still decodes €
  });

  test('every example in the catalog compiles', () => {
    const failures: string[] = [];
    let compiled = 0;
    for (const entry of catalog().entries) {
      if (entry.kind !== 'source') continue;
      for (const field of entry.fields) {
        for (const example of field.examples) {
          const query = `run: ${entry.name} -> { ${example} }`;
          const {response} = runNeedsLoop<Malloy.CompileQueryResponse>(
            embedded.compileQuery,
            {model_url: 'file:///models/described.malloy', query_malloy: query}
          );
          compiled++;
          if (!response.result) {
            failures.push(
              `${query}: ${response.logs?.map(l => l.message).join('; ')}`
            );
          }
        }
      }
    }
    expect(failures).toEqual([]);
    expect(compiled).toBeGreaterThan(20);
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
