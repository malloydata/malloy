import {Meta} from '@storybook/html';
import script from './static/areas.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import '../component/render-webcomponent';

const meta: Meta = {
  title: 'Malloy Next/Area Charts',
  render: ({classes}, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';
    const el = document.createElement('malloy-render');
    if (classes) el.classList.add(classes);
    el.result = context.loaded['result'];
    parent.appendChild(el);
    return parent;
  },
  loaders: [createLoader(script)],
  argTypes: {},
};

export default meta;

export const Products2Column = {
  args: {
    source: 'products',
    view: 'category_bar',
  },
};

export const Nested = {
  args: {
    source: 'products',
    view: 'nested',
  },
};

export const Sparks = {
  args: {
    source: 'products',
    view: 'sparks',
  },
};

export const SparksNested = {
  args: {
    source: 'products',
    view: 'sparks_nested',
  },
};

export const TestOld = {
  args: {
    source: 'products',
    view: 'test',
  },
};

export const Test = {
  args: {
    source: 'products',
    view: 'topSellingBrandsTest',
  },
};

export const Series = {
  args: {
    source: 'products',
    view: 'seriesCharts',
  },
};

export const NestedTest = {
  args: {
    source: 'products',
    view: 'nested_test',
  },
};

export const IndependentAxis = {
  args: {
    source: 'products',
    view: 'nested_independent_axis',
  },
};
