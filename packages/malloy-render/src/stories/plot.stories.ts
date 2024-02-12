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

export const Bar = {
  args: {
    source: 'test',
    view: 'bar',
  },
};

export const Bar2 = {
  args: {
    source: 'test',
    view: 'bar2',
  },
};

export const Bar3 = {
  args: {
    source: 'test',
    view: 'bar3',
  },
};

export const Bar4 = {
  args: {
    source: 'test',
    view: 'bar4',
  },
};

export const Bar5 = {
  args: {
    source: 'test',
    view: 'bar5',
  },
};

export const Bar6 = {
  args: {
    source: 'test',
    view: 'bar6',
  },
};

export const Bar7 = {
  args: {
    source: 'test',
    view: 'bar7',
  },
};

export const Bar8 = {
  args: {
    source: 'test',
    view: 'bar8',
  },
};

export const Bar9 = {
  args: {
    source: 'test',
    view: 'bar9',
  },
};

export const Bar10 = {
  args: {
    source: 'test',
    view: 'bar10',
  },
};

export const Bar11 = {
  args: {
    source: 'test',
    view: 'bar11',
  },
};

export const Bar12 = {
  args: {
    source: 'test',
    view: 'bar12',
  },
};

export const Bar13 = {
  args: {
    source: 'test',
    view: 'bar13',
  },
};
