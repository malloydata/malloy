/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  ChartTooltipEntry,
  MalloyDataToChartDataHandler,
  MalloyVegaDataRecord,
  VegaChartProps,
  VegaPadding,
  VegaSignalRef,
} from '@/component/types';
import type {ChartLayoutSettings} from '@/component/chart/chart-layout-settings';
import {
  getChartLayoutSettings,
  getXAxisSettings,
} from '@/component/chart/chart-layout-settings';
import type {
  Data,
  EncodeEntry,
  GroupMark,
  Item,
  Legend,
  Mark,
  RectMark,
  Signal,
  Spec,
  View,
} from 'vega';
import {
  renderNumericField,
  renderDateTimeField,
} from '@/component/render-numeric-field';
import {createMeasureAxis} from '@/component/vega/measure-axis';
import {getCustomTooltipEntries} from '@/component/bar-chart/get-custom-tooltips-entries';
import {getMarkName} from '@/component/vega/vega-utils';
import type {CellValue, RecordCell} from '@/data_tree';
import {Field} from '@/data_tree';
import {NULL_SYMBOL} from '@/util';
import {convertLegacyToVizTag} from '@/component/tag-utils';
import type {RenderMetadata} from '@/component/render-result-metadata';
import type {Tag} from '@malloydata/malloy-tag';
import type {BarChartPluginInstance} from './bar-chart-plugin';

type BarDataRecord = {
  x: string | number;
  y: number;
  series: string;
} & MalloyVegaDataRecord;

const LEGEND_PERC = 0.4;
const LEGEND_MAX = 384;
const DEFAULT_MAX_SERIES = 20;

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

function getLimitedData({
  xField,
  seriesField,
  maxSeries = 20,
  maxSizePerBar,
  isGrouping,
  chartSettings,
  chartTag,
}: {
  xField: Field;
  seriesField?: Field | null;
  maxSeries?: number;
  maxSizePerBar?: number;
  isGrouping: boolean;
  chartSettings: ChartLayoutSettings;
  chartTag: Tag;
}) {
  // Limit series values shown
  const seriesLimit =
    chartTag.numeric('series', 'limit') ??
    Math.min(maxSeries, seriesField?.valueSet.size ?? 1);
  const seriesValuesToPlot = seriesField
    ? [...seriesField.valueSet.values()].slice(0, seriesLimit)
    : [];

  const refinedMaxSizePerBar =
    maxSizePerBar ?? (seriesField && isGrouping) ? 8 : 8;

  // Limit x axis values shown
  const subGroupBars = seriesField && isGrouping ? seriesLimit : 1;
  const maxSizePerXGroup = chartSettings.isSpark
    ? 2
    : Math.floor(refinedMaxSizePerBar * subGroupBars);
  const barLimitTag = chartTag.numeric('x', 'limit');
  const barLimit =
    barLimitTag ?? Math.floor(chartSettings.plotWidth / maxSizePerXGroup);
  const barValuesToPlot = [...xField.valueSet.values()].slice(0, barLimit);

  return {
    seriesValuesToPlot,
    barValuesToPlot,
    barLimit,
    seriesLimit,
  };
}

export function generateBarChartVegaSpecV2(
  metadata: RenderMetadata,
  plugin: BarChartPluginInstance
): VegaChartProps {
  const pluginMetadata = plugin.getMetadata();
  const settings = pluginMetadata.settings;
  const {getTopNSeries, field: explore} = plugin;
  const tag = convertLegacyToVizTag(explore.tag);
  const chartTag = tag.tag('viz');
  if (!chartTag)
    throw new Error(
      'Malloy Bar Chart: Tried to render a bar chart, but no viz=bar tag was found'
    );

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

  const xField = explore.fieldAt(xFieldPath);
  const xIsDateorTime = xField.isTime();
  const yField = explore.fieldAt(yFieldPath);
  let seriesField = seriesFieldPath ? explore.fieldAt(seriesFieldPath) : null;

  // Use synthetic field if available (for multiple series)
  if (plugin.syntheticSeriesField) {
    seriesField = plugin.syntheticSeriesField;
  }

  const xRef = xField.referenceId;
  const yRef = yField.referenceId;
  const seriesRef = seriesField && seriesField.referenceId;

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

  const isGrouping = hasSeries && !settings.isStack;
  const isStacking = hasSeries && settings.isStack;

  // Calculate min/max across all y columns
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const name of settings.yChannel.fields) {
    const field = explore.fieldAt(name);
    const min = field.minNumber;
    if (min !== undefined) yMin = Math.min(yMin, min);
    const max = field.maxNumber;
    if (max !== undefined) yMax = Math.max(yMax, max);
  }

  // Final axis domain, with 0 boundary so bars always start at 0
  const yDomainMin = Math.min(0, yMin);
  const yDomainMax = Math.max(0, yMax);

  const maxSeries = chartTag.numeric('series', 'limit') ?? DEFAULT_MAX_SERIES;
  const isLimitingSeries = Boolean(
    seriesField && seriesField.valueSet.size > maxSeries
  );

  const chartSettings = getChartLayoutSettings(explore, chartTag, {
    metadata,
    xField,
    yField,
    chartType: 'bar',
    getYMinMax: () => [yDomainMin, yDomainMax],
    independentY: chartTag.has('y', 'independent') || isLimitingSeries,
  });

  // Data limits
  const dataLimits = getLimitedData({
    xField,
    seriesField,
    isGrouping,
    chartSettings,
    chartTag,
  });

  let maxString = '';
  for (const value of dataLimits.barValuesToPlot) {
    const stringValue = value.toString();
    if (stringValue.length > maxString.length) {
      maxString = stringValue;
    }
  }

  // Recalculate xAxisSettings based on data limits
  const xAxisSettings = getXAxisSettings({
    maxString,
    chartHeight: chartSettings.plotHeight,
    chartWidth: chartSettings.plotWidth,
    xField,
    parentField: explore,
    parentTag: tag,
  });

  // x axes across rows should auto share when distinct values <=20, unless user has explicitly set independent setting
  const autoSharedX = dataLimits.barValuesToPlot.length <= 20;
  const forceSharedX = chartTag.text('x', 'independent') === 'false';
  const forceIndependentX = chartTag.has('x', 'independent') && !forceSharedX;
  const shouldShareXDomain =
    forceSharedX || (autoSharedX && !forceIndependentX);

  // series legends across rows should auto share when distinct values <=20, unless user has explicitly set independent setting
  const autoSharedSeries =
    seriesField && dataLimits.seriesValuesToPlot.length <= 20;
  const forceSharedSeries = chartTag.text('series', 'independent') === 'false';
  const forceIndependentSeries =
    chartTag.has('series', 'independent') && !forceSharedSeries;
  const shouldShareSeriesDomain =
    forceSharedSeries || (autoSharedSeries && !forceIndependentSeries);

  const seriesSet = seriesField ? new Set(getTopNSeries?.(maxSeries)) : null;

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
      })
    : null;

  // This separate each group set of bars, whether series or single bars
  const barGroupPadding = 0.25;
  // This separates bars within a group
  const barPadding = 0;

  // Spacing for bar groups, depending on whether grouped or not
  // Manually calculating offsets and widths for bars because we need x highlight event targets to be full bandwidth
  const xOffset: VegaSignalRef = {signal: ''};
  let xWidth: EncodeEntry['width'] = {};
  if (isGrouping) {
    xOffset.signal = `scale('xOffset', datum.series)+bandwidth("xscale")*${
      barGroupPadding / 2
    }`;
    xWidth = {'scale': 'xOffset', 'band': 1 - barPadding};
  } else {
    xOffset.signal = `bandwidth("xscale")*${barGroupPadding / 2}`;
    xWidth = {'scale': 'xscale', 'band': 1 - barGroupPadding};
  }

  // Create groups for each unique x value via faceting
  const groupMark: GroupMark = {
    name: 'x_group',
    from: {
      facet: {
        data: 'values',
        name: 'x_facet',
        groupby: ['x'],
        // Collect all records for each bar, for feeding into tooltip in series charts
        aggregate: {
          fields: ['x', 'x'],
          ops: ['values', 'min'],
          as: ['v', 'x'],
        },
      },
    },
    data: [
      // For highlight marks, collect all records into 1 record per x, for feeding into tooltip
      {
        name: 'x_facet_values',
        source: 'x_facet',
        transform: [
          {
            type: 'aggregate',
            fields: ['x', 'x'],
            ops: ['values', 'min'],
            as: ['v', 'x'],
          },
        ],
      },
    ],
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
    marks: [],
  };

  const BAR_FADE_OPACITY = 0.35;

  const barMark: RectMark = {
    name: 'bars',
    type: 'rect',
    from: {
      data: 'x_facet',
    },
    zindex: 2,
    encode: {
      enter: {
        x: {
          offset: xOffset,
        },
        width: xWidth,
        y: {
          scale: 'yscale',
          field: settings.isStack ? 'y0' : 'y',
        },
        y2: settings.isStack
          ? {'scale': 'yscale', 'field': 'y1'}
          : {'scale': 'yscale', 'value': 0},
      },
      update: {
        fill: {
          scale: 'color',
          field: 'series',
        },
        fillOpacity: [
          {
            test: 'brushSeriesIn && brushSeriesIn != datum.series',
            value: BAR_FADE_OPACITY,
          },
          {
            test: isMeasureSeries
              ? 'length(brushMeasureListIn) > 0 && indexof(brushMeasureListIn, datum.series) === -1'
              : 'false',
            value: BAR_FADE_OPACITY,
          },
          {
            test: 'brushXIn && length(brushXIn) > 0 && indexof(brushXIn, datum.x) === -1',
            value: BAR_FADE_OPACITY,
          },
          {
            test: 'brushMeasureRangeIn && (datum.y < brushMeasureRangeIn[0] || datum.y > brushMeasureRangeIn[1])',
            value: BAR_FADE_OPACITY,
          },
          {value: 1},
        ],
      },
    },
  };

  const highlightMark: RectMark = {
    name: 'x_highlight',
    type: 'rect',
    from: {
      data: 'x_facet_values',
    },
    zindex: 1,
    encode: {
      enter: {
        x: {
          value: 0,
        },
        width: {scale: 'xscale', band: 1},
        y: {
          value: 0,
        },
        y2: {signal: 'height'},
      },
      update: {
        fill: {
          value: '#4c72ba',
        },
        fillOpacity: [
          {
            test: 'brushXIn ? indexof(brushXIn,datum.x) > -1 : false',
            value: 0.1,
          },
          {value: 0},
        ],
      },
    },
  };

  groupMark.marks!.push(highlightMark, barMark);

  // Source data and transforms
  const valuesData: Data = {name: 'values', values: [], transform: []};
  // For measure series, unpivot the measures into the series column
  if (isMeasureSeries) {
    // Pull the series values from the source record, then remap the names to remove __values
    valuesData.transform!.push({
      type: 'fold',
      // TODO this does not support field names that have dots in them
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
  if (isStacking) {
    valuesData.transform!.push({
      type: 'stack',
      groupby: ['x'],
      field: 'y',
      sort: {field: 'series'},
    });
  }

  const marks: Mark[] = [groupMark];

  /**************************************
   *
   * Chart signals
   *
   *************************************/

  // Base signals
  const signals: Signal[] = [
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
    if (yAxis) marks.push(...yAxis.interactiveMarks);

    const interactiveSignals = yAxis ? yAxis.interactiveSignals : [];
    signals.push(
      ...[
        {
          name: 'brushX',
          on: xRef
            ? [
                {
                  events: '@x_highlight:mouseover, @bars:mouseover',
                  update:
                    "{ fieldRefId: xFieldRefId, value: [datum.x], sourceId: brushXSourceId, type: 'dimension'}",
                },
                {
                  events: '@x_highlight:mouseout, @bars:mouseout',
                  update: 'null',
                },
              ]
            : [],
        },
        {
          name: 'brushSeries',
          on:
            isDimensionalSeries && seriesRef && !plugin.syntheticSeriesField
              ? [
                  {
                    events: '@bars:mouseover',
                    update:
                      "{ fieldRefId: seriesFieldRefId, value: datum.series, sourceId: brushSeriesSourceId, type: 'dimension' }",
                  },
                  {
                    events: '@bars:mouseout',
                    update: 'null',
                  },
                  {
                    events:
                      '@legend_labels:mouseover, @legend_symbols:mouseover',
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
          on: [
            {
              events: '@bars:mouseover',
              update: isMeasureSeries
                ? `{ fieldRefId: yRefsMap[datum.series], value: datum['${
                    isStacking ? 'y1' : 'y'
                  }'], sourceId: brushMeasureSourceId, type: 'measure'}`
                : `{ fieldRefId: measureFieldRefId, value: datum['${
                    isStacking ? 'y1' : 'y'
                  }'], sourceId: brushMeasureSourceId, type: 'measure'}`,
            },
            {
              events: '@bars:mouseout',
              update: 'null',
            },
            ...(yAxis?.brushMeasureEvents ?? []),
            ...(isMeasureSeries
              ? [
                  {
                    events:
                      '@legend_labels:mouseover, @legend_symbols:mouseover',
                    update:
                      "{ fieldRefId: yRefsMap[datum.value], value: null, sourceId: brushMeasureSourceId, type: 'measure' }",
                  },
                  {
                    events: '@legend_labels:mouseout, @legend_symbols:mouseout',
                    update: 'null',
                  },
                ]
              : []),
          ],
        },
        // Export this chart's brushes. Series / measure brushes are debounced when set to empty to avoid flickering
        {
          name: 'brushOut',
          update:
            "[{ sourceId: brushXSourceId, data: brushX }, { sourceId: brushSeriesSourceId, data: brushSeries, debounce: { time: 100, strategy: 'on-empty' } },{ sourceId: brushMeasureSourceId, data: brushMeasure, debounce: { time: 100, strategy: 'on-empty' } } ]",
        },
        ...interactiveSignals,
        {
          name: 'yIsBrushing',
          value: false,
        },
      ]
    );
  } else {
    // Some marks rely on yIsBrushing to exist regardless of interactive state
    signals.push({
      name: 'yIsBrushing',
      value: false,
    });
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
    data: [valuesData],
    padding: {...chartSettings.padding},
    scales: [
      {
        name: 'xscale',
        type: 'band',
        domain: shouldShareXDomain
          ? [...dataLimits.barValuesToPlot]
          : {data: 'values', field: 'x'},
        range: 'width',
        paddingOuter: 0.05,
        round: true,
      },
      {
        name: 'yscale',
        nice: true,
        range: 'height',
        domain: settings.isStack
          ? {data: 'values', field: 'y1'}
          : chartSettings.yScale.domain ?? {data: 'values', field: 'y'},
      },
      {
        name: 'color',
        type: 'ordinal',
        range: 'category',
        domain:
          isDimensionalSeries && shouldShareSeriesDomain && seriesSet
            ? [...seriesSet!]
            : {
                data: 'values',
                field: 'series',
              },
      },
      {
        name: 'xOffset',
        type: 'band',
        domain:
          isDimensionalSeries && shouldShareSeriesDomain && seriesSet
            ? [...seriesSet!]
            : {data: 'values', field: 'series'},
        range: {
          signal: `[0,bandwidth('xscale') * ${1 - barGroupPadding}]`,
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
        titleY: xAxisSettings.height,
        encode: {
          labels: {
            enter: {
              ...(xIsDateorTime
                ? {
                    text: {
                      signal: `renderMalloyTime(malloyExplore, '${xFieldPath}', datum.value)`,
                    },
                  }
                : {}),
            },
            update: {
              ...(xIsDateorTime
                ? {
                    text: {
                      signal: `renderMalloyTime(malloyExplore, '${xFieldPath}', datum.value)`,
                    },
                  }
                : {}),
              fillOpacity: [
                {
                  test: 'brushXIn ? indexof(brushXIn,datum.value) === -1 : false',
                  value: 0.35,
                },
                {
                  value: 1,
                },
              ],
            },
          },
        },
      },
      ...(yAxis ? [yAxis.axis] : []),
    ],
    legends: [],
    marks,
    signals,
  };

  // Legend
  let maxCharCt = 0;
  if (hasSeries) {
    // Get legend dimensions
    if (isDimensionalSeries && seriesSet) {
      // This is for global; how to do across nests for local?
      maxCharCt = [...seriesSet!].reduce<number>(
        // TODO better handle the null symbol here
        (a, b) => Math.max(a, b?.toString().length ?? 1),
        0
      );
      maxCharCt = Math.max(maxCharCt, seriesField!.name.length);
    } else if (isDimensionalSeries) {
      // Legend size is by legend title or the longest legend value
      maxCharCt = seriesField!.maxString?.length ?? 0;
      maxCharCt = Math.max(maxCharCt, seriesField!.name.length);
    } else {
      maxCharCt = settings.yChannel.fields.reduce(
        (max, f) => Math.max(max, f.length),
        maxCharCt
      );
    }

    // Limit legend size to a hard max, then percentage of chart width, then the max text size
    const legendSize = Math.min(
      LEGEND_MAX,
      chartSettings.totalWidth * LEGEND_PERC,
      maxCharCt * 10 + 32
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
          ? [...seriesSet!]
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
                test: 'brushSeriesIn && brushSeriesIn != datum.value',
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
                test: 'brushSeriesIn && brushSeriesIn != datum.value',
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

    const localXSet = new Set();
    const skipX = xValue => {
      if (shouldShareXDomain) {
        const isXOutOfLimit = !dataLimits.barValuesToPlot.includes(
          xValue ?? NULL_SYMBOL
        );
        // Filter out missing date/time values
        const isXMissingDateTime = xIsDateorTime && xValue === null;
        return isXOutOfLimit || isXMissingDateTime;
      }

      if (localXSet.size >= dataLimits.barLimit && !localXSet.has(xValue)) {
        return true;
      }
      localXSet.add(xValue);
      return false;
    };
    const skipSeries = seriesValue => {
      if (isMeasureSeries) return false;
      if (shouldShareSeriesDomain) {
        if (
          seriesField &&
          isDimensionalSeries &&
          !dataLimits.seriesValuesToPlot.includes(seriesValue)
        ) {
          return true;
        }
      }

      if (
        localSeriesSet.size >= dataLimits.seriesLimit &&
        !localSeriesSet.has(seriesValue)
      ) {
        return true;
      }
      localSeriesSet.add(seriesValue);
      return false;
    };
    const localSeriesSet = new Set();
    const skipRecord = (row: RecordCell) => {
      const seriesValue = plugin.hasMultipleSeriesFields
        ? settings.seriesChannel.fields
            .map(fieldPath => {
              const field = explore.fieldAt(fieldPath);
              return row.column(field.name).value ?? NULL_SYMBOL;
            })
            .join(' - ')
        : seriesField
        ? row.column(seriesField.name).value ?? NULL_SYMBOL
        : null;

      return (
        skipX(getXValue(row)) ||
        (isDimensionalSeries ? skipSeries(seriesValue) : false)
      );
    };

    const mappedData: {
      __row: RecordCell;
      __values: {[name: string]: CellValue};
      x: CellValue;
      y: CellValue;
      series: CellValue;
    }[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      const xValue = getXValue(row);
      const seriesVal = plugin.hasMultipleSeriesFields
        ? settings.seriesChannel.fields
            .map(fieldPath => {
              const field = explore.fieldAt(fieldPath);
              return row.column(field.name).value ?? NULL_SYMBOL;
            })
            .join(' - ')
        : seriesField
        ? row.column(seriesField.name).value ?? NULL_SYMBOL
        : yField.name;

      if (skipRecord(row)) continue;

      // Map data fields to chart properties
      mappedData.push({
        __values: row.allCellValues(),
        __row: row,
        x: xValue ?? NULL_SYMBOL,
        y: row.column(yField.name).value,
        series: seriesVal,
      });
    }

    return {
      data: mappedData,
      isDataLimited: data.rows.length > mappedData.length,
      dataLimitMessage:
        seriesField && seriesField.valueSet.size > maxSeries
          ? `Showing ${maxSeries.toLocaleString()} of ${seriesField.valueSet.size.toLocaleString()} series`
          : '',
    };
  };

  // Memoize tooltip data
  const tooltipEntryMemo = new Map<Item, ChartTooltipEntry | null>();

  return {
    spec,
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: 'bar',
    chartTag,
    mapMalloyDataToChartData,
    getTooltipData: (item: Item, view: View) => {
      if (tooltipEntryMemo.has(item)) {
        return tooltipEntryMemo.get(item)!;
      }

      let tooltipData: ChartTooltipEntry | null = null;
      let records: BarDataRecord[] = [];
      const colorScale = view.scale('color');
      const formatY = (rec: BarDataRecord) => {
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

      // Tooltip records for the highlight bars
      if (getMarkName(item) === 'x_highlight') {
        const x = item.datum.x;
        records = item.datum.v;

        const title = xIsDateorTime
          ? renderDateTimeField(xField, new Date(x), {
              isDate: xField.isDate(),
              timeframe: xField.timeframe,
            })
          : x;

        tooltipData = {
          title: [title],
          entries: records.map(rec => ({
            label: rec.series,
            value: formatY(rec),
            highlight: false,
            color: colorScale(rec.series),
            entryType: 'list-item',
          })),
        };
      }

      // Tooltip records for the actual bars
      let highlightedSeries: string | null = null;
      if (item.datum && ['bars'].includes(getMarkName(item))) {
        const itemData = item.datum;
        highlightedSeries = itemData.series;
        records = item.mark.group.datum.v;
        const title = xIsDateorTime
          ? renderDateTimeField(xField, new Date(itemData.x), {
              isDate: xField.isDate(),
              timeframe: xField.timeframe,
            })
          : itemData.x;

        tooltipData = {
          title: [title],
          entries: records.map(rec => {
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
      let customTooltipRecords: BarDataRecord[] = [];
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
