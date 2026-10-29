/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Containment of render-time plugin failures (`beforeRender` /
 * `getStyleOverrides`).
 *
 * Compile-only harness per docs/testing.md: the behavior is a function of the
 * result schema plus the plugin registry, so no query run, no Vega, no DOM.
 * The renderer calls runPluginsBeforeRender from inside a Solid memo; a throw
 * escaping it left that memo undefined and every failure surfaced to users as
 * `Cannot read properties of undefined (reading 'styleOverrides')`, with the
 * plugin's real error never logged.
 */

import {DuckDBConnection} from '@malloydata/db-duckdb';
import {SingleConnectionRuntime} from '@malloydata/malloy';
import {RenderFieldMetadata} from './render-field-metadata';
import type {OnPluginRenderError} from './render-field-metadata';
import {getResultMetadata} from './component/render-result-metadata';
import type {RenderMetadata} from './component/render-result-metadata';
import type {
  RenderPluginFactory,
  RenderPluginInstance,
} from './api/plugin-types';

let connection: DuckDBConnection;
let runtime: SingleConnectionRuntime;

beforeAll(async () => {
  connection = new DuckDBConnection('duckdb');
  await connection.connecting;
  runtime = new SingleConnectionRuntime({connection});
});

afterAll(async () => {
  await connection.close();
});

const SOURCE = `
  source: airings is duckdb.sql("""
    SELECT 'ESPN' AS network, 10 AS reach
  """)
`;

const BOOM = 'plugin exploded during beforeRender';

const POLITE_OVERRIDE = {'--malloy-render--table-body-color': 'teal'};

/** Minimal plugin matching a tag, optionally throwing from one render hook. */
function fakeFactory(
  name: string,
  opts: {
    throwFrom?: 'beforeRender' | 'getStyleOverrides';
    styleOverrides?: Record<string, string>;
  } = {}
): RenderPluginFactory {
  return {
    name,
    matches: (_field, fieldTag) => fieldTag.has(name),
    create: (field): RenderPluginInstance => ({
      name,
      field,
      renderMode: 'solidjs',
      sizingStrategy: 'fill',
      getMetadata: () => ({}),
      renderComponent: () => null,
      beforeRender: () => {
        if (opts.throwFrom === 'beforeRender') throw new Error(BOOM);
      },
      getStyleOverrides: () => {
        if (opts.throwFrom === 'getStyleOverrides') throw new Error(BOOM);
        return opts.styleOverrides ?? {};
      },
    }),
  };
}

const boomFactory = (throwFrom: 'beforeRender' | 'getStyleOverrides') =>
  fakeFactory('boom', {throwFrom});

/** A well-behaved plugin, to prove one bad plugin doesn't starve the others. */
const politeFactory = fakeFactory('polite', {
  styleOverrides: POLITE_OVERRIDE,
});

async function setup(
  query: string,
  plugins: RenderPluginFactory[],
  onPluginRenderError?: OnPluginRenderError
) {
  const pr = await runtime
    .loadModel(`${SOURCE}\n${query}`)
    .loadQueryByName('q')
    .getPreparedResult();
  const rfm = new RenderFieldMetadata(
    pr.toStableResult(),
    plugins,
    {},
    undefined,
    undefined,
    onPluginRenderError
  );
  const root = rfm.getRootField();
  const resultMetadata: RenderMetadata = getResultMetadata(root, {
    renderFieldMetadata: rfm,
    parentSize: {width: 400, height: 300},
  });
  return {rfm, root, resultMetadata};
}

const BOOM_QUERY = `
  # boom
  query: q is airings -> { group_by: network }
`;

describe('runPluginsBeforeRender contains plugin failures', () => {
  test('a throwing beforeRender does not propagate to the caller', async () => {
    const {rfm, resultMetadata} = await setup(BOOM_QUERY, [
      boomFactory('beforeRender'),
    ]);

    expect(() =>
      rfm.runPluginsBeforeRender(resultMetadata, {
        renderFieldMetadata: rfm,
        parentSize: {width: 400, height: 300},
      })
    ).not.toThrow();

    // The guarantee the render path depends on: metadata is still usable, and
    // styleOverrides is an object rather than undefined.
    expect(resultMetadata.styleOverrides).toEqual({});
  });

  test('a throwing getStyleOverrides is contained the same way', async () => {
    const {rfm, resultMetadata} = await setup(BOOM_QUERY, [
      boomFactory('getStyleOverrides'),
    ]);

    expect(() =>
      rfm.runPluginsBeforeRender(resultMetadata, {
        renderFieldMetadata: rfm,
        parentSize: {width: 400, height: 300},
      })
    ).not.toThrow();
    expect(resultMetadata.styleOverrides).toEqual({});
  });

  test("the plugin's real error is logged, not swallowed", async () => {
    const {rfm, resultMetadata} = await setup(BOOM_QUERY, [
      boomFactory('beforeRender'),
    ]);
    rfm.runPluginsBeforeRender(resultMetadata, {
      renderFieldMetadata: rfm,
      parentSize: {width: 400, height: 300},
    });

    const errors = rfm.logCollector
      .getLogs()
      .filter(l => l.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain(BOOM);
    expect(errors[0].message).toContain('Plugin boom failed for field');
  });

  test('the failed plugin is dropped and a replacement can take its place', async () => {
    const replacement = {
      name: 'error',
      field: {},
      renderMode: 'solidjs',
      sizingStrategy: 'fill',
      getMetadata: () => ({}),
      renderComponent: () => null,
    } as unknown as RenderPluginInstance;

    const {rfm, root, resultMetadata} = await setup(
      BOOM_QUERY,
      [boomFactory('beforeRender')],
      (_error, _plugin, _field, plugins) => plugins.push(replacement)
    );
    expect(root.getPlugins().map(p => p.name)).toEqual(['boom']);

    rfm.runPluginsBeforeRender(resultMetadata, {
      renderFieldMetadata: rfm,
      parentSize: {width: 400, height: 300},
    });

    // Dropped from both views of the field's plugin list, and replaced.
    expect(root.getPlugins().map(p => p.name)).toEqual(['error']);
    expect(rfm.getPluginsForField(root.key).map(p => p.name)).toEqual([
      'error',
    ]);
    // applyRenderer dispatches on renderAs, which setPlugins recomputes.
    expect(root.renderAs()).toBe('error');
  });

  test('a failing plugin does not suppress a healthy one', async () => {
    const {rfm, resultMetadata} = await setup(
      `
      # boom
      # polite
      query: q is airings -> { group_by: network }
      `,
      [boomFactory('beforeRender'), politeFactory]
    );

    rfm.runPluginsBeforeRender(resultMetadata, {
      renderFieldMetadata: rfm,
      parentSize: {width: 400, height: 300},
    });

    // The healthy plugin's override still lands, and only it.
    expect(resultMetadata.styleOverrides).toEqual(POLITE_OVERRIDE);
  });
});
