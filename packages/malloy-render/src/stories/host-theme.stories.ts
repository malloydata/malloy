import type {Meta} from '@storybook/html';
import script from './other-charts.stories.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import {MalloyRenderer} from '@/api/malloy-renderer';

// A host theme passed the way Publisher passes one: series colors, fonts and
// text colors through vegaConfigOverride, and the map gradient's end color
// through theme.mapColor.
const FONT = 'Courier New, monospace';
const FOREGROUND = '#2E294E';
const hostConfig = {
  font: FONT,
  title: {color: FOREGROUND, font: FONT},
  axis: {
    labelColor: FOREGROUND,
    titleColor: FOREGROUND,
    labelFont: FONT,
    titleFont: FONT,
  },
  legend: {
    labelColor: FOREGROUND,
    titleColor: FOREGROUND,
    labelFont: FONT,
    titleFont: FONT,
  },
  range: {category: ['#D7263D', '#1B998B', '#F46036', '#2E294E', '#C5D86D']},
};

const meta: Meta = {
  title: 'Malloy Next/Host Theme',
  render: (_args, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';
    const el = document.createElement('div');
    el.style.height = '100%';
    el.style.width = '100%';
    const renderer = new MalloyRenderer({
      vegaConfigOverride: chartType =>
        chartType === 'shape_map'
          ? {...hostConfig, legend: {...hostConfig.legend, orient: 'bottom'}}
          : hostConfig,
      theme: {mapColor: '#7B2CBF', fontFamily: FONT},
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

export const Scatter = {args: {source: 'products', view: 'scatter_plot'}};

export const ScatterNoColorField = {
  args: {source: 'products', view: 'scatter_plot_no_color'},
};

export const ShapeMap = {
  args: {source: 'us_states', view: 'state_population_map'},
};

export const SegmentMap = {args: {source: 'flights', view: 'flight_routes'}};
