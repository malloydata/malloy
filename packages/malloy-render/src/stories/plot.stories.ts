import {Meta} from '@storybook/html';
import script from './static/plot.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import '../component/render';

const meta: Meta = {
  title: 'Malloy Next/Plot',
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

export const PlotRaw = {
  args: {
    source: 'test',
    view: 'plotRaw',
  },
};

export const PlotTags = {
  args: {
    source: 'test',
    view: 'plotTest',
  },
};

export const PlotStack = {
  args: {
    source: 'test',
    view: 'plotStack',
  },
};

export const PlotGroup = {
  args: {
    source: 'test',
    view: 'plotGroup',
  },
};

export const PlotMeasureStack = {
  args: {
    source: 'test',
    view: 'plotMeasureStack',
  },
};

export const PlotMeasureGroup = {
  args: {
    source: 'test',
    view: 'plotMeasureGroup',
  },
};

export const PlotNested = {
  args: {
    source: 'test',
    view: 'plotNested',
  },
};
