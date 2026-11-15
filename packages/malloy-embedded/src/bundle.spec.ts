/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import type {MalloyEmbedded} from './index';

// Tests the built artifact, not the sources: the point is that the bundle
// runs in an engine offering nothing but the ECMAScript built-ins. A fresh
// vm context is exactly that (no process, require, Buffer, URL, TextEncoder,
// crypto, performance, console, setTimeout) once Intl is removed, which
// embedded engines such as QuickJS also lack.
const BUNDLE = path.join(__dirname, '../dist/malloy-embedded.js');

function loadBare(): {embedded: MalloyEmbedded; context: vm.Context} {
  if (!fs.existsSync(BUNDLE)) {
    throw new Error(
      `${BUNDLE} is missing; run \`npm run dev\` in packages/malloy-embedded`
    );
  }
  // These tests run the built bundle, so a bundle older than its sources
  // would quietly test old code.
  const built = fs.statSync(BUNDLE).mtimeMs;
  for (const file of fs.readdirSync(__dirname)) {
    if (file.endsWith('.spec.ts')) continue;
    if (fs.statSync(path.join(__dirname, file)).mtimeMs > built) {
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

// A stand-in for the host (a DuckDB extension, say): it owns the files, and
// its database answers DESCRIBE.
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

// URLs are made with the bundle's own URL class, as code running inside the
// engine would: Runtime tells a URL from Malloy text with `instanceof URL`.
function makeHost(embedded: MalloyEmbedded, context: vm.Context) {
  const EngineURL: typeof URL = context['URL'];
  const tables: Record<string, [string, string][]> = {
    flights: [
      ['carrier', 'VARCHAR'],
      ['distance', 'INTEGER'],
    ],
    carriers: [
      ['code', 'VARCHAR'],
      ['nickname', 'VARCHAR'],
    ],
    events: [['ts', 'TIMESTAMP']],
  };
  const asked: string[] = [];
  const connection = new embedded.duckdb.HostDuckDBConnection('duckdb', {
    query(sql) {
      asked.push(sql);
      const table = /^DESCRIBE SELECT \* FROM (\w+)$/.exec(sql)?.[1];
      if (!table || !tables[table]) {
        throw new Error(`Catalog Error: cannot run ${sql}`);
      }
      return tables[table].map(([column_name, column_type]) => ({
        column_name,
        column_type,
      }));
    },
  });
  const runtime = new embedded.malloy.Runtime({
    connection,
    urlReader: {
      readURL: async (url: URL) => FILES[url.toString()],
    },
  });
  const flights = (options?: {refreshSchemaCache?: boolean}) =>
    runtime.loadModel(new EngineURL('file:///models/flights.malloy'), options);
  return {tables, asked, runtime, flights};
}

describe('malloy-embedded bundle', () => {
  const {embedded, context} = loadBare();

  test('loads as the packages, without defining a global process', () => {
    expect(embedded.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof embedded.malloy.Runtime).toBe('function');
    expect(typeof embedded.interfaces.queryToMalloy).toBe('function');
    expect(vm.runInContext('typeof process', context)).toBe('undefined');
  });

  test('a Runtime compiles through imports and a join, with no timers', async () => {
    const {asked, flights} = makeHost(embedded, context);
    const sql = await flights()
      .loadQuery('run: flights -> by_carrier')
      .getSQL();
    expect(sql).toContain('LEFT JOIN carriers AS carriers_0');
    expect(asked.sort()).toEqual([
      'DESCRIBE SELECT * FROM carriers',
      'DESCRIBE SELECT * FROM flights',
    ]);
  });

  test('refreshSchemaCache sees a table the host changed', async () => {
    const {tables, flights} = makeHost(embedded, context);
    await flights().getModel();
    tables['flights'].push(['origin', 'VARCHAR']);
    // The table's schema belongs to the model, so the refresh goes there.
    const sql = await flights({refreshSchemaCache: true})
      .loadQuery('run: flights -> { group_by: origin }')
      .getSQL();
    expect(sql).toContain('base."origin"');
  });

  test('an error in extendModel text is located in that text', async () => {
    const {flights} = makeHost(embedded, context);
    const extended = flights().extendModel(
      'source: f2 is flights extend {\n  dimension: x is nope + 1\n}'
    );
    await expect(extended.getModel()).rejects.toMatchObject({
      problems: [
        expect.objectContaining({
          message: "'nope' is not defined",
          at: expect.objectContaining({
            url: expect.stringMatching(/^internal:\/\/extendModel\//),
            range: expect.objectContaining({
              start: {line: 1, character: 18},
            }),
          }),
        }),
      ],
    });
  });

  test('compiles time literals and filters without Intl', async () => {
    const {flights} = makeHost(embedded, context);
    const sqlOf = (query: string) => flights().loadQuery(query).getSQL();
    expect(
      await sqlOf(
        "run: duckdb.table('events') -> { where: ts ? @2003-02; aggregate: n is count() }"
      )
    ).toContain(
      '(base."ts">=TIMESTAMP \'2003-02-01 00:00:00\') and (base."ts"<TIMESTAMP \'2003-03-01 00:00:00\')'
    );
    expect(
      await sqlOf(
        "run: duckdb.table('events') -> { where: ts ~ f'2003-01 to 2003-03'; aggregate: n is count() }"
      )
    ).toContain("TIMESTAMP '2003-03-01 00:00:00'");
  });

  test("the Intl fallback refuses what it can't answer", () => {
    expect(
      vm.runInContext(
        "new Intl.DateTimeFormat('en', {timeZone: 'UTC'}).resolvedOptions().timeZone",
        context
      )
    ).toBe('UTC');
    expect(() =>
      vm.runInContext(
        "new Intl.DateTimeFormat('en', {timeZone: 'America/Los_Angeles'})",
        context
      )
    ).toThrow(/time zone/);
  });

  test('decodes malformed UTF-8 to U+FFFD rather than throwing', () => {
    const decode = (bytes: number[]) =>
      vm.runInContext(
        `new TextDecoder().decode(new Uint8Array(${JSON.stringify(bytes)}))`,
        context
      );
    expect(decode([0xf4, 0x90, 0x80, 0x80])).toBe('�'); // past U+10FFFF
    expect(decode([0xe0, 0x80, 0xaf])).toBe('�'); // overlong
    expect(decode([0xed, 0xa0, 0x80])).toBe('�'); // a surrogate
    expect(decode([0xe2, 0x82, 0xac])).toBe('€'); // still decodes €
  });
});
