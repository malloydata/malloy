import type {Meta} from '@storybook/html';
import script from './dark-mode.malloy?raw';
import {createLoader} from './util';
import {MalloyRenderer} from '../api/malloy-renderer';

const meta: Meta = {
  title: 'Malloy Next/Dark Mode',
  render: (_args, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';

    const targetElement = document.createElement('div');
    targetElement.style.height = '100%';
    targetElement.style.width = '100%';
    parent.appendChild(targetElement);

    const renderer = new MalloyRenderer();
    const viz = renderer.createViz({
      onError: error => {
        console.log('Malloy render error', error);
      },
    });
    viz.setResult(context.loaded['result']);
    viz.render(targetElement);

    const button = document.createElement('button');
    button.innerHTML = 'Copy HTML';
    button.addEventListener('click', () => viz.copyToHTML());

    parent.appendChild(button);
    parent.appendChild(targetElement);

    return parent;
  },
  loaders: [createLoader(script)],
  argTypes: {},
};

export default meta;

export const DarkTable = {
  args: {
    source: 'products',
    view: 'dark_table',
  },
};

export const DarkDashboard = {
  args: {
    source: 'products',
    view: 'dark_dashboard',
  },
};

export const DarkNested = {
  args: {
    source: 'products',
    view: 'dark_nested',
  },
};
