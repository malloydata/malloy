import {Explore, Tag} from '@malloydata/malloy';
import {AreaChartSettings} from './get-area_chart-settings';
import {RenderResultMetadata, VegaChartProps, VegaSpec} from '../types';
import {getChartLayoutSettings} from '../chart-layout-settings';
import {getFieldFromRootPath} from '../plot/util';
import {scale} from 'vega';

const LEGEND_PERC = 0.4;
const LEGEND_MAX = 384;

export function generateAreaChartVegaLiteSpec(
  explore: Explore,
  settings: AreaChartSettings,
  metadata: RenderResultMetadata,
  chartTag: Tag
): VegaChartProps {
  const xFieldPath = settings.xChannel.fields.at(0);
  const yFieldPath = settings.yChannel.fields.at(0);
  const seriesFieldPath = settings.seriesChannel.fields.at(0);

  if (!xFieldPath) throw new Error('Malloy Area Chart: Missing x field');
  if (!yFieldPath) throw new Error('Malloy Area Chart: Missing y field');

  const xField = getFieldFromRootPath(explore, xFieldPath);
  const yField = getFieldFromRootPath(explore, yFieldPath);
  const seriesField = seriesFieldPath
    ? getFieldFromRootPath(explore, seriesFieldPath)
    : null;

  const isStack = !settings.isDiffChart;

  let yMin = Infinity;
  let yMax = -Infinity;
  const yFields = [...settings.yChannel.fields, ...settings.y2Channel.fields];
  for (const name of yFields) {
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
    chartType: 'area_chart',
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

  const areaMark: VegaSpec = {
    'mark': {
      'type': 'area',
      'interpolate': settings.interpolate,
      'line': !settings.isDiffChart,
    },
    'encoding': {
      'x': {
        'field': xFieldPath,
        'type': 'ordinal',
        'axis': {
          ...chartSettings.xAxis,
          labelLimit: chartSettings.xAxis.labelSize,
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
      'fillOpacity': {'value': 0.5},
      'opacity': {'value': 0.7},
    },
  };

  // Line mark for diff chart
  const baseDiffLineMark = structuredClone(areaMark);
  baseDiffLineMark.mark.type = 'line';

  // Points should only show if a specific area has only one point
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

  const needsLegend =
    settings.isDimensionalSeries ||
    settings.isMeasureSeries ||
    settings.isDiffChart;
  // TODO: No legend for sparks
  let maxCharCt = 0;
  if (needsLegend) {
    if (settings.isDimensionalSeries && seriesField) {
      const meta = metadata.field(seriesField);
      maxCharCt = meta.maxString?.length ?? 0;
      maxCharCt = Math.max(maxCharCt, seriesField.name.length);
    } else {
      maxCharCt = yFields.reduce(
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

  // Field driven series
  if (settings.isDimensionalSeries && seriesField) {
    areaMark.encoding.color.field = seriesFieldPath;
    areaMark.encoding.color.legend = legendSettings;
    pointMark.encoding.color.field = seriesFieldPath;
  } else {
    areaMark.encoding.color.datum = '';
    pointMark.encoding.color.datum = '';
  }

  // TODO: figure this out..
  if (isStack) {
    areaMark.encoding.y.scale.domain = null;
  }

  // Measure list series
  if (settings.isMeasureSeries) {
    areaMark.transform = [
      {
        'fold': [...settings.yChannel.fields],
      },
    ];
    areaMark.encoding.y.field = 'value';
    areaMark.encoding.color.field = 'key';
    delete areaMark.encoding.color.datum;

    pointMark.transform = [
      {
        'fold': [...settings.yChannel.fields],
      },
    ];
    pointMark.encoding.y.field = 'value';
    pointMark.encoding.color.field = 'key';
    delete pointMark.encoding.color.datum;

    legendSettings.title = '';
    areaMark.encoding.color.legend = legendSettings;
    areaMark.encoding.y.axis.title = '';
  }

  // Strea graph
  if (settings.isStreamGraph) {
    areaMark.encoding.y.stack = 'center';
    areaMark.encoding.y.axis = null;
    areaMark.encoding.x.axis.grid = true;
    areaMark.mark.line = false;
    areaMark.encoding.opacity = {'value': 1};
    areaMark.encoding.fillOpacity = {'value': 1};
  }

  // Diff chart
  if (settings.isDiffChart) {
    areaMark.encoding.y2 = {
      'field': settings.y2Channel.fields.at(0),
    };
  }

  const layers = [areaMark];

  // Should we even allow diff charts that are dimensional series? Or just ignore the y2?
  if (settings.isDiffChart && !settings.isDimensionalSeries) {
    baseDiffLineMark.transform = [
      {
        'fold': [...yFields],
      },
    ];
    baseDiffLineMark.encoding.y.field = 'value';
    baseDiffLineMark.encoding.strokeDash = {
      field: 'key',
      legend: legendSettings,
    };
    legendSettings.title = '';
    areaMark.encoding.color.legend = null;
    areaMark.encoding.y.axis.title = '';
    baseDiffLineMark.encoding.y.axis.title = '';
    areaMark.encoding.y2 = {
      'field': settings.y2Channel.fields.at(0),
    };
    layers.push(baseDiffLineMark);
  }

  const padding = chartSettings.padding;
  if (needsLegend) padding.right = legendSize;

  const spec: VegaSpec = {
    '$schema': 'https://vega.github.io/schema/vega-lite/v5.json',
    'width': chartSettings.plotWidth,
    'height': chartSettings.plotHeight,
    'autosize': {
      type: 'none',
      resize: true,
      contains: 'content',
    },
    'padding': padding,
    'data': {'values': []},
    'params': [{'name': 'dataLength', 'expr': "length(data('source_0'))"}],
    'layer': layers,
  };

  return {
    spec,
    specType: 'vega-lite',
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: 'area_chart',
  };
}
