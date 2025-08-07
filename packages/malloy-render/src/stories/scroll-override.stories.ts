import type {Meta} from '@storybook/html';
import script from './scroll-override.stories.malloy?raw';
import {createLoader} from './util';
import {MalloyRenderer} from '../api/malloy-renderer';

const meta: Meta = {
  title: 'Malloy Next/Scroll Override Test',
  render: context => {
    const mainContainer = document.createElement('div');

    const scrollContainer = document.createElement('div');
    scrollContainer.style.maxHeight = '400px';
    scrollContainer.style.border = '3px solid red';
    scrollContainer.style.borderRadius = '8px';
    scrollContainer.style.overflow = 'auto';
    scrollContainer.style.position = 'relative';
    scrollContainer.style.backgroundColor = 'white';

    const targetElement = document.createElement('div');
    targetElement.style.width = '100%';
    scrollContainer.appendChild(targetElement);

    const renderer = new MalloyRenderer();
    const viz = renderer.createViz({
      onError: error => {
        console.error('Malloy render error:', error);
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '10px';
        errorDiv.textContent = `Error: ${error.message || error}`;
        targetElement.appendChild(errorDiv);
      },
      scrollEl: scrollContainer,
    });

    if (context.loaded && context.loaded['result']) {
      viz.setResult(context.loaded['result']);

      const metadata = viz.getMetadata();
      console.log('Render metadata:', metadata);
      console.log('Scroll container:', scrollContainer);

      viz.render(targetElement);
    } else {
      console.error('No result loaded');
    }

    mainContainer.appendChild(scrollContainer);

    return mainContainer;
  },
  loaders: [createLoader(script)],
  argTypes: {
    view: {
      control: {type: 'select'},
      options: [
        'full_products_table',
        'simple_nested_table',
        'deeply_nested_table',
        'wide_table',
      ],
      description: 'Select which view to render',
    },
  },
};

export default meta;

export const FullProductsTable = {
  args: {
    source: 'products',
    view: 'full_products_table',
  },
};

export const SmallProductsTable = {
  args: {
    source: 'products',
    view: 'small_products_table',
  },
};

export const SimpleNestedTable = {
  args: {
    source: 'products',
    view: 'simple_nested_table',
  },
};

export const DeeplyNestedTable = {
  args: {
    source: 'products',
    view: 'deeply_nested_table',
  },
};

export const WideTable = {
  args: {
    source: 'products',
    view: 'wide_table',
  },
};
