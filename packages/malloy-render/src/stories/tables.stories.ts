import {Meta} from '@storybook/html';
import script from './static/tables.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import '../component/render-webcomponent';

const meta: Meta = {
  title: 'Malloy Next/Tables',
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

export const ProductsTable = {
  args: {
    source: 'products',
    view: 'records',
  },
};

export const ProductsTableCustomTheme = {
  args: {
    source: 'products',
    view: 'records',
    classes: 'night',
  },
};

export const Products2Column = {
  args: {
    source: 'products',
    view: 'category_bar',
  },
};

export const SimpleNested = {
  args: {
    source: 'products',
    view: 'simple_nested',
  },
};

export const Nested = {
  args: {
    source: 'products',
    view: 'nested',
  },
};

export const Nested2 = {
  args: {
    source: 'products',
    view: 'nested_2',
  },
};

export const NumberFormatting = {
  args: {
    source: 'products',
    view: 'number_formats',
  },
};

export const NullTest = {
  args: {
    source: 'null_test',
    view: '{ select: * }',
  },
};

export const LongColumn = {
  args: {
    source: 'products',
    view: 'long_column',
  },
};

export const DateAndTime = {
  args: {
    source: 'products',
    view: 'date_and_time',
  },
};
export const DirectTest = {
  args: {
    source: 'duckdb.sql("select unnest([1,null,3]) as i")',
    view: `{ select: * }`,
  },
};
