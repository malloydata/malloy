/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {BaseConnection} from '../../connection/base_connection';
import type {
  MalloyQueryData,
  SQLSourceDef,
  TableSourceDef,
} from '../../model/malloy_types';
import type {CachedModel, ModelCache} from './cache';
import {CacheManager} from './cache';
import {InMemoryURLReader} from './readers';
import {Runtime} from './runtime';

/**
 * A connection that answers every table with the same one-column schema and
 * counts how often it was asked. A fresh connection per runtime, so its own
 * schema cache can't hide a recompile.
 */
class SchemaConnection extends BaseConnection {
  get name() {
    return 'mock';
  }
  get dialectName() {
    return 'duckdb';
  }
  getDigest() {
    return 'mock-digest';
  }
  async runSQL(): Promise<MalloyQueryData> {
    return {rows: [], totalRows: 0};
  }
  fetchTableSchema = jest.fn(
    async (tableName: string, tablePath: string): Promise<TableSourceDef> => ({
      type: 'table',
      name: tableName,
      tablePath,
      connection: 'mock',
      dialect: 'duckdb',
      fields: [{name: 'amount', type: 'number'}],
    })
  );
  async fetchSelectSchema(): Promise<SQLSourceDef | string> {
    return 'not used';
  }
}

/**
 * A ModelCache that outlives any CacheManager, as a disk or database store
 * would. Entries go through JSON, as they would on the way to such a store.
 */
class DurableModelCache implements ModelCache {
  readonly stored = new Map<string, string>();
  async getModel(url: URL): Promise<CachedModel | undefined> {
    const json = this.stored.get(url.toString());
    return json === undefined ? undefined : JSON.parse(json);
  }
  async setModel(url: URL, cachedModel: CachedModel): Promise<boolean> {
    this.stored.set(url.toString(), JSON.stringify(cachedModel));
    return true;
  }
}

const INDEX = 'file:///project/index.malloy';
const ORDERS = 'file:///project/orders.malloy';

/** Load INDEX the way a fresh process would: new connection, new manager. */
async function loadFresh(files: Record<string, string>, store: ModelCache) {
  const connection = new SchemaConnection();
  const runtime = new Runtime({
    urlReader: new InMemoryURLReader(new Map(Object.entries(files))),
    connection,
    cacheManager: new CacheManager(store),
  });
  const model = await runtime.loadModel(new URL(INDEX)).getModel();
  const calls = connection.fetchTableSchema.mock.calls;
  return {
    model,
    schemaFetches: calls.length,
    fetched: calls.map(([, tablePath]) => tablePath),
  };
}

describe('CacheManager over a ModelCache it did not fill', () => {
  const files = {
    [INDEX]: "import 'orders.malloy'\nsource: big_orders is orders",
    [ORDERS]: "source: orders is mock.table('orders')",
  };

  test('a fresh manager serves a model another manager stored', async () => {
    const store = new DurableModelCache();
    const first = await loadFresh(files, store);
    expect(first.schemaFetches).toBe(1);
    expect(store.stored.has(INDEX)).toBe(true);

    const second = await loadFresh(files, store);
    expect(second.schemaFetches).toBe(0);
    expect(
      second.model.getExploreByName('big_orders').allFields.map(f => f.name)
    ).toEqual(['amount']);
  });

  test('an edited entry file recompiles; its unchanged import is still a hit', async () => {
    const store = new DurableModelCache();
    await loadFresh(files, store);
    const edited = {
      ...files,
      [INDEX]: files[INDEX] + "\nsource: refunds is mock.table('refunds')",
    };
    const {model, schemaFetches, fetched} = await loadFresh(edited, store);
    // Only the new table: `orders.malloy` came from the store.
    expect(schemaFetches).toBe(1);
    expect(fetched).toEqual(['refunds']);
    expect(model.getExploreByName('refunds')).toBeDefined();
  });

  test('an edited import is a miss', async () => {
    const store = new DurableModelCache();
    await loadFresh(files, store);
    const edited = {...files, [ORDERS]: files[ORDERS] + '\n// edited'};
    expect((await loadFresh(edited, store)).schemaFetches).toBe(1);
  });

  test('a store that throws is a miss, not an error', async () => {
    const broken: ModelCache = {
      getModel: async () => {
        throw new Error('store unavailable');
      },
      setModel: async () => true,
    };
    const {model, schemaFetches} = await loadFresh(files, broken);
    expect(schemaFetches).toBe(1);
    expect(model.getExploreByName('big_orders')).toBeDefined();
  });

  test('an entry whose key is null or missing is a miss', async () => {
    const store = new DurableModelCache();
    await loadFresh(files, store);
    const reader = new InMemoryURLReader(new Map(Object.entries(files)));
    const entry = (await store.getModel(new URL(INDEX)))!;

    const nullKey: ModelCache = {
      getModel: async () => ({
        ...entry,
        invalidationKeys: {...entry.invalidationKeys, [ORDERS]: null},
      }),
      setModel: async () => true,
    };
    expect(
      await new CacheManager(nullKey).getCachedModelDef(reader, INDEX)
    ).toBeUndefined();

    const missingKey: ModelCache = {
      getModel: async () => ({
        ...entry,
        invalidationKeys: {[INDEX]: entry.invalidationKeys[INDEX]},
      }),
      setModel: async () => true,
    };
    expect(
      await new CacheManager(missingKey).getCachedModelDef(reader, INDEX)
    ).toBeUndefined();
  });

  test('a hit carries the keys of the entry and its imports, and repeats', async () => {
    const store = new DurableModelCache();
    await loadFresh(files, store);
    const reader = new InMemoryURLReader(new Map(Object.entries(files)));
    const manager = new CacheManager(store);
    const hit = await manager.getCachedModelDef(reader, INDEX);
    expect(Object.keys(hit?.invalidationKeys ?? {}).sort()).toEqual([
      INDEX,
      ORDERS,
    ]);
    // The second lookup takes the in-memory path the first one filled.
    expect(await manager.getCachedModelDef(reader, INDEX)).toEqual(hit);
  });
});
