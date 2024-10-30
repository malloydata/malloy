/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {DateField, Explore, Tag, TimestampField} from '@malloydata/malloy';
import {BarChartSettings} from './get-bar_chart-settings';
import {
  ChartTooltipEntry,
  DataInjector,
  MalloyVegaDataRecord,
  RenderResultMetadata,
  VegaChartProps,
  VegaSpec,
} from '../types';
import {getChartLayoutSettings} from '../chart-layout-settings';
import {getFieldFromRootPath, getFieldReferenceId} from '../plot/util';
import {Item, View} from 'vega';
import {renderTimeString} from '../render-time';
import {renderNumericField} from '../render-numeric-field';
import {createMeasureAxis} from '../vega/measure-axis';
import {getCustomTooltipEntries} from './get-custom-tooltips-entries';
import {getMarkName} from '../vega/vega-utils';

type BarDataRecord = {
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

export function generateBarChartVegaSpec(
  explore: Explore,
  settings: BarChartSettings,
  metadata: RenderResultMetadata,
  chartTag: Tag
): VegaChartProps {
  // TODO: check that there are <=2 dimension fields, throw error otherwise
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

  const isGrouping = hasSeries && !settings.isStack;
  const isStacking = hasSeries && settings.isStack;

  // Calculate min/max across all y columns
  // TODO: how to calculate shared stack min/maxes?
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const name of settings.yChannel.fields) {
    const field = getFieldFromRootPath(explore, name);
    const min = metadata.field(field).min;
    if (min !== null) yMin = Math.min(yMin, min);
    const max = metadata.field(field).max;
    if (max !== null) yMax = Math.max(yMax, max);
  }

  // Final axis domain, with 0 boundary so bars always start at 0
  const yDomainMin = Math.min(0, yMin);
  const yDomainMax = Math.max(0, yMax);

  const chartSettings = getChartLayoutSettings(explore, metadata, chartTag, {
    xField,
    yField,
    chartType: 'bar_chart',
    getYMinMax: () => [yDomainMin, yDomainMax],
  });

  // x axes across rows should auto share when distinct values <=20, unless user has explicitly set independent setting
  const autoSharedX = xMeta.values.size <= 20;
  const forceSharedX = chartTag.text('x', 'independent') === 'false';
  const forceIndependentX = chartTag.has('x', 'independent') && !forceSharedX;
  const shouldShareXDomain =
    forceSharedX || (autoSharedX && !forceIndependentX);

  // series legends across rows should auto share when distinct values <=20, unless user has explicitly set independent setting
  const autoSharedSeries = seriesMeta && seriesMeta.values.size <= 20;
  const forceSharedSeries = chartTag.text('series', 'independent') === 'false';
  const forceIndependentSeries =
    chartTag.has('series', 'independent') && !forceSharedSeries;
  const shouldShareSeriesDomain =
    forceSharedSeries || (autoSharedSeries && !forceIndependentSeries);

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

  // This separate each group set of bars, whether series or single bars
  const barGroupPadding = 0.25;
  // This separates bars within a group
  const barPadding = 0;

  // Spacing for bar groups, depending on whether grouped or not
  // Manually calculating offsets and widths for bars because we need x highlight event targets to be full bandwidth
  const xOffset: VegaSpec = {};
  let xWidth: VegaSpec = {};
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
  const groupMark: VegaSpec = {
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

  const barMark: VegaSpec = {
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

  const highlightMark: VegaSpec = {
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

  groupMark.marks.push(highlightMark, barMark);

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
  if (isStacking) {
    valuesData.transform.push({
      type: 'stack',
      groupby: ['x'],
      field: 'y',
      sort: {field: 'series'},
    });
  }

  const marks = [groupMark];

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

  if (settings.interactive) {
    if (yAxis) marks.push(...yAxis.interactiveMarks);

    // TODO add xAxisRangeBrush
    // marks.push(xAxisOverlay, xAxisRangeBrush);

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
                // TODO: x range brushing
                // {
                //   events: {signal: 'xRangeBrushValues'},
                //   update: `xRangeBrushValues ? { fieldRefId: xFieldRefId, sourceId: brushXSourceId, value: xRangeBrushValues, type: 'dimension' } : null`,
                // },
              ]
            : [],
        },
        {
          name: 'brushSeries',
          on:
            isDimensionalSeries && seriesRef
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
          // TODO: For now, not including brushMeasureRange ({ sourceId: '${brushMeasureRangeSourceId}', data: brushMeasureRange }) as there are issues to work through
        },
        ...interactiveSignals,
        {
          name: 'yIsBrushing',
          value: false,
          // TODO: for now, disabling brushing ranges as there are issues to work through
          // on: [
          //   {
          //     'events':
          //       '[@y_axis_overlay:mousedown, window:mouseup] > window:mousemove!',
          //     'update': 'true',
          //   },
          //   {
          //     'events': 'window:mouseup',
          //     'update': 'false',
          //   },
          // ],
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
        type: 'band',
        domain: shouldShareXDomain
          ? [...xMeta.values]
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
        domain: shouldShareSeriesDomain
          ? [...seriesMeta!.values]
          : {
              data: 'values',
              field: 'series',
            },
      },
      {
        name: 'xOffset',
        type: 'band',
        domain: shouldShareSeriesDomain
          ? [...seriesMeta!.values]
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
        title: xFieldPath,
        ...chartSettings.xAxis,
        encode: {
          labels: {
            update: {
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
    if (isDimensionalSeries) {
      // Legend size is by legend title or the longest legend value
      maxCharCt = seriesMeta!.maxString?.length ?? 0;
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
      maxCharCt * 10 + 20
    );

    const legendSettings: VegaSpec = {
      // Provide padding around legend entries
      titleLimit: legendSize - 20,
      labelLimit: legendSize - 40,
      padding: 8,
      offset: 4,
    };

    spec.padding.right = legendSize;
    spec.legends.push({
      fill: 'color',
      // No title for measure list legends
      title: seriesField ? seriesField.name : '',
      ...legendSettings,
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

  // Memoize tooltip data
  const tooltipEntryMemo = new Map<Item, ChartTooltipEntry | null>();

  return {
    spec,
    specType: 'vega',
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: 'bar_chart',
    injectData,
    getTooltipData: (item: Item, view: View) => {
      if (tooltipEntryMemo.has(item)) {
        return tooltipEntryMemo.get(item)!;
      }

      let tooltipData: ChartTooltipEntry | null = null;
      let records: BarDataRecord[] = [];
      const colorScale = view.scale('color');
      const formatY = (rec: BarDataRecord) => {
        const fieldName = rec.series;
        // If dimensional, use the first yField for formatting. Else the series value is the field path of the field to use
        const field = isDimensionalSeries
          ? yField
          : getFieldFromRootPath(explore, fieldName);

        const value = rec.y;
        return field.isAtomicField()
          ? renderNumericField(field, value)
          : String(value);
      };

      // Tooltip records for the highlight bars
      if (getMarkName(item) === 'x_highlight') {
        const x = item.datum.x;
        records = item.datum.v;

        tooltipData = {
          title: [x],
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
        tooltipData = {
          title: [itemData.x],
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
            metadata,
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

// TODO: x range brushes
// const xAxisOverlay: VegaSpec = {
//   name: 'x_axis_overlay',
//   type: 'rect',
//   encode: {
//     enter: {
//       y: {
//         signal: `height + ${chartSettings.xAxis.height} + 4`,
//       },
//       y2: {signal: 'height'},
//       x: {value: 0},
//       x2: {signal: 'width'},
//       fill: {value: 'transparent'},
//     },
//   },
// };
// const xAxisRangeBrushRect: VegaSpec = {
//   name: 'x_axis_range_brush',
//   type: 'rect',
//   encode: {
//     enter: {
//       y: {
//         signal: `height + ${chartSettings.xAxis.height} + 4`,
//       },
//       y2: {signal: 'height'},
//       fill: {
//         'value': '#4c72ba',
//       },
//       fillOpacity: {value: 0.1},
//     },
//     update: {
//       x: {
//         signal:
//           'xRangeBrushValues ? scale("xscale",xRangeBrushValues[0]) : 0',
//       },
//       x2: {
//         signal:
//           'xRangeBrushValues ? scale("xscale",xRangeBrushValues[xRangeBrushValues.length-1]) + bandwidth("xscale") : 0',
//       },
//     },
//   },
// };

// const xAxisRangeBrush: VegaSpec = {
//   type: 'group',
//   marks: [
//     xAxisRangeBrushRect,
//     {
//       type: 'rule',
//       encode: {
//         enter: {
//           y: {
//             signal: `height + ${chartSettings.xAxis.height} + 4`,
//           },
//           y2: {signal: 'height'},
//           stroke: {value: '#b5bcc9'},
//           strokeWidth: {value: 0.5},
//         },
//         update: {
//           x: {
//             signal:
//               'xRangeBrushValues ? scale("xscale",xRangeBrushValues[0])+0.5 : 0',
//           },
//           x2: {
//             signal:
//               'xRangeBrushValues ? scale("xscale",xRangeBrushValues[0])+0.5 : 0',
//           },
//           opacity: [
//             {
//               test: 'xRangeBrushValues',
//               value: 1,
//             },
//             {value: 0},
//           ],
//         },
//       },
//     },
//     {
//       type: 'rule',
//       encode: {
//         enter: {
//           y: {
//             signal: `height + ${chartSettings.xAxis.height} + 4`,
//           },
//           y2: {signal: 'height'},
//           stroke: {value: '#b5bcc9'},
//           strokeWidth: {value: 0.5},
//         },
//         update: {
//           x: {
//             signal:
//               'xRangeBrushValues ? scale("xscale",xRangeBrushValues[xRangeBrushValues.length-1])-0.5  + bandwidth("xscale") : 0',
//           },
//           x2: {
//             signal:
//               'xRangeBrushValues ? scale("xscale",xRangeBrushValues[xRangeBrushValues.length-1])-0.5  + bandwidth("xscale") : 0',
//           },
//           opacity: [
//             {
//               test: 'xRangeBrushValues',
//               value: 1,
//             },
//             {value: 0},
//           ],
//         },
//       },
//     },
//   ],
// };

/*
  x range brush signals
  {
          name: 'xRangeBrush',
          on: [
            {
              events: '@x_axis_overlay:mousedown',
              update: '[x(), x()]',
            },
            {
              'events':
                '[@x_axis_overlay:mousedown, window:mouseup] > window:mousemove!',
              'update': '[xRangeBrush[0], clamp(x(), 0, width)]',
            },
            // shortcut to clear it? if click clears it, then we can't move it
            // TODO for now, double click. later can work in moving, edge move handle semantics
            {
              'events': '@x_axis_range_brush:dblclick',
              'update': 'null',
            },
          ],
        },
        {
          name: 'xRangeBrushSorted',
          update: 'xRangeBrush ? extent(xRangeBrush) : null',
        },
        {
          name: 'xRangeBrushIndices',
          update: `xRangeBrushSorted ? [
              indexof(domain('xscale'), invert('xscale', xRangeBrushSorted[0])) < 0 ? 0 : indexof(domain('xscale'), invert('xscale', xRangeBrushSorted[0])),
              indexof(domain('xscale'), invert('xscale', xRangeBrushSorted[1])) < 0 ? length(domain('xscale')) : indexof(domain('xscale'), invert('xscale', xRangeBrushSorted[1])),
      ]
            : null`,
        },
        {
          name: 'xRangeBrushValues',
          update:
            'xRangeBrushIndices ? slice(domain("xscale"), xRangeBrushIndices[0], xRangeBrushIndices[1]+1) : null',
        },

*/
