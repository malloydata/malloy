import type {Meta} from '@storybook/html';
import script from './themes.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import {MalloyRenderer} from '../api/malloy-renderer';
import {DummyPluginFactory} from '@/plugins/dummy-plugin';

let renderAs = '';

renderAs = 'line_chart';
const meta: Meta = {
  title: 'Malloy Next/Themes',
  render: ({classes}, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';

    const targetElement = document.createElement('div');
    if (classes) targetElement.classList.add(classes);
    targetElement.style.height = '100%';
    targetElement.style.width = '100%';
    parent.appendChild(targetElement);

    const renderer = new MalloyRenderer({
      plugins: [DummyPluginFactory],
    });
    const viz = renderer.createViz({
      onError: error => {
        console.log('Malloy render error', error);
      },
    });
    viz.setResult(context.loaded['result']);
    console.log('initial state', viz.getMetadata());

    // Infers plugin type from line plugin factory, customMethod is typed to return string;
    const rootFieldKey = '[]';
    const lineChartPlugin = viz.getPluginInstance(rootFieldKey, 'line_chart');
    lineChartPlugin.customMethod();

    // Infers plugin type from provided dummy plugin factory, customDummyMethod is typed to return number;
    const dummyPlugin = viz.getPluginInstance(rootFieldKey, 'dummy');
    dummyPlugin.customDummyMethod();
    viz.render(targetElement);

    dummyPlugin.customDummyMethod();

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

export const ViewThemeOverrideLineChart = {
  args: {
    source: 'products',
    view: 'test_line_plugin',
  },
};
