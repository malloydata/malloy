/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';
import type {VirtualMap, ManagedConnectionLookup} from '@malloydata/malloy';
import {
  Runtime,
  SingleConnectionRuntime,
  MalloyConfig,
  createConnectionsFromConfig,
} from '@malloydata/malloy';
// Register duckdb type in the global registry so config-driven tests work
import '@malloydata/db-duckdb/native';

const tstDB = 'duckdb';
const tstRuntime = runtimeFor(tstDB);
const VIRTUAL_ANNOTATION = '##! experimental.virtual_source';

function mkVirtualMap(
  entries: Record<string, Record<string, string>>
): VirtualMap {
  const map = new Map<string, Map<string, string>>();
  for (const [conn, inner] of Object.entries(entries)) {
    map.set(conn, new Map(Object.entries(inner)));
  }
  return map;
}

describe('virtual source resolution', () => {
  it('virtual source resolves to real table', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: flight_fields is {
        carrier :: string,
        flight_count :: number
      }
      source: flights is ${tstDB}.virtual('vflights')::flight_fields
      run: flights -> { select: carrier; limit: 5 }
    `;

    const virtualMap = mkVirtualMap({
      [tstDB]: {vflights: 'malloytest.flights'},
    });

    const result = await tstRuntime.loadQuery(code).run({virtualMap});
    expect(result.data.value.length).toBe(5);
  });

  it('virtual source with dimensions and measures', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: flight_fields is {
        carrier :: string,
        dep_time :: timestamp
      }
      source: flights is ${tstDB}.virtual('vflights')::flight_fields extend {
        dimension: carrier_upper is upper(carrier)
        measure: flight_count is count()
      }
      run: flights -> {
        group_by: carrier_upper
        aggregate: flight_count
        limit: 5
      }
    `;

    const virtualMap = mkVirtualMap({
      [tstDB]: {vflights: 'malloytest.flights'},
    });

    const result = await tstRuntime.loadQuery(code).run({virtualMap});
    expect(result.data.value.length).toBe(5);
    const row = result.data.value[0];
    expect(row['carrier_upper']).toBeDefined();
    expect(row['flight_count']).toBeDefined();
  });

  it('missing virtualMap entry throws', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: s is { x :: string }
      source: v is ${tstDB}.virtual('no_such_table')::s
      run: v -> { select: x; limit: 1 }
    `;

    await expect(tstRuntime.loadQuery(code).run()).rejects.toThrow(
      "No virtual map entry for 'no_such_table'"
    );
  });

  it('per-query virtualMap overrides runtime virtualMap', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: carrier_fields is { code :: string, nickname :: string }
      source: carriers is ${tstDB}.virtual('vcarriers')::carrier_fields
      run: carriers -> { select: code; limit: 5 }
    `;

    const runtimeMap = mkVirtualMap({
      [tstDB]: {vcarriers: 'malloytest.nonexistent_table'},
    });

    const queryMap = mkVirtualMap({
      [tstDB]: {vcarriers: 'malloytest.carriers'},
    });

    const runtime = new SingleConnectionRuntime({
      connection: tstRuntime.connection,
    });
    runtime.virtualMap = runtimeMap;

    // Query-level map should win over runtime-level map
    const result = await runtime.loadQuery(code).run({virtualMap: queryMap});
    expect(result.data.value.length).toBe(5);
  });

  it('join between virtual sources', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: model_fields is {
        aircraft_model_code :: string,
        manufacturer :: string,
        seats :: number
      }
      type: aircraft_fields is {
        tail_num :: string,
        aircraft_model_code :: string
      }
      source: vmodels is ${tstDB}.virtual('vmodels')::model_fields extend {
        primary_key: aircraft_model_code
        measure: model_count is count()
      }
      source: vaircraft is ${tstDB}.virtual('vaircraft')::aircraft_fields extend {
        primary_key: tail_num
        join_one: vmodels with aircraft_model_code
        measure: aircraft_count is count()
      }
      run: vaircraft -> {
        aggregate:
          aircraft_count
          vmodels.model_count
      }
    `;

    const virtualMap = mkVirtualMap({
      [tstDB]: {
        vmodels: 'malloytest.aircraft_models',
        vaircraft: 'malloytest.aircraft',
      },
    });

    const result = await tstRuntime.loadQuery(code).run({virtualMap});
    const row = result.data.value[0];
    expect(row['aircraft_count']).toBeDefined();
    expect(row['model_count']).toBeDefined();
  });

  it('virtualMap from MalloyConfig is available', () => {
    const configJSON = JSON.stringify({
      connections: {
        duckdb: {is: 'duckdb'},
      },
      virtualMap: {
        duckdb: {
          flights: 'malloytest.flights',
          carriers: 'malloytest.carriers',
        },
      },
    });

    const config = new MalloyConfig(configJSON);
    const virtualMap = config.virtualMap;
    expect(virtualMap).toBeDefined();
    expect(virtualMap!.get('duckdb')?.get('flights')).toBe(
      'malloytest.flights'
    );
    expect(virtualMap!.get('duckdb')?.get('carriers')).toBe(
      'malloytest.carriers'
    );
  });

  it('config-driven Runtime gets virtualMap from config', () => {
    const configJSON = JSON.stringify({
      connections: {
        [tstDB]: {is: 'duckdb'},
      },
      virtualMap: {
        [tstDB]: {vflights: 'malloytest.flights'},
      },
    });

    const config = new MalloyConfig(configJSON);
    const runtime = new Runtime({config});
    expect(runtime.virtualMap?.get(tstDB)?.get('vflights')).toBe(
      'malloytest.flights'
    );
  });

  it('config-driven Runtime resolves virtual sources', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: flight_fields is { carrier :: string }
      source: flights is ${tstDB}.virtual('vflights')::flight_fields
      run: flights -> { select: carrier; limit: 5 }
    `;

    const configJSON = JSON.stringify({
      connections: {
        [tstDB]: {is: 'duckdb'},
      },
      virtualMap: {
        [tstDB]: {vflights: 'malloytest.flights'},
      },
    });

    // Use config for virtualMap, but app-driven connection for test database access
    const config = new MalloyConfig(configJSON);
    const runtime = new SingleConnectionRuntime({
      connection: tstRuntime.connection,
    });
    runtime.virtualMap = config.virtualMap;

    const result = await runtime.loadQuery(code).run();
    expect(result.data.value.length).toBe(5);
  });

  it('virtualMap set via setter is used', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: flight_fields is { carrier :: string }
      source: flights is ${tstDB}.virtual('vflights')::flight_fields
      run: flights -> { select: carrier; limit: 5 }
    `;

    const virtualMap = mkVirtualMap({
      [tstDB]: {vflights: 'malloytest.flights'},
    });

    const runtime = new SingleConnectionRuntime({
      connection: tstRuntime.connection,
    });
    runtime.virtualMap = virtualMap;

    const result = await runtime.loadQuery(code).run();
    expect(result.data.value.length).toBe(5);
  });
});

describe('ManagedConnectionLookup', () => {
  it('createConnectionsFromConfig returns ManagedConnectionLookup with close()', () => {
    const lookup: ManagedConnectionLookup = createConnectionsFromConfig({
      connections: {[tstDB]: {is: 'duckdb'}},
    });
    expect(typeof lookup.lookupConnection).toBe('function');
    expect(typeof lookup.close).toBe('function');
  });

  it('onConnectionCreated callback fires on first lookup', async () => {
    const created: string[] = [];
    const lookup = createConnectionsFromConfig(
      {connections: {[tstDB]: {is: 'duckdb'}}},
      (name, _conn) => created.push(name)
    );
    await lookup.lookupConnection(tstDB);
    expect(created).toEqual([tstDB]);

    // Second lookup should NOT fire callback (connection is cached)
    await lookup.lookupConnection(tstDB);
    expect(created).toEqual([tstDB]);
  });
});

describe('MalloyConfig connections lifecycle', () => {
  it('connections getter returns same object on repeated access', () => {
    const config = new MalloyConfig(
      JSON.stringify({connections: {[tstDB]: {is: 'duckdb'}}})
    );
    const a = config.connections;
    const b = config.connections;
    expect(a).toBe(b);
  });

  it('wrapConnections replaces the connections lookup', () => {
    const config = new MalloyConfig(
      JSON.stringify({connections: {[tstDB]: {is: 'duckdb'}}})
    );
    const override = {
      lookupConnection: () => Promise.resolve(tstRuntime.connection),
    };
    config.wrapConnections(() => override);
    expect(config.connections).toBe(override);
  });

  it('runtime.releaseConnections() shuts down managed connections', async () => {
    const config = new MalloyConfig(
      JSON.stringify({connections: {[tstDB]: {is: 'duckdb'}}})
    );
    const runtime = new Runtime({config});
    await runtime.connections.lookupConnection(tstDB);
    await runtime.releaseConnections();
  });
});

describe('Runtime with config + connections override', () => {
  it('config provides virtualMap while connections override provides connection', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: flight_fields is { carrier :: string }
      source: flights is ${tstDB}.virtual('vflights')::flight_fields
      run: flights -> { select: carrier; limit: 5 }
    `;

    const configJSON = JSON.stringify({
      connections: {[tstDB]: {is: 'duckdb'}},
      virtualMap: {[tstDB]: {vflights: 'malloytest.flights'}},
    });

    const config = new MalloyConfig(configJSON);
    // Pass config for virtualMap, but override connections with test connection
    const runtime = new Runtime({
      config,
      connections: {
        lookupConnection: () => Promise.resolve(tstRuntime.connection),
      },
    });

    expect(runtime.virtualMap?.get(tstDB)?.get('vflights')).toBe(
      'malloytest.flights'
    );
    const result = await runtime.loadQuery(code).run();
    expect(result.data.value.length).toBe(5);
  });
});
