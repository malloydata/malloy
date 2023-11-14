import {Meta} from '@storybook/html';
import script from './static/tables.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import '../component/render';

const meta: Meta = {
  title: 'Malloy Next/Tables',
  render: ({classes}, context) => {
    const el = document.createElement('malloy-render');
    if (classes) el.classList.add(classes);
    el.result = context.loaded['result'];
    return el;
  },
  loaders: [createLoader(script)],
  argTypes: {},
};

export default meta;

export const ProductsTable = {
  args: {
    source: 'products',
    view: `records`,
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
