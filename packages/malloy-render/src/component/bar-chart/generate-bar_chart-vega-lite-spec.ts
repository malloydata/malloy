import {Explore, Tag} from '@malloydata/malloy';
import {BarChartSettings} from './get-bar_chart-settings';
import {
  ChartTooltipEntry,
  RenderResultMetadata,
  VegaChartProps,
  VegaSpec,
} from '../types';
import {getChartLayoutSettings} from '../chart-layout-settings';
import {getFieldFromRootPath} from '../plot/util';
import {Item} from 'vega';

const LEGEND_PERC = 0.4;
const LEGEND_MAX = 384;

export function generateBarChartVegaLiteSpec(
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
    'data': {'values': []},
    'mark': {'type': 'bar'},
    'encoding': {
      'x': {
        'field': xFieldPath,
        'type': 'ordinal',
        'axis': {
          ...chartSettings.xAxis,
          labelLimit: chartSettings.xAxis.labelSize,
        },
        'scale': {
          'domain': shouldShareXDomain ? [...xMeta.values] : null,
        },
      },
      'y': {
        'field': yFieldPath,
        'type': 'quantitative',
        'axis': chartSettings.yAxis.hidden
          ? null
          : {
              ...chartSettings.yAxis,
              labelLimit: chartSettings.yAxis.width + 10,
            },
        'scale': chartSettings.yScale,
      },
      'color': {
        'scale': {
          'domain': shouldShareSeriesDomain ? [...seriesMeta!.values] : null,
          'range': 'category',
        },
      },
    },
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

  if (needsLegend) spec.padding.right = legendSize;

  // todo: properly calculate max value for stacks
  // will also need this to determine padding
  if (settings.isStack) {
    spec.encoding.y.scale.domain = null;
  }

  // Field driven series
  if (seriesField) {
    spec.encoding.color.field = seriesFieldPath;
    spec.encoding.color.legend = legendSettings;
  } else {
    spec.encoding.color.datum = '';
  }
  if (!settings.isStack && seriesField) {
    spec.encoding.xOffset = {field: seriesFieldPath};
  }

  // Measure list series
  if (settings.yChannel.fields.length > 1) {
    spec.transform = [
      {
        'fold': [...settings.yChannel.fields],
      },
    ];
    spec.encoding.y.field = 'value';
    spec.encoding.color.field = 'key';
    delete spec.encoding.color.datum;
    if (!settings.isStack) {
      spec.encoding.xOffset = {field: 'key'};
    }

    legendSettings.title = '';
    spec.encoding.color.legend = legendSettings;
  }

  return {
    spec,
    specType: 'vega-lite',
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: 'bar_chart',
    getTooltipData: (item: Item) => {
      if (item.datum) {
        const tooltipData: ChartTooltipEntry[] = [];
        tooltipData.push({
          field: xField,
          fieldName: xField.name,
          value: item.datum[xFieldPath],
        });

        if (seriesField)
          tooltipData.push({
            field: seriesField,
            fieldName: seriesField.name,
            value: item.datum[seriesFieldPath!],
          });
        if (Object.prototype.hasOwnProperty.call(item.datum, 'key')) {
          tooltipData.push({
            field: getFieldFromRootPath(explore, item.datum.key),
            fieldName: item.datum.key,
            value: item.datum.value,
          });
          tooltipData[item.datum.key] = item.datum.value;
        } else {
          tooltipData.push({
            field: yField,
            fieldName: yField.name,
            value: item.datum[yFieldPath],
          });
        }
        return tooltipData;
      }
      return null;
    },
  };
}
