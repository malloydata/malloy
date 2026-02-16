import type {Config} from 'vega';

export const grayMedium = '#727883';
export const gridGray = '#EBEDF0';

export interface VegaThemeColors {
  background?: string;
  axisLabelColor?: string;
  axisTitleColor?: string;
  gridColor?: string;
}

export const baseVegaConfig: (theme?: VegaThemeColors) => Config = theme => ({
  'range': {
    'category': [
      '#1877F2',
      '#30C8B4',
      '#5A24C7',
      '#E42C97',
      '#F0701A',
      '#00487C',
      '#A87CFF',
      '#9C4300',
      '#DA8600',
      '#68013D',
      '#56585C',
    ],
    'diverging': [
      '#3F1691',
      '#5A24C7',
      '#1877F2',
      '#5FAAFF',
      '#32AB4F',
      '#FF9831',
      '#EB660D',
      '#D31E3C',
      '#A50326',
    ],
    'heatmap': [
      '#07316D',
      '#1455B0',
      '#1877F2',
      '#5FAAFF',
      '#8A8D91',
      '#FF9831',
      '#EB660D',
      '#AB3A02',
      '#692600',
    ],
    'ordinal': ['#05214D', '#083E89', '#1877F2', '#76B6FF', '#A8D1FF'],
    'ramp': ['#05214D', '#083E89', '#1877F2', '#76B6FF', '#A8D1FF'],
  },
  'background': theme?.background || 'white',
  'axis': {
    gridColor: theme?.gridColor || gridGray,
    gridOpacity: 0.7,
    tickColor: theme?.gridColor || gridGray,
    domain: false,
    labelFont: 'Inter, system-ui, sans-serif',
    labelFontSize: 11,
    labelFontWeight: 'normal',
    labelPadding: 5,
    labelColor: theme?.axisLabelColor || grayMedium,
    titleColor: theme?.axisTitleColor || grayMedium,
    titleFont: 'Inter, system-ui, sans-serif',
    titleFontSize: 11,
    titleFontWeight: 500,
  },
  'axisX': {
    tickSize: 0,
    titlePadding: 16,
  },
  'axisY': {
    grid: true,
    labelOverlap: false,
    titlePadding: 10,
  },
  'view': {
    strokeWidth: 0,
  },
  'signals': [
    {
      name: 'referenceLineFont',
      value: 'Inter, system-ui, sans-serif',
    },
  ],
});
