import type {Meta} from '@storybook/html';
import script from './dashboard_tile_validation.malloy?raw';
import {createLoader} from './util';
import {MalloyRenderer} from '../api/malloy-renderer';

// A view the host lays out as one tile of its own dashboard. With
// dashboardTile, its top-level colspan/subtitle/break/borderless are tile
// settings rather than unknown tags. Shows getLogs() with and without it.
const meta: Meta = {
  title: 'Malloy Next/Dashboard Tile Validation',
  loaders: [createLoader(script)],
  render: (_args, context) => {
    const page = document.createElement('div');
    for (const dashboardTile of [false, true]) {
      const viz = new MalloyRenderer().createViz({dashboardTile});
      viz.setResult(context.loaded['result']);
      const logs = viz.getLogs();
      const tile = viz.getMetadata()?.getRootField().getDashboardChildConfig();
      const pre = document.createElement('pre');
      pre.style.cssText =
        'font:12px monospace;background:#f8fafc;border:1px solid #e2e8f0;padding:8px;white-space:pre-wrap;margin:8px';
      pre.textContent = [
        `dashboardTile: ${dashboardTile}`,
        `tile settings: ${JSON.stringify(tile ?? null)}`,
        'getLogs():',
        ...(logs.length
          ? logs.map(l => `  ${l.severity}: ${l.message}`)
          : ['  (no warnings or errors)']),
      ].join('\n');
      page.appendChild(pre);
    }
    return page;
  },
};

export default meta;

export const TileSettings = {
  args: {source: 'products', view: 'tile_view'},
};

export const InvalidTileColspan = {
  args: {source: 'products', view: 'bad_colspan_tile'},
};
