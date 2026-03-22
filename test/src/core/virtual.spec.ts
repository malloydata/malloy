/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';
import type {VirtualMap} from '@malloydata/malloy';
import {SingleConnectionRuntime} from '@malloydata/malloy';

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
      virtualMap: runtimeMap,
    });

    // Query-level map should win over runtime-level map
    const result = await runtime.loadQuery(code).run({virtualMap: queryMap});
    expect(result.data.value.length).toBe(5);
  });

  it('virtualMap on runtime constructor is used', async () => {
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
      virtualMap,
    });

    const result = await runtime.loadQuery(code).run();
    expect(result.data.value.length).toBe(5);
  });
});
