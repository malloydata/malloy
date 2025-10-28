/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import type {
  ChartTooltipEntry,
  MalloyDataToChartDataHandler,
  MalloyVegaDataRecord,
  VegaChartProps,
  VegaPadding,
} from '@/component/types';
import {getChartLayoutSettings} from '@/component/chart/chart-layout-settings';
import {createMeasureAxis} from '@/component/vega/measure-axis';
import type {
  Axis,
  Config,
  Data,
  GroupMark,
  Item,
  Legend,
  LineMark,
  Mark,
  RuleMark,
  Signal,
  Spec,
  SymbolMark,
} from 'vega';
import {
  renderNumericField,
  renderDateTimeField,
} from '@/component/render-numeric-field';
import {getMarkName} from '@/component/vega/vega-utils';
import {getCustomTooltipEntries} from '@/component/bar-chart/get-custom-tooltips-entries';
import type {CellValue, RecordCell} from '@/data_tree';
import {Field} from '@/data_tree';
import {NULL_SYMBOL, type RenderTimeStringOptions} from '@/util';
import {convertLegacyToVizTag} from '@/component/tag-utils';
import type {RenderMetadata} from '@/component/render-result-metadata';
import type {LineChartPluginInstance} from '@/plugins/line-chart/line-chart-plugin';

type LineDataRecord = {
  x: string | number;
  y: number;
  series: string;
} & MalloyVegaDataRecord;

const LEGEND_PERC = 0.4;
const LEGEND_MAX = 384;
const DEFAULT_MAX_SERIES = 12;
const MAX_DATA_POINTS = 5000;

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

// Helper to get extraction format for renderTimeString based on timeframe
function getExtractionFormat(
  timeframe?: string
): RenderTimeStringOptions['extractFormat'] {
  if (!timeframe) return 'month-day';
  if (timeframe.includes('month')) return 'month';
  if (timeframe.includes('quarter')) return 'quarter';
  if (timeframe.includes('week')) return 'week';
  return 'month-day';
}

export interface LineChartSettings {
  xChannel: {
    fields: string[];
  };
  yChannel: {
    fields: string[];
  };
  seriesChannel: {
    fields: string[];
  };
  zeroBaseline: boolean;
  interactive: boolean;
}

export function generateLineChartVegaSpecV2(
  metadata: RenderMetadata,
  plugin: LineChartPluginInstance,
  vegaConfig?: Config
): VegaChartProps {
  const pluginMetadata = plugin.getMetadata();
  const settings = pluginMetadata.settings;
  const {getTopNSeries, field: explore} = plugin;
  const tag = convertLegacyToVizTag(explore.tag);
  const chartTag = tag.tag('viz');
  if (!chartTag)
    throw new Error(
      'Malloy Line Chart: Tried to render a line chart, but no viz=line tag was found'
    );

  /**************************************
   *
   * Chart data fields
   *
   *************************************/
  const xFieldPath = settings.xChannel.fields.at(0);
  const yFieldPath = settings.yChannel.fields.at(0);
  const seriesFieldPath = settings.seriesChannel.fields.at(0);

  if (!xFieldPath) throw new Error('Malloy Line Chart: Missing x field');
  if (!yFieldPath) throw new Error('Malloy Line Chart: Missing y field');

  const xField = explore.fieldAt(xFieldPath);
  const xIsDateorTime = xField.isTime();
  const xIsBoolean = xField.isBoolean();
  const hasNullXValues = xField.valueSet.has(NULL_SYMBOL);
  const hasNullTimeValues = xIsDateorTime && hasNullXValues;
  const xScaling = (dataAccessor: string) => {
    return hasNullTimeValues
      ? `datum.isNull ? scale('null_x_scale', ${dataAccessor}) : scale('xscale', ${dataAccessor})`
      : `scale('xscale', ${dataAccessor})`;
  };

  const yField = explore.fieldAt(yFieldPath);
  let seriesField = seriesFieldPath ? explore.fieldAt(seriesFieldPath) : null;

  // Use synthetic series field for YoY mode
  if (settings.mode === 'yoy' && plugin.syntheticSeriesField) {
    seriesField = plugin.syntheticSeriesField;
  }

  const xRef = xField.referenceId;
  const yRef = yField.referenceId;
  const seriesRef = seriesField?.referenceId;

  const extractFormat =
    settings.mode === 'yoy'
      ? getExtractionFormat(xField.isTime() ? xField.timeframe : undefined)
      : undefined;

  // Map y fields to ref ids
  const yRefsMap = settings.yChannel.fields.reduce((map, fieldPath) => {
    const field = explore.fieldAt(fieldPath);
    return {
      ...map,
      [fieldPath]: field.referenceId,
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
    const field = explore.fieldAt(name);
    const min = field.minNumber;
    if (min !== undefined) yMin = Math.min(yMin, min);
    const max = field.maxNumber;
    if (max !== undefined) yMax = Math.max(yMax, max);
  }

  const yDomainMin = settings.zeroBaseline ? Math.min(0, yMin) : yMin;
  const yDomainMax = settings.zeroBaseline ? Math.max(0, yMax) : yMax;

  const seriesSettingsLimit = settings.seriesChannel.limit;
  const maxSeries =
    typeof seriesSettingsLimit === 'number'
      ? seriesSettingsLimit
      : DEFAULT_MAX_SERIES;
  const isLimitingSeries = Boolean(
    seriesField && seriesField.valueSet.size > maxSeries
  );

  const chartSettings = getChartLayoutSettings(explore, chartTag, {
    metadata, // No legacy metadata in V2
    xField,
    yField,
    chartType: 'line',
    getYMinMax: () => [yDomainMin, yDomainMax],
    // TODO: whats the use case for auto setting this with limited series? why does limiting series mean it should be independent? do we need an "auto" setting? like SeriesIndependence setting has?
    independentY: settings.yChannel.independent || isLimitingSeries,
    vegaConfig,
  });

  // x axes across rows should auto share when distinct values <=20, unless user has explicitly set independent setting
  const autoSharedX = xField.valueSet.size <= 20;
  const forceSharedX = settings.xChannel.independent === false;
  const forceIndependentX =
    settings.xChannel.independent === true && !forceSharedX;
  const shouldShareXDomain =
    forceSharedX || (autoSharedX && !forceIndependentX);

  // series legends across rows should auto share when distinct values <=20, unless user has explicitly set independent setting
  const autoSharedSeries = seriesField && seriesField.valueSet.size <= 20;
  const forceSharedSeries = settings.seriesChannel.independent === false;
  const forceIndependentSeries =
    settings.seriesChannel.independent === true && !forceSharedSeries;
  const shouldShareSeriesDomain =
    explore.isRoot() ||
    forceSharedSeries ||
    (autoSharedSeries && !forceIndependentSeries);

  const seriesSet = seriesField ? new Set(getTopNSeries?.(maxSeries)) : null;

  // TODO: spec needs to be responsive to data changes, eventually. so we don't have to rerender chart from scratch when data changes

  /**************************************
   *
   * Chart marks
   *
   *************************************/
  const yAxis = !chartSettings.yAxis.hidden
    ? createMeasureAxis({
        type: 'y',
        title: settings.yChannel.fields
          .map(f => explore.fieldAt(f).name)
          .join(', '),
        tickCount: chartSettings.yAxis.tickCount ?? 'ceil(height/40)',
        labelLimit: chartSettings.yAxis.width + 10,
        // Use first y number style for axis labels
        fieldPath: yFieldPath,
        fieldRef: yRef,
        brushMeasureRangeSourceId,
        axisSettings: chartSettings.yAxis,
        vegaConfig,
      })
    : null;

  const marks: Mark[] = [];

  const seriesGroupMark: GroupMark = {
    name: 'series_group',
    from: {
      facet: {
        // TODO how to make this reactive within spec
        data: hasNullTimeValues ? 'non_null_x_values' : 'values',
        name: 'series_facet',
        groupby: ['series'],
        aggregate: {
          fields: [''],
          ops: ['count'],
          as: ['count'],
        },
      },
    },
    type: 'group',
    interactive: false,
    marks: [],
  };

  const LINE_FADE_OPACITY = 0.35;

  const lineMark: LineMark = {
    name: 'lines',
    type: 'line',
    from: {
      data: 'series_facet',
    },
    encode: {
      enter: {
        x: {scale: 'xscale', field: 'x'},
        y: {scale: 'yscale', field: 'y'},
        strokeWidth: {value: 2},
      },
      update: {
        strokeOpacity: [
          {
            test: 'isValid(brushSeriesIn) && brushSeriesIn != datum.series',
            value: LINE_FADE_OPACITY,
          },
          {value: 1},
        ],
        stroke: [
          {
            test: 'isValid(brushSeriesIn) && brushSeriesIn != datum.series',
            value: '#ccc',
          },
          {scale: 'color', field: 'series'},
        ],
        // TODO bug in vega
        zindex: [
          {
            test: 'isValid(brushSeriesIn) && brushSeriesIn === datum.series',
            value: 10,
          },
          {value: 1},
        ],
      },
    },
  };

  const highlightRuleMark: RuleMark = {
    name: 'x_highlight_rule',
    type: 'rule',
    from: {
      data: 'x_data',
    },
    zindex: 1,
    interactive: false,
    encode: {
      enter: {
        x: {
          signal: xScaling('datum.x'),
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
            test: 'isValid(brushXIn) ? indexof(brushXIn,datum.x) > -1 : false',
            value: 0.2,
          },
          {value: 0},
        ],
      },
    },
  };

  // Use voronoi hit targets based on mid point of each x position so that it draws nicely spaced boxes
  // This works well with a point scale, where there aren't even bands around each point since first and last points don't have outer edge padding
  const xHitTargets: GroupMark = {
    name: 'x_hit_target_group',
    type: 'group',
    marks: [
      {
        name: 'mid_points',
        type: 'symbol',
        zindex: 1,
        from: {data: 'x_data'},
        interactive: false,
        encode: {
          enter: {
            fill: {value: 'transparent'},
            size: {value: 36},
            x: {signal: xScaling('datum.x')},
            y: {signal: 'height /2'},
          },
        },
      },
      {
        name: 'x_hit_target',
        type: 'path',
        from: {data: 'mid_points'},
        encode: {
          enter: {
            fill: {value: 'transparent'},
          },
        },
        transform: [
          {
            type: 'voronoi',
            x: 'datum.x',
            y: 'datum.y',
            size: [{'signal': 'width'}, {'signal': 'height'}],
          },
        ],
      },
    ],
  };

  // Drag bigger circles for targeting ref lines so user can more easily hit with mouse
  const refLineTargets: SymbolMark = {
    name: 'ref_line_targets',
    type: 'symbol',
    from: {
      data: 'values',
    },
    encode: {
      enter: {
        x: {signal: xScaling('datum.x')},
        y: {scale: 'yscale', field: 'y'},
        fill: {value: 'transparent'},
        size: {value: 256},
      },
    },
  };

  const seriesPointGroupMark: GroupMark = {
    name: 'series_point_group',
    from: {
      facet: {
        data: 'values',
        name: 'series_point_facet',
        groupby: ['series'],
        aggregate: {
          fields: [''],
          ops: ['count'],
          as: ['count'],
        },
      },
    },
    type: 'group',
    interactive: false,
    marks: [],
  };

  const pointMarks: SymbolMark = {
    name: 'points',
    type: 'symbol',
    from: {
      data: 'series_point_facet',
    },
    encode: {
      enter: {
        x: {
          signal: xScaling('datum.x'),
        },
        y: {scale: 'yscale', field: 'y'},
        fill: {scale: 'color', field: 'series'},
      },
      update: {
        fillOpacity: [
          {
            test: 'hasNullTimeValues && datum.isNull',
            value: 1,
          },
          {
            test: 'isValid(brushXIn) ? indexof(brushXIn,datum.x) > -1 : false',
            value: 1,
          },
          // If only one point in a line, show the point
          {signal: 'item.mark.group.datum.count > 1 ? 0 : 1'},
        ],
      },
    },
  };

  seriesGroupMark.marks!.push(lineMark);
  seriesPointGroupMark.marks!.push(pointMarks);

  marks.push(seriesGroupMark);
  marks.push(seriesPointGroupMark);

  if (settings.interactive) {
    if (yAxis) marks.push(...yAxis.interactiveMarks);
  }
  marks.push(highlightRuleMark, xHitTargets, refLineTargets);
  // TODO make reactive to data changes instead of hardcoding into spec
  if (hasNullTimeValues) {
    marks.push({
      name: 'null_axis_divider',
      type: 'rule',
      encode: {
        enter: {
          x: {signal: 'nullPlotStart'},
          y: {signal: 'height'},
          y2: {value: 0},
          // TODO pull from vega config?
          stroke: {value: '#bbb'},
          strokeWidth: {value: 0.5},
          strokeDash: {value: [8, 4]},
        },
      },
    });
  }

  // Source data and transforms
  const valuesData: Data = {
    name: 'values',
    values: [],
    transform: [
      {
        type: 'formula',
        expr: `datum.x === null || datum.x === "${NULL_SYMBOL}"`,
        as: 'isNull',
      },
    ],
  };

  const nonNullXValues: Data = {
    name: 'non_null_x_values',
    source: 'values',
    transform: [
      {
        type: 'filter',
        expr: `datum.x != null && datum.x != "${NULL_SYMBOL}"`,
      },
    ],
  };

  const xValuesAggregated: Data = {
    name: 'x_data',
    source: 'values',
    transform: [
      {
        type: 'aggregate',
        groupby: ['x'],
        fields: ['x'],
        ops: ['values'],
        as: ['v'],
      },
    ],
  };

  // For measure series, unpivot the measures into the series column
  if (isMeasureSeries) {
    // Pull the series values from the source record, then remap the names to remove __values
    valuesData.transform!.push({
      type: 'fold',
      fields: settings.yChannel.fields.map(
        f => `__values.${explore.fieldAt(f).name}`
      ),
      as: ['series', 'y'],
    });
    valuesData.transform!.push({
      type: 'formula',
      as: 'series',
      expr: "replace(datum.series, '__values.', '')",
    });
  }

  /**************************************
   *
   * Chart signals
   *
   *************************************/

  const interactiveSignals = yAxis ? yAxis.interactiveSignals : [];

  // Base signals
  const signals: Signal[] = [
    {
      name: 'malloyExplore',
    },
    // TODO make this reactive to data, so can reuse same spec & view with different data
    {name: 'hasNullTimeValues', value: hasNullTimeValues},
    {
      name: 'mainPlotWidth',
      update:
        'hasNullTimeValues ? clamp(0.95*width, width-48, width-32) : width',
    },
    {
      name: 'nullPlotStart',
      update: 'hasNullTimeValues ? mainPlotWidth + 16 : 0',
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
      update: "getMalloyBrush(brushIn, yRefsList, 'measure') || null",
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
  if (settings.interactive) {
    // Interactive signals
    signals.push(
      {
        name: 'brushX',
        on: xRef
          ? [
              {
                events: '@x_hit_target:mouseover',
                update:
                  "{ fieldRefId: xFieldRefId, value: [datum.datum.x], sourceId: brushXSourceId, type: 'dimension'}",
              },

              {
                events: '@ref_line_targets:mouseover',
                update:
                  "{ fieldRefId: xFieldRefId, value: [datum.x], sourceId: brushXSourceId, type: 'dimension'}",
              },
              {
                events: '@x_hit_target:mouseout',
                update: 'null',
              },
              {
                events: '@ref_line_targets:mouseout',
                update: 'null',
              },
            ]
          : [],
      },
      {
        name: 'brushSeries',
        on:
          isDimensionalSeries && seriesRef
            ? [
                {
                  events: '@ref_line_targets:mouseover',
                  update:
                    "{ fieldRefId: seriesFieldRefId, value: datum.series, sourceId: brushSeriesSourceId, type: 'dimension' }",
                },
                {
                  events: '@ref_line_targets:mouseout',
                  update: 'null',
                },
                {
                  events: '@legend_labels:mouseover, @legend_symbols:mouseover',
                  update:
                    "{ fieldRefId: seriesFieldRefId, value: datum.value, sourceId: brushSeriesSourceId, type: 'dimension' }",
                },
                {
                  events: '@legend_labels:mouseout, @legend_symbols:mouseout',
                  update: 'null',
                },
              ]
            : [],
      },
      {
        name: 'brushMeasure',
        on: yRef
          ? [
              {
                events: '@ref_line_targets:mouseover',
                update:
                  "{ fieldRefId: measureFieldRefId, value: [datum.y], sourceId: brushMeasureSourceId, type: 'measure'}",
              },
              ...(yAxis?.brushMeasureEvents ?? []),
              {
                events: '@ref_line_targets:mouseout',
                update: 'null',
              },
            ]
          : [],
      },

      // Export this chart's brushes. Series / measure brushes are debounced when set to empty to avoid flickering while moving mouse from one item to the next
      {
        name: 'brushOut',
        update:
          "[{ sourceId: brushXSourceId, data: brushX }, { sourceId: brushSeriesSourceId, data: brushSeries, debounce: { time: 100, strategy: 'on-empty' } }, { sourceId: brushMeasureSourceId, data: brushMeasure } ]",
      },
      ...interactiveSignals,
      {
        name: 'yIsBrushing',
        value: false,
      }
    );
  }

  /**************************************
   *
   * Chart spec
   *
   *************************************/
  const spec: Spec = {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
    width: chartSettings.plotWidth,
    height: chartSettings.plotHeight,
    autosize: {
      type: 'none',
      resize: true,
      contains: 'padding',
    },
    padding: {
      ...chartSettings.padding,
      bottom: chartSettings.xAxis.hidden ? 0 : chartSettings.xAxis.height,
    },
    data: [valuesData, nonNullXValues, xValuesAggregated],
    scales: [
      {
        name: 'xscale',
        type: xIsDateorTime ? 'utc' : 'point',
        domain:
          settings.mode === 'yoy'
            ? // For YoY mode, calculate domain from actual data
              {data: 'values', field: 'x'}
            : shouldShareXDomain
              ? xIsDateorTime
                ? [Number(xField.minValue), Number(xField.maxValue)]
                : xIsBoolean
                  ? [true, false]
                  : [...xField.valueSet]
              : {data: 'values', field: 'x'},
        range: [0, {signal: 'mainPlotWidth'}],
        paddingOuter: 0.05,
      },
      {
        name: 'null_x_scale',
        type: 'point',
        domain: [NULL_SYMBOL],
        range: [{signal: 'nullPlotStart'}, {signal: 'width'}],
      },
      {
        name: 'yscale',
        nice: true,
        range: 'height',
        zero: settings.zeroBaseline,
        domain: chartSettings.yScale.domain ?? {data: 'values', field: 'y'},
      },
      {
        name: 'color',
        type: 'ordinal',
        range: 'category',
        domain:
          isDimensionalSeries && shouldShareSeriesDomain && seriesSet
            ? [...seriesSet]
            : {
                data: 'values',
                field: 'series',
              },
      },
    ],
    axes: [
      {
        orient: 'bottom',
        scale: 'xscale',
        title: xField.name,
        labelOverlap: 'greedy',
        labelSeparation: 4,
        ...chartSettings.xAxis,
        encode: {
          ...(xIsDateorTime
            ? {
                labels: {
                  enter: {
                    text: {
                      signal: `renderMalloyTime(malloyExplore, '${xFieldPath}', datum.value, '${extractFormat}')`,
                    },
                  },
                  update: {
                    text: {
                      signal: `renderMalloyTime(malloyExplore, '${xFieldPath}', datum.value, '${extractFormat}')`,
                    },
                  },
                },
              }
            : {}),
        },
      },
      ...(hasNullTimeValues
        ? [
            {
              orient: 'bottom',
              scale: 'null_x_scale',
            } as Axis,
          ]
        : []),
      ...(yAxis ? [yAxis.axis] : []),
    ],
    legends: [],
    marks,
    signals,
  };

  // Legend
  let maxCharCt = 0;
  let legendSize = 0;
  if (hasSeries) {
    // Get legend dimensions
    if (isDimensionalSeries) {
      // This is for global; how to do across nests for local?
      if (seriesSet) {
        maxCharCt = [...seriesSet].reduce<number>(
          // TODO better handle the null symbol here
          (a, b) => Math.max(a, b?.toString().length ?? 1),
          0
        );
        maxCharCt = Math.max(maxCharCt, seriesField!.name.length);
      }
    } else {
      maxCharCt = settings.yChannel.fields.reduce(
        (max, f) => Math.max(max, f.length),
        maxCharCt
      );
    }

    // Limit legend size to a hard max, then percentage of chart width, then the max text size
    // TODO need better way to estimate size since vega config can change legend text formatting
    legendSize = Math.min(
      LEGEND_MAX,
      chartSettings.totalWidth * LEGEND_PERC,
      maxCharCt * 8 + 32
    );

    const legendSettings: Legend = {
      // Provide padding around legend entries
      titleLimit: legendSize - 20,
      labelLimit: legendSize - 40,
      padding: 8,
      offset: 4,
    };
    (spec.padding as VegaPadding).right = legendSize;
    spec.legends!.push({
      fill: 'color',
      // No title for measure list legends
      title: seriesField ? seriesField.name : '',
      orient: 'right',
      ...legendSettings,
      values:
        isDimensionalSeries && shouldShareSeriesDomain && seriesSet
          ? [...seriesSet]
          : undefined,
      encode: {
        entries: {
          name: 'legend_entries',
          interactive: true,
        },
        labels: {
          name: 'legend_labels',
          interactive: true,
          update: {
            fillOpacity: [
              {
                test: 'brushSeriesIn === datum.value',
                value: 1,
              },
              {
                test: 'isValid(brushSeriesIn) && brushSeriesIn != datum.value',
                value: 0.35,
              },
              ...(isMeasureSeries
                ? [
                    {
                      test: 'length(brushMeasureListIn) > 0 && indexof(brushMeasureListIn, datum.value) > -1',
                      value: 1,
                    },
                    {
                      test: 'length(brushMeasureListIn) > 0 && indexof(brushMeasureListIn, datum.value) === -1',
                      value: 0.35,
                    },
                  ]
                : []),
              {value: 1},
            ],
          },
        },
        symbols: {
          name: 'legend_symbols',
          interactive: true,
          update: {
            fillOpacity: [
              {
                test: 'brushSeriesIn === datum.value',
                value: 1,
              },
              {
                test: 'isValid(brushSeriesIn) && brushSeriesIn != datum.value',
                value: 0.35,
              },
              {value: 1},
            ],
          },
        },
      },
    });
  }

  const mapMalloyDataToChartData: MalloyDataToChartDataHandler = data => {
    const getXValue = (row: RecordCell) => {
      const cell = row.column(xField.name);
      return cell.isTime() ? cell.value.valueOf() : cell.value;
    };

    const getYoYTransformedData = (row: RecordCell) => {
      const cell = row.column(xField.name);
      if (!cell.isTime() || !cell.value) return null;

      const date = new Date(cell.value.valueOf());
      const year = date.getFullYear();

      // Create a normalized date for the same day/month but in a common year (2000)
      // This allows for proper time scaling on the x-axis
      let normalizedDate: Date;

      // Handle different granularities
      const timeframe = xField.isTime() ? xField.timeframe : undefined;
      if (timeframe?.includes('month')) {
        // For month-based data, use the first of the month
        normalizedDate = new Date(Date.UTC(2000, date.getUTCMonth(), 1));
      } else if (timeframe?.includes('quarter')) {
        // For quarter-based data, use the first month of the quarter
        const quarter = Math.floor(date.getUTCMonth() / 3);
        normalizedDate = new Date(Date.UTC(2000, quarter * 3, 1));
      } else if (timeframe?.includes('week')) {
        // For week-based data, calculate week of year
        const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const diff = date.getTime() - start.getTime();
        const weekOfYear = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
        normalizedDate = new Date(Date.UTC(2000, 0, 1 + weekOfYear * 7));
      } else {
        // For daily data, use month and day
        normalizedDate = new Date(
          Date.UTC(2000, date.getUTCMonth(), date.getUTCDate())
        );
      }

      return {
        originalDate: date,
        year: year.toString(),
        normalizedX: normalizedDate.valueOf(),
      };
    };

    // TODO: How to limit data across nested charts? Which are unaware of their data usage?
    //    this will only limit data per nested chart
    const mappedData: {
      __values: {[name: string]: CellValue};
      __row: RecordCell;
      x: CellValue;
      y: CellValue;
      series: CellValue;
    }[] = [];
    const localSeriesSet = new Set<string | number | boolean>();
    let yoyMinDate: number | undefined;
    let yoyMaxDate: number | undefined;
    function skipSeries(seriesVal: string | number | boolean) {
      if (seriesSet && (explore.isRoot() || shouldShareSeriesDomain)) {
        return !seriesSet.has(seriesVal);
      }
      if (localSeriesSet.size >= maxSeries && !localSeriesSet.has(seriesVal)) {
        return true;
      }
      localSeriesSet.add(seriesVal);
      return false;
    }

    // need to limit to max data points AFTER the series is filtered
    data.rows.forEach(row => {
      // Handle year-over-year mode
      if (settings.mode === 'yoy') {
        const yoyData = getYoYTransformedData(row);
        if (!yoyData) return; // Skip rows with invalid dates

        const isMissingY = row.column(yField.name).value === null;
        if (isMissingY) return; // Skip rows with missing y values

        // For YoY mode, manage year series separately
        if (
          localSeriesSet.size >= maxSeries &&
          !localSeriesSet.has(yoyData.year)
        ) {
          return; // Skip if we've reached max series and this year isn't already included
        }
        localSeriesSet.add(yoyData.year);

        // Track min/max dates for YoY mode
        const normalizedX = yoyData.normalizedX as number;
        if (yoyMinDate === undefined || normalizedX < yoyMinDate) {
          yoyMinDate = normalizedX;
        }
        if (yoyMaxDate === undefined || normalizedX > yoyMaxDate) {
          yoyMaxDate = normalizedX;
        }

        mappedData.push({
          __values: row.allCellValues(),
          __row: row,
          x: yoyData.normalizedX,
          y: row.column(yField.name).value,
          series: yoyData.year, // Year becomes the series
        });
        return;
      }

      // Normal mode processing
      let seriesVal = seriesField
        ? row.column(seriesField.name).value ?? NULL_SYMBOL
        : yField.name;
      // Limit # of series
      if (skipSeries(seriesVal)) {
        return;
      }
      // Filter out missing metric values
      const isMissingY = row.column(yField.name).value === null;
      if (isMissingY) {
        return;
      }
      // Map data fields to chart properties.  Handle undefined values properly.
      if (seriesVal === undefined || seriesVal === null) {
        seriesVal = NULL_SYMBOL;
      }

      mappedData.push({
        __values: row.allCellValues(),
        __row: row,
        x: getXValue(row) ?? NULL_SYMBOL,
        y: row.column(yField.name).value,
        series: seriesVal,
      });
    });

    const mappedAndLimitedData = mappedData.slice(0, MAX_DATA_POINTS);

    return {
      data: mappedAndLimitedData,
      isDataLimited: data.rows.length > mappedAndLimitedData.length,
      // Distinguish between limiting by record count and limiting by series count
      dataLimitMessage:
        seriesField && seriesField.valueSet.size > maxSeries
          ? `Showing ${maxSeries.toLocaleString()} of ${seriesField.valueSet.size.toLocaleString()} series`
          : '',
    };
  };

  // Memoize tooltip data
  const tooltipEntryMemo = new Map<Item, ChartTooltipEntry | null>();
  const tooltipItemCountLimit = 10;

  return {
    spec,
    // TODO refactor the padding mode to fit
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: 'line',
    chartTag,
    mapMalloyDataToChartData,
    getTooltipData(item, view) {
      if (tooltipEntryMemo.has(item)) {
        return tooltipEntryMemo.get(item)!;
      }
      const markName = getMarkName(item);
      let tooltipData: ChartTooltipEntry | null = null;
      let records: LineDataRecord[] = [];
      const colorScale = view.scale('color');
      const formatY = (rec: LineDataRecord) => {
        // If dimensional, use the first yField for formatting. Else the series value is the field path of the field to use
        const field = isDimensionalSeries
          ? yField
          : explore.fieldAt(
              seriesField ? Field.pathFromString(rec.series) : [rec.series]
            );

        const value = rec.y;
        return field.isBasic()
          ? renderNumericField(field, value)
          : String(value);
      };

      // Tooltip records for the highlighted points
      if (['x_hit_target', 'ref_line_targets'].includes(markName)) {
        let x = '';
        if (markName === 'x_hit_target') {
          x = item.datum.datum.x;
        } else {
          x = item.datum.x;
        }

        records = markName === 'x_hit_target' ? item.datum.datum.v : [];

        const title = xIsDateorTime
          ? x === NULL_SYMBOL
            ? NULL_SYMBOL
            : renderDateTimeField(xField, new Date(x), {
                isDate: xField.isDate(),
                timeframe: xField.isTime() ? xField.timeframe : undefined,
                extractFormat,
              })
          : x;

        const sortedRecords = [...records]
          .sort(
            (a, b) =>
              xIsDateorTime
                ? a.series.localeCompare(b.series) // Sort by year in ascending order for YoY mode
                : b.y - a.y // Sort by value in descending order for normal mode
          )
          .slice(0, tooltipItemCountLimit);

        tooltipData = {
          title: [title],
          entries: sortedRecords.map(rec => ({
            label: rec.series,
            value: formatY(rec),
            highlight: false,
            color: colorScale(rec.series),
            entryType: 'list-item',
          })),
        };
      }

      // Tooltip records for the actual points
      let highlightedSeries: string | null = null;
      if (item.datum && ['ref_line_targets'].includes(getMarkName(item))) {
        const itemData = item.datum;
        highlightedSeries = itemData.series;
        records = [];
        for (const sourceItem of item.mark.items) {
          const lineDataRecord = sourceItem.datum as LineDataRecord;
          if (lineDataRecord.x === itemData.x) {
            records.push(lineDataRecord);
          }
        }
        const title = xIsDateorTime
          ? itemData.x === NULL_SYMBOL
            ? NULL_SYMBOL
            : renderDateTimeField(xField, new Date(itemData.x), {
                isDate: xField.isDate(),
                timeframe: xField.isTime() ? xField.timeframe : undefined,
                extractFormat,
              })
          : itemData.x;

        // If the highlighted item is not included in the first ~20,
        // then it will probably be cut off.

        const sortedRecords = [...records]
          .sort(
            (a, b) =>
              xIsDateorTime
                ? a.series.localeCompare(b.series) // Sort by year in ascending order for YoY mode
                : b.y - a.y // Sort by value in descending order for normal mode
          )
          .filter(
            (item, index) =>
              index <= tooltipItemCountLimit ||
              item.series === highlightedSeries
          );

        tooltipData = {
          title: [title],
          entries: sortedRecords.map(rec => {
            return {
              label: rec.series,
              value: formatY(rec),
              highlight: highlightedSeries === rec.series,
              color: colorScale(rec.series),
              entryType: 'list-item',
            };
          }),
        };
      }

      const highlightedRecords = records.filter(
        rec => rec.series === highlightedSeries
      );

      // Custom tooltips can only be shown for lowest granularity of the data
      let customTooltipRecords: LineDataRecord[] = [];
      // Series can only show custom tooltips when a single highlighted record
      if (isDimensionalSeries && highlightedRecords.length === 1)
        customTooltipRecords = highlightedRecords;
      // If measure series, pick first measure record to pull custom tooltip data from
      else if (isMeasureSeries) customTooltipRecords = records.slice(0, 1);
      // Non series can only show custom tooltips when a single record
      else if (
        !isDimensionalSeries &&
        !isMeasureSeries &&
        records.length === 1
      ) {
        customTooltipRecords = records;
      }

      customTooltipRecords.sort((a, b) => {
        return a.y - b.y;
      });

      if (customTooltipRecords.length > 20) {
        customTooltipRecords = customTooltipRecords.slice(0, 20);
      }

      if (tooltipData) {
        const customEntries: ChartTooltipEntry['entries'] =
          getCustomTooltipEntries({
            explore,
            records: customTooltipRecords,
          });

        // If not series, put custom entries at end
        // If series, add data under the highlighted series. Note this only works for 1 series value highlight
        const insertPosition = !seriesRef
          ? tooltipData.entries.length
          : tooltipData.entries.findIndex(e => e.highlight) + 1;
        tooltipData.entries.splice(insertPosition, 0, ...customEntries);
      }

      tooltipEntryMemo.set(item, tooltipData);
      return tooltipData;
    },
  };
}
