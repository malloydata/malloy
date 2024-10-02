import {Explore, Tag} from '@malloydata/malloy';
import {BarChartSettings} from './get-bar_chart-settings';
import {
  ChartTooltipEntry,
  DataInjector,
  RenderResultMetadata,
  VegaChartProps,
  VegaSpec,
} from '../types';
import {getChartLayoutSettings} from '../chart-layout-settings';
import {getFieldFromRootPath} from '../plot/util';
import {field, Item} from 'vega';
import {update} from 'lodash';

const LEGEND_PERC = 0.4;
const LEGEND_MAX = 384;

export function generateBarChartVegaSpec(
  explore: Explore,
  settings: BarChartSettings,
  metadata: RenderResultMetadata,
  chartTag: Tag
): VegaChartProps {
  const xFieldPath = settings.xChannel.fields.at(0);
  const yFieldPath = settings.yChannel.fields.at(0);
  const seriesFieldPath = settings.seriesChannel.fields.at(0);

  if (!xFieldPath) throw new Error('Malloy Bar Chart: Missing x field');
  if (!yFieldPath) throw new Error('Malloy Bar Chart: Missing y field');

  const xField = getFieldFromRootPath(explore, xFieldPath);
  const yField = getFieldFromRootPath(explore, yFieldPath);
  const seriesField = seriesFieldPath
    ? getFieldFromRootPath(explore, seriesFieldPath)
    : null;

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const name of settings.yChannel.fields) {
    const field = getFieldFromRootPath(explore, name);
    const min = metadata.field(field).min;
    if (min !== null) yMin = Math.min(yMin, min);
    const max = metadata.field(field).max;
    if (max !== null) yMax = Math.max(yMax, max);
  }

  const yDomainMin = Math.min(0, yMin);
  const yDomainMax = Math.max(0, yMax);

  const chartSettings = getChartLayoutSettings(explore, metadata, chartTag, {
    xField,
    yField,
    chartType: 'bar_chart',
    getYMinMax: () => [yDomainMin, yDomainMax],
  });

  const xMeta = metadata.field(xField);
  const seriesMeta = seriesField ? metadata.field(seriesField) : null;

  const forceSharedX = chartTag.text('x', 'independent') === 'true';
  const forceIndependentX = chartTag.has('x', 'independent') && !forceSharedX;
  const autoSharedX = xMeta.values.size <= 20;
  const shouldShareXDomain =
    forceSharedX || (autoSharedX && !forceIndependentX);

  const forceSharedSeries = chartTag.text('series', 'independent') === 'true';
  const forceIndependentSeries =
    chartTag.has('series', 'independent') && !forceSharedSeries;
  const autoSharedSeries = seriesMeta && seriesMeta.values.size <= 20;
  const shouldShareSeriesDomain =
    seriesField &&
    (forceSharedSeries || (autoSharedSeries && !forceIndependentSeries));

  let yAxis;
  if (!chartSettings.yAxis.hidden) {
    yAxis = {
      'orient': 'left',
      'scale': 'yscale',
      ...chartSettings.yAxis,
      labelLimit: chartSettings.yAxis.width + 10,
    };
  }

  const barMark: VegaSpec = {
    name: 'bars',
    from: {data: 'values'},
    type: 'rect',
    'encode': {
      'enter': {
        'x': {
          'scale': 'xscale',
          'field': 'x',
          offset: settings.isStack
            ? undefined
            : {scale: 'xOffset', field: 'series'},
        },
        'width': settings.isStack
          ? {scale: 'xscale', 'band': 1}
          : {scale: 'xOffset', 'band': 1},
        'y': {'scale': 'yscale', 'field': settings.isStack ? 'y0' : 'y'},
        'y2': settings.isStack
          ? {'scale': 'yscale', 'field': 'y1'}
          : {'scale': 'yscale', 'value': 0},
      },
      'update': {
        'fill': {
          'scale': 'color',
        },
      },
    },
  };

  const valuesData: VegaSpec = {name: 'values', values: [], transform: []};
  if (settings.isStack) {
    valuesData.transform.push({
      type: 'stack',
      groupby: ['x'],
      field: 'y',
      sort: {field: 'series'},
    });
  }

  const spec: VegaSpec = {
    '$schema': 'https://vega.github.io/schema/vega-lite/v5.json',
    'width': chartSettings.plotWidth,
    'height': chartSettings.plotHeight,
    'autosize': {
      type: 'none',
      resize: true,
      contains: 'content',
    },
    'padding': chartSettings.padding,
    'data': [valuesData],
    'scales': [
      {
        'name': 'xscale',
        'type': 'band',
        'domain': shouldShareXDomain
          ? [...xMeta.values]
          : {data: 'values', field: 'x'},
        'range': 'width',
        'padding': 0.1,
        'round': true,
      },
      {
        'name': 'yscale',
        'domain': {'data': 'values', 'field': settings.isStack ? 'y1' : 'y'},
        'nice': true,
        'range': 'height',
      },
      {
        'name': 'color',
        'type': 'ordinal',
        'range': 'category',
        'domain': shouldShareSeriesDomain ? [...seriesMeta!.values] : undefined,
      },
      {
        'name': 'xOffset',
        'type': 'band',
        'domain': {'data': 'values', 'field': 'series'},
        'range': {'signal': "[0,bandwidth('xscale')]"},
      },
    ],

    'axes': [
      {
        'orient': 'bottom',
        'scale': 'xscale',
        ...chartSettings.xAxis,
        labelLimit: chartSettings.xAxis.labelSize,
      },
      yAxis,
    ],
    legends: [],
    'marks': [
      barMark,

  };

  const needsLegend = seriesField || settings.yChannel.fields.length > 1;
  // TODO: No legend for sparks
  let maxCharCt = 0;
  if (needsLegend) {
    if (seriesField) {
      const meta = metadata.field(seriesField);
      maxCharCt = meta.maxString?.length ?? 0;
      maxCharCt = Math.max(maxCharCt, seriesField.name.length);
    } else {
      maxCharCt = settings.yChannel.fields.reduce(
        (max, f) => Math.max(max, f.length),
        maxCharCt
      );
    }

    const legendSize = Math.min(
      LEGEND_MAX,
      chartSettings.totalWidth * LEGEND_PERC,
      maxCharCt * 10 + 20
    );
    const legendSettings: VegaSpec = {
      titleLimit: legendSize - 20,
      labelLimit: legendSize - 40,
      padding: 8,
      offset: 4,
    };

    spec.padding.right = legendSize;
  }

  // // todo: properly calculate max value for stacks
  // // will also need this to determine padding
  // if (settings.isStack) {
  //   spec.encoding.y.scale.domain = null;
  // }

  // Field driven series
  if (seriesField) {
    barMark.encode.update.fill.field = 'series';
    // spec.encoding.color.field = seriesFieldPath;
    // spec.encoding.color.legend = legendSettings;
  } else {
    barMark.encode.update.fill.value = '';
  }
  // if (!settings.isStack && seriesField) {
  //   spec.encoding.xOffset = {field: seriesFieldPath};
  // }

  // // Measure list series
  // if (settings.yChannel.fields.length > 1) {
  //   spec.transform = [
  //     {
  //       'fold': [...settings.yChannel.fields],
  //     },
  //   ];
  //   spec.encoding.y.field = 'value';
  //   spec.encoding.color.field = 'key';
  //   delete spec.encoding.color.datum;
  //   if (!settings.isStack) {
  //     spec.encoding.xOffset = {field: 'key'};
  //   }

  //   legendSettings.title = '';
  //   spec.encoding.color.legend = legendSettings;
  // }

  const injectData: DataInjector = (data, spec) => {
    // TODO: measure series...
    const mappedData = data.map(row => ({
      __source: row,
      x: row[xFieldPath],
      y: row[yFieldPath],
      series: seriesFieldPath ? row[seriesFieldPath] : '',
    }));
    spec.data[0].values = mappedData;
  };

  return {
    spec,
    specType: 'vega',
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: 'bar_chart',
    injectData,
    getTooltipData: (item: Item) => {
      if (item.datum) {
        const rowData = item.datum.__source;
        const tooltipData: ChartTooltipEntry[] = [];
        tooltipData.push({
          field: xField,
          fieldName: xField.name,
          value: rowData[xFieldPath],
        });

        if (seriesField)
          tooltipData.push({
            field: seriesField,
            fieldName: seriesField.name,
            value: rowData[seriesFieldPath!],
          });
        if (Object.prototype.hasOwnProperty.call(rowData, 'key')) {
          tooltipData.push({
            field: getFieldFromRootPath(explore, rowData.key),
            fieldName: rowData.key,
            value: rowData.value,
          });
          tooltipData[rowData.key] = rowData.value;
        } else {
          tooltipData.push({
            field: yField,
            fieldName: yField.name,
            value: rowData[yFieldPath],
          });
        }
        return tooltipData;
      }
      return null;
    },
  };
}
