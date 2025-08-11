import type {Meta} from '@storybook/html';
import script from './vega-config-override.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import {MalloyRenderer} from '@/api/malloy-renderer';

const meta: Meta = {
  title: 'Malloy Next/Vega Config Override',
  render: ({classes}, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';
    const el = document.createElement('div');
    el.style.height = '100%';
    el.style.width = '100%';
    if (classes) el.classList.add(classes);
    const renderer = new MalloyRenderer({
      vegaConfigOverride: () => {
        return {
          'range': {
            'category': ['#9467bd'],
          },
          'axis': {
            'titleFontSize': 16,
          },
        };
      },
    });
    const viz = renderer.createViz();
    viz.setResult(context.loaded['result']);
    viz.render(el);
    parent.appendChild(el);
    return parent;
  },
  loaders: [createLoader(script)],
  argTypes: {},
};

export default meta;

export const BarChart = {
  args: {
    source: 'products',
    view: 'category_bar',
  },
};

export const LegacyLineChart = {
  args: {
    source: 'products',
    view: 'lc',
  },
};

const configV2 = {
  'axis': {
    'domainColor': '#0A1317',
    'domainWidth': 0.5,
    'gridColor': '#F1F4F7',
    'labelColor': '#4E606F',
    'labelFont': '-apple-system, SF Pro Text',
    'labelFontSize': 12,
    'labelLineHeight': 16,
    'labelPadding': 8,
    'tickCount': 5,
    'ticks': false,
    'title': null,
    'titleFont': '-apple-system, SF Pro Text',
    'titleFontSize': 12,
  },
  'axisX': {
    'grid': false,
  },
  'axisXQuantitative': {
    'domain': true,
  },
  'axisY': {
    'domain': false,
    'titlePadding': 6,
    'labelPadding': 4,
  },
  'axisYQuantitative': {
    'grid': true,
    'gridWidth': 0.5,
  },
  'background': '#F1F4F7',
  'legend': {
    'labelColor': '#4E606F',
    'labelFont': '-apple-system, SF Pro Text',
    'labelFontSize': 12,
    'labelPadding': 8,
    'offset': 16,
    'orient': 'bottom',
    'rowPadding': 12,
    'title': null,
    'titleColor': '#4E606F',
    'titleFont': 'Optimistic 95',
    'titleFontSize': 16,
  },
  'line': {
    'strokeCap': 'round',
    'strokeJoin': 'round',
    'strokeWidth': 2,
  },
  'padding': 16,
  'point': {
    'shape': 'circle',
    'size': 60,
    'fill': '#F1F4F7',
  },
  'range': {
    'category': [
      '#0171E3',
      '#EB6E00',
      '#5B08D8',
      '#D123A1',
      '#014975',
      '#05ACAA',
      '#9081FF',
      '#71005C',
      '#089DD0',
      '#260660',
      '#6B3902',
    ],
    'diverging': [
      '#03278D',
      '#083BA9',
      '#0082FB',
      '#65B4FE',
      '#C9E5FF',
      '#F1F4F7',
      '#FCEC85',
      '#FDB876',
      '#EB6E00',
      '#C05203',
      '#A13F04',
    ],
    'heatmap': [
      '#03278D',
      '#083BA9',
      '#0082FB',
      '#65B4FE',
      '#C9E5FF',
      '#F1F4F7',
      '#FCEC85',
      '#FDB876',
      '#EB6E00',
      '#C05203',
      '#A13F04',
    ],
    'ordinal': ['#02165E', '#083BA9', '#0171E3', '#65B4FE', '#AFD7FF'],
    'ramp': ['#02165E', '#083BA9', '#0171E3', '#65B4FE', '#AFD7FF'],
  },
  'scale': {
    'offsetBandPaddingInner': 0.1,
  },
  'title': {
    'anchor': 'start',
    'color': '#0A1317',
    'subtitleFontWeight': '400',
    'subtitleColor': '#4E606F',
    'offset': 16,
  },
  'view': {
    'stroke': null,
  },
};

export const BarChartWithNewConfig = {
  args: {
    source: 'products',
    view: 'category_bar',
  },
  render: ({classes}, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';
    const el = document.createElement('div');
    el.style.height = '100%';
    el.style.width = '100%';
    if (classes) el.classList.add(classes);
    const renderer = new MalloyRenderer({
      vegaConfigOverride: () => {
        return configV2;
      },
    });
    const viz = renderer.createViz();
    viz.setResult(context.loaded['result']);
    viz.render(el);
    parent.appendChild(el);
    return parent;
  },
};

export const LineChartWithNewConfig = {
  args: {
    source: 'products',
    view: 'lc',
  },
  render: ({classes}, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';
    const el = document.createElement('div');
    el.style.height = '100%';
    el.style.width = '100%';
    if (classes) el.classList.add(classes);
    const renderer = new MalloyRenderer({
      vegaConfigOverride: () => {
        return configV2;
      },
    });
    const viz = renderer.createViz();
    viz.setResult(context.loaded['result']);
    viz.render(el);
    parent.appendChild(el);
    return parent;
  },
};
