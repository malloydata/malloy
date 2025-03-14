import type {Meta} from '@storybook/html';
import script from './vega-config-override.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import '../component/render-webcomponent';

const meta: Meta = {
  title: 'Malloy Next/Vega Config Override',
  render: ({classes}, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';
    const el = document.createElement('malloy-render');
    if (classes) el.classList.add(classes);
    el.malloyResult = context.loaded['result'];
    el.vegaConfigOverride = () => {
      return {
        'range': {
          'category': ['#9467bd'],
        },
        'axis': {
          'titleFontSize': 16,
        },
      };
    };
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
