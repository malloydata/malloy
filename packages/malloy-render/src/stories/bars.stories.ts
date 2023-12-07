import {Meta} from '@storybook/html';
import script from './static/bars.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import '../component/render';

const meta: Meta = {
  title: 'Malloy Next/Bars',
  render: ({classes}, context) => {
    const parent = document.createElement('div');
    parent.style.height = '1000px';
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
