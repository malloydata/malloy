import type {Meta} from '@storybook/html';
import script from './tables.stories.malloy?raw';
import {createLoader} from './util';
import {MalloyRenderer} from '../api/malloy-renderer';
const meta: Meta = {
  title: 'Malloy Next/Wrapped Table',
  render: ({classes}, context) => {
    const parent = document.createElement('div');
    parent.style.maxHeight = '400px';
    parent.style.minHeight = '200px';
    parent.style.border = '1px solid #e5e7eb';
    parent.style.overflow = 'auto';
    parent.style.display = 'grid';

    const targetElement = document.createElement('div');
    if (classes) targetElement.classList.add(classes);
    targetElement.style.height = '100%';
    targetElement.style.width = '100%';
    parent.appendChild(targetElement);

    const renderer = new MalloyRenderer();
    const viz = renderer.createViz({
      onError: error => {
        console.log('Malloy render error', error);
      },
      scrollEl: parent,
    });
    viz.setResult(context.loaded['result']);
    console.log('initial state', viz.getMetadata());
    viz.render(targetElement);

    // copy to html test
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

export const WrappedTable = {
  args: {
    source: 'products',
    view: 'products_table',
  },
};
