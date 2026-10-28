import type {Meta} from '@storybook/html';
import script from './sticky_header.malloy?raw';
import {createLoader} from './util';
import {MalloyRenderer} from '../api/malloy-renderer';

// The host page scrolls the rendering (scrollEl) under its own 60px sticky
// header; --malloy-render--sticky-top makes pinned headers stick below it.
const meta: Meta = {
  title: 'Malloy Next/Sticky Header',
  loaders: [createLoader(script)],
  render: (args, context) => {
    const page = document.createElement('div');
    const header = document.createElement('div');
    header.textContent = 'Host page header (sticky, 60px)';
    header.style.cssText =
      'position:sticky;top:0;height:60px;z-index:1000;background:#334155;color:white;display:flex;align-items:center;padding:0 16px;font:14px sans-serif';
    const target = document.createElement('div');
    target.style.setProperty('--malloy-render--sticky-top', '60px');
    target.style.margin = '16px';
    // A dashboard still needs a container with a height to render.
    if (args['view'] === 'dashboard_rows') target.style.height = '600px';
    const spacer = document.createElement('div');
    spacer.style.height = '2000px';
    page.append(header, target, spacer);

    const viz = new MalloyRenderer().createViz({
      scrollEl: document.scrollingElement as HTMLElement,
    });
    viz.setResult(context.loaded['result']);
    viz.render(target);
    return page;
  },
};

export default meta;

export const TableScrolledByPage = {
  args: {source: 'products', view: 'long_table'},
};

export const DashboardScrolledByPage = {
  args: {source: 'products', view: 'dashboard_rows'},
};
