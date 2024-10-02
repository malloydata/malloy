import {Explore, Tag} from '@malloydata/malloy';
import {LineChartSettings} from './get-line_chart-settings';
import {RenderResultMetadata, VegaChartProps, VegaSpec} from '../types';
import {getChartLayoutSettings} from '../chart-layout-settings';
import {getFieldFromRootPath} from '../plot/util';
import {scale} from 'vega';

const LEGEND_PERC = 0.4;
const LEGEND_MAX = 384;

export function generateLineChartVegaLiteSpec(
  explore: Explore,
  settings: LineChartSettings,
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

  const yDomainMin = settings.zeroBaseline ? Math.min(0, yMin) : yMin;
  const yDomainMax = settings.zeroBaseline ? Math.max(0, yMax) : yMax;

  const chartSettings = getChartLayoutSettings(explore, metadata, chartTag, {
    xField,
    yField,
    chartType: 'line_chart',
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

  const yScale = scale('linear')()
    .domain([yDomainMin, yDomainMax])
    .nice()
    .range([chartSettings.plotHeight, 0]);
  const sharedYDomain = yScale.domain();

  // todo: make this based on data type of x? if continuous axis, use asc/desc?
  const xSort = shouldShareXDomain ? [...xMeta.values] : null;

  const lineMark: VegaSpec = {
    'mark': {'type': 'line', 'interpolate': settings.interpolate},
    'encoding': {
      'x': {
        'field': xFieldPath,
        'type': 'ordinal',
        'axis': {
          ...chartSettings.xAxis,
          labelLimit: chartSettings.xAxis.labelLimit,
          title: settings.xChannel.fields.join(', '),
        },
        'scale': {
          'domain': shouldShareXDomain ? [...xMeta.values] : null,
        },

        'sort': xSort,
      },
      'y': {
        'field': yFieldPath,
        'type': 'quantitative',
        'axis': chartSettings.yAxis.hidden
          ? null
          : {
              ...chartSettings.yAxis,
              labelLimit: chartSettings.yAxis.width + 10,
              title: settings.yChannel.fields.join(', '),
            },
        'scale': {
          'domain': chartTag.has('y', 'independent') ? null : sharedYDomain,
        },
      },
      'color': {
        'scale': {
          'domain': shouldShareSeriesDomain ? [...seriesMeta!.values] : null,
          'range': 'category',
        },
      },
    },
  };

  // Points should only show if a specific line has only one point
  // The transformations to accomplish this are different when doing a field driven series vs. a measure list series
  const pointMark: VegaSpec = {
    'mark': {
      'type': 'point',
      'filled': true,
      'size': 64,
    },
    'encoding': {
      'x': {
        'field': seriesFieldPath ? `values.0.${xFieldPath}` : xFieldPath,
        'type': 'ordinal',
        'sort': xSort,
      },
      'y': {
        'field': seriesFieldPath ? `values.0.${yFieldPath}` : yFieldPath,
        'type': 'quantitative',
      },
      'color': {
        'scale': {
          'domain': shouldShareSeriesDomain ? [...seriesMeta!.values] : null,
          'range': 'category',
        },
      },
    },
    'transform': seriesFieldPath
      ? [
          {
            'aggregate': [
              {
                'op': 'count',
                'field': xFieldPath,
                'as': 'groupCount',
              },
              {'op': 'min', 'field': xFieldPath, 'as': xFieldPath},
              {'op': 'values'},
            ],
            'groupby': [seriesFieldPath],
          },
          {
            'filter': 'datum.groupCount == 1',
          },
        ]
      : [
          {
            'filter': 'dataLength === 1',
          },
        ],
  };

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
    'params': [{'name': 'dataLength', 'expr': "length(data('source_0'))"}],
    'layer': [lineMark, pointMark],
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
  const legendSettings = () => ({
    titleLimit: legendSize - 20,
    labelLimit: legendSize - 40,
    padding: 8,
    offset: 4,
  });

  if (needsLegend) spec.padding.right = legendSize;

  // Field driven series
  if (seriesField) {
    lineMark.encoding.color.field = seriesFieldPath;
    lineMark.encoding.color.legend = legendSettings();
    pointMark.encoding.color.field = seriesFieldPath;
  } else {
    lineMark.encoding.color.datum = '';
    pointMark.encoding.color.datum = '';
  }

  // Measure list series
  if (settings.yChannel.fields.length > 1) {
    spec.repeat = {'layer': [...settings.yChannel.fields]};
    spec.spec = {
      layer: [...spec.layer],
    };
    spec.layer = undefined;
    lineMark.encoding.y.field = {'repeat': 'layer'};
    lineMark.encoding.color = {
      'datum': {'repeat': 'layer'},
      'title': '',
      'legend': legendSettings(),
    };
    pointMark.encoding.y.field = {'repeat': 'layer'};
    pointMark.encoding.color = {
      'datum': {'repeat': 'layer'},
      'title': '',
      'legend': legendSettings(),
    };
  }

  return {
    spec,
    specType: 'vega-lite',
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: 'line_chart',
  };
}
