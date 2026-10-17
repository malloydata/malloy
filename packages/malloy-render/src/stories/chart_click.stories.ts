import type {Meta} from '@storybook/html';
import script from './chart_click.malloy?raw';
import {createLoader} from './util';
import {MalloyRenderer} from '../api/malloy-renderer';

// Click a bar or a line point: onClick reports the clicked row, and in drill
// mode (tableConfig.enableDrill) onDrill receives the drill for that row.
const meta: Meta = {
  title: 'Malloy Next/Chart Click',
  loaders: [createLoader(script)],
  render: (_args, context) => {
    const page = document.createElement('div');
    const target = document.createElement('div');
    target.style.cssText = 'width:640px;height:360px';
    const log = (title: string) => {
      const pre = document.createElement('pre');
      pre.style.cssText =
        'font:12px monospace;background:#f8fafc;border:1px solid #e2e8f0;padding:8px;white-space:pre-wrap;margin:8px 0';
      pre.textContent = `${title}: (click a mark)`;
      return pre;
    };
    const clicks = log('onClick');
    const drills = log('onDrill');
    page.append(target, clicks, drills);

    const viz = new MalloyRenderer().createViz({
      tableConfig: {enableDrill: true},
      onClick: payload => {
        const row = payload.row;
        const values = row
          ? Object.fromEntries(
              row.field.fields.map(f => [f.name, row.column(f.name).value])
            )
          : null;
        clicks.textContent = `onClick: type=${payload.type} field=${
          payload.field.name
        } row=${JSON.stringify(values)}`;
      },
      onDrill: drill => {
        drills.textContent = `onDrill: ${drill.whereClause}`;
      },
    });
    viz.setResult(context.loaded['result']);
    viz.render(target);
    return page;
  },
};

export default meta;

export const BarChart = {args: {source: 'products', view: 'bars'}};
export const BarChartWithSeries = {
  args: {source: 'products', view: 'series_bars'},
};
export const LineChart = {args: {source: 'products', view: 'line'}};
