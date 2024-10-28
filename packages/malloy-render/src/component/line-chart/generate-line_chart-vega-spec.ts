/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {DateField, Explore, Tag, TimestampField} from '@malloydata/malloy';
import {
  DataInjector,
  MalloyVegaDataRecord,
  RenderResultMetadata,
  VegaChartProps,
  VegaSpec,
} from '../types';
import {LineChartSettings} from './get-line_chart-settings';
import {getFieldFromRootPath, getFieldReferenceId} from '../plot/util';
import {getChartLayoutSettings} from '../chart-layout-settings';
import {renderTimeString} from '../render-time';
import {createMeasureAxis} from '../vega/measure-axis';

type LineDataRecord = {
  x: string | number;
  y: number;
  series: string;
} & MalloyVegaDataRecord;

const LEGEND_PERC = 0.4;
const LEGEND_MAX = 384;

// Helper to invert mapping for object where values are unique
function invertObject(obj: Record<string, string>): Record<string, string> {
  const inverted: Record<string, string> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      inverted[obj[key]] = key;
    }
  }
  return inverted;
}

export function generateLineChartVegaSpec(
  explore: Explore,
  settings: LineChartSettings,
  metadata: RenderResultMetadata,
  chartTag: Tag
): VegaChartProps {
  /**************************************
   *
   * Chart data fields
   *
   *************************************/
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

  const xRef = getFieldReferenceId(xField);
  const yRef = getFieldReferenceId(yField);
  const seriesRef = seriesField && getFieldReferenceId(seriesField);

  const xMeta = metadata.field(xField);
  const seriesMeta = seriesField ? metadata.field(seriesField) : null;

  // Map y fields to ref ids
  const yRefsMap = settings.yChannel.fields.reduce((map, fieldPath) => {
    const field = getFieldFromRootPath(explore, fieldPath);
    return {
      ...map,
      [fieldPath]: getFieldReferenceId(field),
    };
  }, {});
  // Map ref ids to y fields
  const yRefsMapInverted = invertObject(yRefsMap);

  const isDimensionalSeries = Boolean(seriesField);
  const isMeasureSeries = Boolean(settings.yChannel.fields.length > 1);
  const hasSeries = isDimensionalSeries || isMeasureSeries;

  // Unique brush event source ids for this chart instance
  const brushXSourceId = 'brush-x_' + crypto.randomUUID();
  const brushSeriesSourceId = 'brush-series_' + crypto.randomUUID();
  const brushMeasureSourceId = 'brush-measure_' + crypto.randomUUID();
  const brushMeasureRangeSourceId =
    'brush-measure-range_' + crypto.randomUUID();

  /**************************************
   *
   * Chart layout
   *
   *************************************/
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

  // x axes across rows should auto share when distinct values <=20, unless user has explicitly set independent setting
  const autoSharedX = xMeta.values.size <= 20;
  const forceSharedX = chartTag.text('x', 'independent') === 'false';
  const forceIndependentX = chartTag.has('x', 'independent') && !forceSharedX;
  const shouldShareXDomain =
    forceSharedX || (autoSharedX && !forceIndependentX);

  /**************************************
   *
   * Chart marks
   *
   *************************************/
  const yAxis = !chartSettings.yAxis.hidden
    ? createMeasureAxis({
        type: 'y',
        title: settings.yChannel.fields.join(', '),
        tickCount: chartSettings.yAxis.tickCount ?? 'ceil(height/40)',
        labelLimit: chartSettings.yAxis.width + 10,
        // Use first y number style for axis labels
        fieldPath: yFieldPath,
        fieldRef: yRef,
        brushMeasureRangeSourceId,
        axisSettings: chartSettings.yAxis,
      })
    : null;

  const marks = [];

  const seriesGroupMark: VegaSpec = {
    name: 'series_group',
    from: {
      facet: {
        data: 'values',
        name: 'series_facet',
        groupby: ['series'],
        //
        aggregate: {
          ops: ['count'],
          as: ['count'],
        },
      },
    },
    type: 'group',
    interactive: false,
    marks: [],
  };

  const lineMark: VegaSpec = {
    name: 'lines',
    type: 'line',
    from: {
      data: 'series_facet',
    },
    'encode': {
      'enter': {
        'x': {'scale': 'xscale', 'field': 'x'},
        'y': {'scale': 'yscale', 'field': 'y'},
        'stroke': {'scale': 'color', 'field': 'series'},
        'strokeWidth': {'value': 2},
      },
      'update': {
        // 'interpolate': {'signal': 'interpolate'},
        'strokeOpacity': {'value': 1},
      },
      'hover': {
        'strokeOpacity': {'value': 0.5},
      },
    },
  };

  const highlightGroupMark: VegaSpec = {
    name: 'highlight_group',
    from: {
      facet: {
        data: 'values',
        name: 'x_facet',
        groupby: ['x'],
        //
        aggregate: {
          ops: ['count'],
          as: ['count'],
        },
      },
    },
    type: 'group',
    interactive: false,
    encode: {
      enter: {
        x: {
          scale: 'xscale',
          field: 'x',
        },
      },
    },
    marks: [
      {
        name: 'x_highlight',
        type: 'rule',
        from: {
          data: 'x_facet',
        },
        zindex: 1,
        encode: {
          enter: {
            x: {
              value: 0,
            },
            y: {
              value: 0,
            },
            y2: {signal: 'height'},
          },
          update: {
            stroke: {value: '#4c72ba'},
            fill: {
              value: '#4c72ba',
            },
            strokeOpacity: [
              {
                test: 'brushXIn ? indexof(brushXIn,datum.x) > -1 : false',
                value: 0.2,
              },
              {value: 0},
            ],
          },
        },
      },
      {
        name: 'mid_points',
        'type': 'symbol',
        'zindex': 1,
        'from': {'data': 'x_facet'},
        'interactive': false,
        'encode': {
          'enter': {
            'fill': {'value': 'black'},
            'size': {'value': 36},
            'x': {value: 0},
            'y': {signal: 'height /2'},
          },
        },
      },
      {
        'type': 'path',
        'from': {'data': 'mid_points'},
        'encode': {
          'enter': {
            'stroke': {'value': 'firebrick'},
            'fill': {'value': 'transparent'},
          },
          'hover': {
            fill: {value: 'rgba(0,0,0,0.25)'},
          },
        },
        'transform': [
          {
            'type': 'voronoi',
            'x': 'datum.x',
            'y': 'datum.y',
            'size': [{'signal': 'width'}, {'signal': 'height'}],
          },
        ],
      },
    ],
  };

  const pointMarks: VegaSpec = {
    name: 'points',
    type: 'symbol',
    from: {
      data: 'series_facet',
    },
    'encode': {
      'enter': {
        'x': {'scale': 'xscale', 'field': 'x'},
        'y': {'scale': 'yscale', 'field': 'y'},
        'fill': {'scale': 'color', 'field': 'series'},
      },
      'update': {
        'fillOpacity': [
          {
            test: 'brushXIn ? indexof(brushXIn,datum.x) > -1 : false',
            value: 1,
          },
          {'signal': 'item.mark.group.datum.count > 1 ? 0 : 1'},
        ],
      },
    },
  };

  seriesGroupMark.marks.push(lineMark);
  seriesGroupMark.marks.push(pointMarks);

  marks.push(seriesGroupMark, highlightGroupMark);

  // Source data and transforms
  const valuesData: VegaSpec = {name: 'values', values: [], transform: []};
  // For measure series, unpivot the measures into the series column
  if (isMeasureSeries) {
    // Pull the series values from the source record, then remap the names to remove __source
    valuesData.transform.push({
      type: 'fold',
      fields: settings.yChannel.fields.map(f => `__source.${f}`),
      as: ['series', 'y'],
    });
    valuesData.transform.push({
      type: 'formula',
      as: 'series',
      expr: "replace(datum.series, '__source.', '')",
    });
  }

  /**************************************
   *
   * Chart signals
   *
   *************************************/

  // Base signals
  const signals: VegaSpec[] = [
    {
      name: 'malloyExplore',
    },
    {
      name: 'xFieldRefId',
      value: xRef,
    },
    {
      name: 'seriesFieldRefId',
      value: seriesRef,
    },
    {
      name: 'measureFieldRefId',
      value: yRef,
    },
    {
      name: 'yRefsMap',
      value: yRefsMap,
    },
    {
      name: 'yRefToFieldPath',
      value: yRefsMapInverted,
    },
    {
      name: 'yRefsList',
      value: Object.values(yRefsMap),
    },
    {
      name: 'brushXSourceId',
      value: brushXSourceId,
    },
    {
      name: 'brushSeriesSourceId',
      value: brushSeriesSourceId,
    },
    {
      name: 'brushMeasureSourceId',
      value: brushMeasureSourceId,
    },
    // Brushes coming in from external data store
    {
      name: 'brushIn',
      value: [],
    },

    {
      name: 'brushXIn',
      update: 'getMalloyBrush(brushIn, xFieldRefId)',
    },
    {
      name: 'brushSeriesIn',
      update: 'getMalloyBrush(brushIn, seriesFieldRefId)',
    },
    {
      name: 'brushMeasureIn',
      update: 'getMalloyBrush(brushIn, yRefsList, \'measure\') || "empty"',
    },
    {
      name: 'brushMeasureRangeIn',
      update:
        "getMalloyBrush(brushIn, measureFieldRefId, 'measure-range') || null",
    },
    {
      name: 'brushMeasureListIn',
      update: isMeasureSeries
        ? "pluck(getMalloyMeasureBrushes(brushIn, yRefsList, yRefToFieldPath),'fieldPath')"
        : '[]',
    },
  ];

  /**************************************
   *
   * Chart spec
   *
   *************************************/
  const spec: VegaSpec = {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
    width: chartSettings.plotWidth,
    height: chartSettings.plotHeight,
    autosize: {
      type: 'none',
      resize: true,
      contains: 'content',
    },
    padding: chartSettings.padding,
    data: [valuesData],
    scales: [
      {
        name: 'xscale',
        type: 'point',
        domain: shouldShareXDomain
          ? [...xMeta.values]
          : {data: 'values', field: 'x'},
        range: 'width',
        paddingOuter: 0.05,
        // round: true,
      },
      {
        name: 'yscale',
        nice: true,
        range: 'height',
        zero: settings.zeroBaseline,
        domain: chartSettings.yScale.domain ?? {data: 'values', field: 'y'},
        // settings.isStack
        //   ? {data: 'values', field: 'y1'}
        //   : chartSettings.yScale.domain ?? {data: 'values', field: 'y'},
      },
      {
        name: 'color',
        type: 'ordinal',
        range: 'category',
        domain: {
          data: 'values',
          field: 'series',
        },
        // shouldShareSeriesDomain
        //   ? [...seriesMeta!.values]
        //   : {
        //       data: 'values',
        //       field: 'series',
        //     },
      },
      // {
      //   name: 'xOffset',
      //   type: 'band',
      //   domain: shouldShareSeriesDomain
      //     ? [...seriesMeta!.values]
      //     : {data: 'values', field: 'series'},
      //   range: {
      //     signal: `[0,bandwidth('xscale') * ${1 - barGroupPadding}]`,
      //   },
      // },
    ],

    axes: [
      {
        orient: 'bottom',
        scale: 'xscale',
        title: xFieldPath,
        ...chartSettings.xAxis,
        // encode: {
        //   labels: {
        //     update: {
        //       fillOpacity: [
        //         {
        //           test: 'brushXIn ? indexof(brushXIn,datum.value) === -1 : false',
        //           value: 0.35,
        //         },
        //         {
        //           value: 1,
        //         },
        //       ],
        //     },
        //   },
        // },
      },
      ...(yAxis ? [yAxis.axis] : []),
    ],
    legends: [],
    marks,
    signals,
  };

  const injectData: DataInjector = (field, data, spec) => {
    // Capture dates as strings for now. TODO time axes
    const dateTimeFields = field.allFields.filter(
      f => f.isAtomicField() && (f.isDate() || f.isTimestamp())
    ) as (DateField | TimestampField)[];
    data.forEach(row => {
      dateTimeFields.forEach(f => {
        const value = row[f.name];
        if (typeof value === 'number' || typeof value === 'string')
          row[f.name] = renderTimeString(
            new Date(value),
            f.isDate(),
            f.timeframe
          );
      });
    });

    // Map data fields to bar chart properties
    const mappedData = data.map(row => ({
      __source: row,
      x: row[xFieldPath],
      y: row[yFieldPath],
      series: seriesFieldPath ? row[seriesFieldPath] : yFieldPath,
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
    chartType: 'line_chart',
    injectData,
    getTooltipData(item, view) {
      if (item.mark.name === 'points') console.log(item);
      return null;
    },
  };
}
