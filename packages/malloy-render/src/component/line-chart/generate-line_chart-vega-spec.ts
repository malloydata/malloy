/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {
  ChartTooltipEntry,
  MalloyDataToChartDataHandler,
  MalloyVegaDataRecord,
  RenderResultMetadata,
  VegaChartProps,
  VegaPadding,
} from '../types';
import {getLineChartSettings} from './get-line_chart-settings';
import {getFieldFromRootPath, getFieldReferenceId} from '../plot/util';
import {getChartLayoutSettings} from '../chart-layout-settings';
import {renderTimeString} from '../render-time';
import {createMeasureAxis} from '../vega/measure-axis';
import * as Malloy from '@malloydata/malloy-interfaces';
import {
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
import {renderNumericField} from '../render-numeric-field';
import {getMarkName} from '../vega/vega-utils';
import {getCustomTooltipEntries} from '../bar-chart/get-custom-tooltips-entries';
import {NULL_SYMBOL} from '../apply-renderer';
import {
  CellDataValue,
  getAllCellValues,
  getCell,
  getCellValue,
  getFieldTimeframe,
  isAtomic,
  isBoolean,
  isDate,
  isTimestamp,
  NestFieldInfo,
  tagFor,
} from '../util';

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
  explore: NestFieldInfo,
  metadata: RenderResultMetadata
): VegaChartProps {
  const tag = tagFor(explore);
  const chartTag = tag.tag('line_chart');
  if (!chartTag)
    throw new Error('Line chart should only be rendered for line_chart tag');
  const settings = getLineChartSettings(explore, metadata, tag);
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
  const xIsDateorTime =
    isAtomic(xField) && (isDate(xField) || isTimestamp(xField));
  const xIsBoolean = isAtomic(xField) && isBoolean(xField);
  const yField = getFieldFromRootPath(explore, yFieldPath);
  const seriesField = seriesFieldPath
    ? getFieldFromRootPath(explore, seriesFieldPath)
    : null;

  const xRef = getFieldReferenceId(xField);
  const yRef = getFieldReferenceId(yField);
  const seriesRef = seriesField && getFieldReferenceId(seriesField);

  const xMeta = metadata.fields.get(xField)!;
  const seriesMeta = seriesField ? metadata.fields.get(seriesField) : null;

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
    const min = metadata.fields.get(field)!.min;
    if (min !== null) yMin = Math.min(yMin, min);
    const max = metadata.fields.get(field)!.max;
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

  const marks: Mark[] = [];

  const seriesGroupMark: GroupMark = {
    name: 'series_group',
    from: {
      facet: {
        data: 'values',
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
        stroke: {scale: 'color', field: 'series'},
        strokeWidth: {value: 2},
        zindex: {value: 0},
      },
      update: {
        strokeOpacity: [
          {
            test: 'brushSeriesIn && brushSeriesIn != datum.series',
            value: LINE_FADE_OPACITY,
          },
          {value: 1},
        ],
        // TODO figure out why this isn't working. We need highlighted line to appear above other lines
        zindex: [
          {test: 'brushSeriesIn && brushSeriesIn === datum.series', value: 1},
          {value: 0},
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
          scale: 'xscale',
          field: 'x',
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
            x: {scale: 'xscale', field: 'x'},
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
        x: {scale: 'xscale', field: 'x'},
        y: {scale: 'yscale', field: 'y'},
        fill: {value: 'transparent'},
        size: {value: 256},
      },
    },
  };

  const pointMarks: SymbolMark = {
    name: 'points',
    type: 'symbol',
    from: {
      data: 'series_facet',
    },
    encode: {
      enter: {
        x: {scale: 'xscale', field: 'x'},
        y: {scale: 'yscale', field: 'y'},
        fill: {scale: 'color', field: 'series'},
      },
      update: {
        fillOpacity: [
          {
            test: 'brushXIn ? indexof(brushXIn,datum.x) > -1 : false',
            value: 1,
          },
          // If only one point in a line, show the point
          {signal: 'item.mark.group.datum.count > 1 ? 0 : 1'},
        ],
      },
    },
  };

  seriesGroupMark.marks!.push(lineMark);
  seriesGroupMark.marks!.push(pointMarks);

  marks.push(seriesGroupMark);

  if (settings.interactive) {
    if (yAxis) marks.push(...yAxis.interactiveMarks);
  }
  marks.push(highlightRuleMark, xHitTargets, refLineTargets);

  // Source data and transforms
  const valuesData: Data = {name: 'values', values: [], transform: []};
  // For measure series, unpivot the measures into the series column
  if (isMeasureSeries) {
    // Pull the series values from the source record, then remap the names to remove __source
    valuesData.transform!.push({
      type: 'fold',
      fields: settings.yChannel.fields.map(f => `__source.${f}`),
      as: ['series', 'y'],
    });
    valuesData.transform!.push({
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

  const interactiveSignals = yAxis ? yAxis.interactiveSignals : [];

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
    // Interactive signals
    signals.push(
      {
        name: 'brushX',
        on: xRef
          ? [
              {
                events: '@x_hit_target:mouseover', // points too?
                update:
                  "{ fieldRefId: xFieldRefId, value: [datum.datum.x], sourceId: brushXSourceId, type: 'dimension'}",
              },
              {
                events: '@ref_line_targets:mouseover', // points too?
                update:
                  "{ fieldRefId: xFieldRefId, value: [datum.x], sourceId: brushXSourceId, type: 'dimension'}",
              },
              {
                events: '@x_hit_target:mouseout', // points too? @bars:mouseout
                update: 'null',
              },
              {
                events: '@ref_line_targets:mouseout', // points too? @bars:mouseout
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
      contains: 'content',
    },
    padding: chartSettings.padding,
    data: [
      valuesData,
      {
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
      },
    ],
    scales: [
      {
        name: 'xscale',
        type: xIsDateorTime ? 'time' : 'point',
        domain: shouldShareXDomain
          ? xIsDateorTime
            ? [xMeta.min, xMeta.max]
            : xIsBoolean
            ? [true, false]
            : [...xMeta.values]
          : {data: 'values', field: 'x'},
        range: 'width',
        paddingOuter: 0.05,
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
        domain: shouldShareSeriesDomain
          ? [...seriesMeta!.values]
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
        title: xFieldPath,
        labelOverlap: 'greedy',
        labelSeparation: 4,
        ...chartSettings.xAxis,
        encode: {
          ...(xIsDateorTime
            ? {
                labels: {
                  enter: {
                    text: {
                      signal: `renderMalloyTime(malloyExplore, '${xFieldPath}', datum.value)`,
                    },
                  },
                  update: {
                    text: {
                      signal: `renderMalloyTime(malloyExplore, '${xFieldPath}', datum.value)`,
                    },
                  },
                },
              }
            : {}),
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

  const mapMalloyDataToChartData: MalloyDataToChartDataHandler = (
    field,
    data
  ) => {
    const getXValue = (row: Malloy.Row) => {
      return getCellValue(getCell(field, row, xField.name));
    };
    // xIsDateorTime
    //   ? new Date(row[xFieldPath] as string | number).valueOf()
    //   : row[xFieldPath];

    const mappedData: {
      __source: {[name: string]: CellDataValue};
      x: CellDataValue;
      y: CellDataValue;
      series: CellDataValue;
    }[] = [];
    data.forEach(rowCell => {
      if (rowCell.kind !== 'record_cell') {
        throw new Error('Unexpected record');
      }
      const row = rowCell.record_value;
      // Filter out missing date/time values
      if (xIsDateorTime && getXValue(row) === null) {
        return;
      }
      // Map data fields to chart properties.  Handle undefined values properly.
      let seriesVal = seriesField
        ? getCellValue(getCell(field, row, seriesField.name))
        : yFieldPath;
      if (seriesVal === undefined || seriesVal === null) {
        seriesVal = NULL_SYMBOL;
      }
      const __source = getAllCellValues(field, row);
      __source['__malloyDataRecord'] = row;
      mappedData.push({
        __source,
        x: getXValue(row) ?? NULL_SYMBOL,
        y: getCellValue(getCell(field, row, yField.name)),
        series: seriesVal,
      });
    });
    return mappedData;
  };

  // Memoize tooltip data
  const tooltipEntryMemo = new Map<Item, ChartTooltipEntry | null>();

  return {
    spec,
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: 'line_chart',
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
        const fieldName = rec.series;
        // If dimensional, use the first yField for formatting. Else the series value is the field path of the field to use
        const field = isDimensionalSeries
          ? yField
          : getFieldFromRootPath(explore, fieldName);

        const value = rec.y;
        return isAtomic(field)
          ? renderNumericField(field, value)
          : String(value);
      };

      // Tooltip records for the highlighted points
      if (['x_hit_target', 'ref_line_targets'].includes(markName)) {
        const x =
          markName === 'x_hit_target' ? item.datum.datum.x : item.datum.x;
        records = markName === 'x_hit_target' ? item.datum.datum.v : [];

        const title = xIsDateorTime
          ? renderTimeString(
              new Date(x),
              isAtomic(xField) && isDate(xField),
              getFieldTimeframe(xField)
            )
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
          ? renderTimeString(
              new Date(itemData.x),
              isAtomic(xField) && isDate(xField),
              getFieldTimeframe(xField)
            )
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
