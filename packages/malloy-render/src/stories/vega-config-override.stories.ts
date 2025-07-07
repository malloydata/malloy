import type {Meta} from '@storybook/html';
import script from './vega-config-override.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import {MalloyRenderer} from '@/api/malloy-renderer';

const meta: Meta = {
  title: 'Malloy Next/Vega Config Override',
  render: ({classes}, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';
    const el = document.createElement('div');
    el.style.height = '100%';
    el.style.width = '100%';
    if (classes) el.classList.add(classes);
    const renderer = new MalloyRenderer({
      vegaConfigOverride: () => {
        return {
          'range': {
            'category': ['#9467bd'],
          },
          'axis': {
            'titleFontSize': 16,
          },
        };
      },
    });
    const viz = renderer.createViz();
    viz.setResult(context.loaded['result']);
    viz.render(el);
    parent.appendChild(el);
    return parent;
  },
  loaders: [createLoader(script)],
  argTypes: {},
};

export default meta;

export const BarChart = {
  args: {
    source: 'products',
    view: 'category_bar',
  },
};

export const LegacyLineChart = {
  args: {
    source: 'products',
    view: 'lc',
  },
};
