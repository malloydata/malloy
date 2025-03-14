import type {Meta} from '@storybook/html';
import script from './themes.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import '../component/render-webcomponent';
import {copyMalloyRenderHTML} from '../component/copy-to-html';

const meta: Meta = {
  title: 'Malloy Next/Themes',
  render: ({classes}, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';
    const el = document.createElement('malloy-render');
    if (classes) el.classList.add(classes);
    el.malloyResult = context.loaded['result'];

    // copy to html test
    const button = document.createElement('button');
    button.innerHTML = 'Copy HTML';
    button.addEventListener('click', () => copyMalloyRenderHTML(el));

    parent.appendChild(button);
    parent.appendChild(el);

    return parent;
  },
  loaders: [createLoader(script)],
  argTypes: {},
};

export default meta;

export const ModelThemeOverride = {
  args: {
    source: 'products',
    view: 'records',
  },
};

export const ViewThemeOverride = {
  args: {
    source: 'products',
    view: 'records_override',
  },
};

export const ViewThemeOverrideCSS = {
  args: {
    source: 'products',
    view: 'records_override',
    classes: 'night',
  },
};
