/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  ChartTooltipEntry,
  MalloyDataToChartDataHandler,
  MalloyVegaDataRecord,
  VegaChartProps,
  VegaPadding,
  VegaSignalRef,
} from '@/component/types';
import {getChartLayoutSettings} from '@/component/chart/chart-layout-settings';
import type {
  Data,
  GroupMark,
  LineMark,
  Mark,
  RectMark,
  Scale,
  Signal,
  Spec,
  SymbolMark,
  Config,
  Item,
  View,
} from 'vega';
import {
  renderNumericField,
  renderDateTimeField,
} from '@/component/render-numeric-field';
import {createMeasureAxis} from '@/component/vega/measure-axis';
import {
  MEASURE_SERIES_LABEL_SCALE,
  getMeasureSeriesLabelScale,
} from '@/component/vega/measure-series-label-scale';
import {getMarkName} from '@/component/vega/vega-utils';
import type {RecordCell} from '@/data_tree';
import {NULL_SYMBOL} from '@/util';
import type {RenderMetadata} from '@/component/render-result-metadata';
import type {ComboChartPluginInstance} from './combo-chart-plugin';
import type {ComboYChannel} from './combo-chart-settings';

const LEGEND_PERC = 0.4;
const LEGEND_MAX = 384;
// Fraction of a band a grouped set of bars occupies (matches bar chart).
const BAR_GROUP_PADDING = 0.25;

/**
 * The slice of the combo chart plugin instance the spec generator reads.
 */
export type ComboChartSpecInputs = Pick<
  ComboChartPluginInstance,
  'getMetadata' | 'field' | 'chartDisplay'
>;

type ComboDataRecord = {
  x: string | number;
  __row: RecordCell;
} & MalloyVegaDataRecord;

export function generateComboChartVegaSpec(
  metadata: RenderMetadata,
  plugin: ComboChartSpecInputs,
  vegaConfig?: Config
): VegaChartProps {
  const pluginMetadata = plugin.getMetadata();
  const settings = pluginMetadata.settings;
  const {field: explore} = plugin;

  const xFieldPath = settings.xChannel.fields.at(0);
  if (!xFieldPath) throw new Error('Malloy Combo Chart: Missing x field');
  const xField = explore.fieldAt(xFieldPath);
  const xIsDateorTime = xField.isTime();

  const leftPaths = settings.yChannel.fields;
  const rightPaths = settings.y2Channel.fields;
  if (leftPaths.length === 0)
    throw new Error('Malloy Combo Chart: Missing left (y) measure');
  if (rightPaths.length === 0)
    throw new Error('Malloy Combo Chart: Missing right (y2) measure');

  // A measure's series key in the folded data is its field name; the legend
  // maps that name back to the field's # label via MEASURE_SERIES_LABEL_SCALE.
  const allPaths = [...leftPaths, ...rightPaths];
  const nameToPath = new Map<string, string>();
  for (const p of allPaths) nameToPath.set(explore.fieldAt(p).name, p);

  // Map each y ref id to its field path (so measure brushes can be keyed by
  // ref id, mirroring the bar/line charts).
  const yRefsMap = allPaths.reduce<Record<string, string | undefined>>(
    (map, fieldPath) => {
      map[fieldPath] = explore.fieldAt(fieldPath).referenceId;
      return map;
    },
    {}
  );

  const brushXSourceId = 'brush-x_' + crypto.randomUUID();

  // Per-axis domain min/max across that axis's measures. Bars must start at 0;
  // a line axis is nice-scaled without forcing 0.
  const axisMinMax = (paths: string[], includeZero: boolean) => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of paths) {
      const f = explore.fieldAt(p);
      if (f.minNumber !== undefined) min = Math.min(min, f.minNumber);
      if (f.maxNumber !== undefined) max = Math.max(max, f.maxNumber);
    }
    if (!isFinite(min)) min = 0;
    if (!isFinite(max)) max = 0;
    return includeZero
      ? ([Math.min(0, min), Math.max(0, max)] as [number, number])
      : ([min, max] as [number, number]);
  };

  const leftIsBar = settings.yChannel.chart === 'bar';
  const rightIsBar = settings.y2Channel.chart === 'bar';
  const leftMinMax = axisMinMax(leftPaths, leftIsBar);
  const rightMinMax = axisMinMax(rightPaths, rightIsBar);

  const chartSettings = getChartLayoutSettings(explore, {
    size: plugin.chartDisplay.size,
    metadata,
    xField,
    yField: explore.fieldAt(leftPaths[0]),
    chartType: 'combo',
    getYMinMax: () => leftMinMax,
    independentY: settings.yChannel.independent,
    y2Field: explore.fieldAt(rightPaths[0]),
    getY2MinMax: () => rightMinMax,
    independentY2: settings.y2Channel.independent,
    vegaConfig,
  });

  const xValues = [...xField.valueSet.values()];

  /**************************************
   * Scales
   *************************************/
  const scales: Scale[] = [
    {
      name: 'xscale',
      type: 'band',
      domain: [...xValues],
      range: 'width',
      paddingOuter: 0.05,
      round: true,
    },
    {
      name: 'yscale',
      nice: true,
      range: 'height',
      domain: chartSettings.yScale.domain ?? {data: 'values', field: 'yLeft'},
    },
    {
      name: 'yscaleRight',
      nice: true,
      range: 'height',
      domain: chartSettings.y2Scale?.domain ?? {
        data: 'values',
        field: 'yRight',
      },
    },
    {
      name: 'color',
      type: 'ordinal',
      range: 'category',
      // Domain is the full set of measure names, in y-then-y2 order, so colors
      // are stable regardless of which axis a measure sits on.
      domain: [...nameToPath.keys()],
    },
    getMeasureSeriesLabelScale(explore, allPaths),
  ];

  /**************************************
   * Marks
   *************************************/
  const marks: Mark[] = [];
  const data: Data[] = [];

  // Folded dataset for one axis: unpivots the axis's measures into (series, y)
  // rows and drops null measure values.
  const channelData = (name: string, paths: string[]): Data => ({
    name,
    source: 'values',
    transform: [
      {
        type: 'fold',
        fields: paths.map(p => `__values.${explore.fieldAt(p).name}`),
        as: ['series', 'y'],
      },
      {
        type: 'formula',
        as: 'series',
        expr: "replace(datum.series, '__values.', '')",
      },
      {type: 'filter', expr: 'isValid(datum.y)'},
    ],
  });

  // Build grouped bars for a channel on the given scale.
  const buildBars = (
    dataName: string,
    scaleName: string,
    offsetScaleName: string,
    paths: string[]
  ) => {
    scales.push({
      name: offsetScaleName,
      type: 'band',
      domain: paths.map(p => explore.fieldAt(p).name),
      range: {signal: `[0, bandwidth('xscale') * ${1 - BAR_GROUP_PADDING}]`},
    });
    const group: GroupMark = {
      name: `${dataName}_group`,
      type: 'group',
      from: {
        facet: {data: dataName, name: `${dataName}_facet`, groupby: ['x']},
      },
      interactive: false,
      encode: {enter: {x: {scale: 'xscale', field: 'x'}}},
      marks: [
        {
          name: `${dataName}_bars`,
          type: 'rect',
          from: {data: `${dataName}_facet`},
          zindex: 2,
          encode: {
            enter: {
              x: {
                offset: {
                  signal: `scale('${offsetScaleName}', datum.series) + bandwidth('xscale') * ${
                    BAR_GROUP_PADDING / 2
                  }`,
                } as VegaSignalRef,
              },
              width: {scale: offsetScaleName, band: 1},
              y: {scale: scaleName, field: 'y'},
              y2: {scale: scaleName, value: 0},
            },
            update: {fill: {scale: 'color', field: 'series'}},
          },
        } as RectMark,
      ],
    };
    marks.push(group);
  };

  // Build a line + points for a channel on the given scale, positioned at each
  // band's midpoint so it aligns with the categorical x-axis shared with bars.
  const buildLine = (dataName: string, scaleName: string) => {
    const seriesGroup: GroupMark = {
      name: `${dataName}_series_group`,
      type: 'group',
      from: {
        facet: {
          data: dataName,
          name: `${dataName}_series_facet`,
          groupby: ['series'],
        },
      },
      interactive: false,
      marks: [
        {
          name: `${dataName}_lines`,
          type: 'line',
          from: {data: `${dataName}_series_facet`},
          zindex: 3,
          encode: {
            enter: {
              x: {scale: 'xscale', field: 'x', band: 0.5},
              y: {scale: scaleName, field: 'y'},
              stroke: {scale: 'color', field: 'series'},
              strokeWidth: {value: 2},
            },
          },
        } as LineMark,
        {
          name: `${dataName}_points`,
          type: 'symbol',
          from: {data: `${dataName}_series_facet`},
          zindex: 4,
          encode: {
            enter: {
              x: {scale: 'xscale', field: 'x', band: 0.5},
              y: {scale: scaleName, field: 'y'},
              fill: {scale: 'color', field: 'series'},
              size: {value: 36},
            },
          },
        } as SymbolMark,
      ],
    };
    marks.push(seriesGroup);
  };

  const buildChannel = (
    channel: ComboYChannel,
    dataName: string,
    scaleName: string,
    offsetScaleName: string
  ) => {
    data.push(channelData(dataName, channel.fields));
    if (channel.chart === 'bar') {
      buildBars(dataName, scaleName, offsetScaleName, channel.fields);
    } else {
      buildLine(dataName, scaleName);
    }
  };

  // x-highlight band + record collection for tooltips (faceted over raw values).
  const highlightGroup: GroupMark = {
    name: 'x_group',
    type: 'group',
    from: {
      facet: {data: 'values', name: 'x_facet', groupby: ['x']},
    },
    data: [
      {
        name: 'x_facet_values',
        source: 'x_facet',
        transform: [
          {type: 'aggregate', fields: ['x'], ops: ['values'], as: ['v']},
        ],
      },
    ],
    interactive: false,
    encode: {enter: {x: {scale: 'xscale', field: 'x'}}},
    marks: [
      {
        name: 'x_highlight',
        type: 'rect',
        from: {data: 'x_facet_values'},
        zindex: 1,
        encode: {
          enter: {
            x: {value: 0},
            width: {scale: 'xscale', band: 1},
            y: {value: 0},
            y2: {signal: 'height'},
          },
          update: {
            fill: {value: '#4c72ba'},
            fillOpacity: [
              {
                test: 'brushXIn && length(brushXIn) > 0 && indexof(brushXIn, datum.x) > -1',
                value: 0.1,
              },
              {value: 0},
            ],
          },
        },
      } as RectMark,
    ],
  };
  marks.push(highlightGroup);

  buildChannel(settings.yChannel, 'left_values', 'yscale', 'xOffsetLeft');
  buildChannel(
    settings.y2Channel,
    'right_values',
    'yscaleRight',
    'xOffsetRight'
  );

  /**************************************
   * Axes
   *************************************/
  // v1 renders both axes without the measure-hover reference-line brushing that
  // the single-axis charts have (showBrushes: false). That feature needs a
  // family of brushMeasure* signals per axis; wiring it for two independent
  // scales is deferred. Cross-chart X highlighting (below) still works.
  const leftAxis = !chartSettings.yAxis.hidden
    ? createMeasureAxis({
        type: 'y',
        orient: 'left',
        scaleName: 'yscale',
        title: leftPaths.map(f => explore.fieldAt(f).getLabel()).join(', '),
        tickCount: chartSettings.yAxis.tickCount ?? 'ceil(height/40)',
        labelLimit: chartSettings.yAxis.width + 10,
        fieldPath: leftPaths[0],
        fieldRef: explore.fieldAt(leftPaths[0]).referenceId,
        brushMeasureRangeSourceId: 'brush-measure-range-left',
        showBrushes: false,
        axisSettings: chartSettings.yAxis,
        vegaConfig,
      })
    : null;

  const rightAxis =
    !chartSettings.yAxis.hidden && chartSettings.y2Axis
      ? createMeasureAxis({
          type: 'y',
          orient: 'right',
          scaleName: 'yscaleRight',
          title: rightPaths.map(f => explore.fieldAt(f).getLabel()).join(', '),
          tickCount: chartSettings.y2Axis.tickCount ?? 'ceil(height/40)',
          labelLimit: chartSettings.y2Axis.width + 10,
          fieldPath: rightPaths[0],
          fieldRef: explore.fieldAt(rightPaths[0]).referenceId,
          brushMeasureRangeSourceId: 'brush-measure-range-right',
          showBrushes: false,
          axisSettings: chartSettings.y2Axis,
          vegaConfig,
        })
      : null;

  // Only the left axis draws horizontal gridlines. The two axes have different
  // tick positions, so letting both grid would paint two misaligned sets of
  // lines — the standard dual-axis convention is to grid the primary axis only.
  if (rightAxis) {
    rightAxis.axis.grid = false;
  }

  /**************************************
   * Signals (cross-chart X brushing)
   *************************************/
  const xRef = xField.referenceId;
  const signals: Signal[] = [
    {name: 'malloyExplore'},
    {name: 'xFieldRefId', value: xRef},
    {name: 'yRefsMap', value: yRefsMap},
    {name: 'brushXSourceId', value: brushXSourceId},
    {name: 'brushIn', value: []},
    {name: 'brushXIn', update: 'getMalloyBrush(brushIn, xFieldRefId)'},
    {name: 'yIsBrushing', value: false},
  ];

  if (settings.interactive) {
    signals.push(
      {
        name: 'brushX',
        on: xRef
          ? [
              {
                events: '@x_highlight:mouseover',
                update:
                  "{ fieldRefId: xFieldRefId, value: [datum.x], sourceId: brushXSourceId, type: 'dimension'}",
              },
              {events: '@x_highlight:mouseout', update: 'null'},
            ]
          : [],
      },
      {
        name: 'brushOut',
        update: '[{ sourceId: brushXSourceId, data: brushX }]',
      }
    );
  }

  /**************************************
   * Spec
   *************************************/
  const spec: Spec = {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
    width: chartSettings.plotWidth,
    height: chartSettings.plotHeight,
    autosize: {type: 'none', resize: true, contains: 'padding'},
    data: [{name: 'values', values: [], transform: []}, ...data],
    padding: {...chartSettings.padding},
    scales,
    axes: [
      {
        orient: 'bottom',
        scale: 'xscale',
        title: xField.getLabel(),
        labelOverlap: 'greedy',
        labelSeparation: 4,
        ...chartSettings.xAxis,
        encode: {
          labels: {
            update: {
              ...(xIsDateorTime
                ? {
                    text: {
                      signal: `renderMalloyTime(malloyExplore, '${xFieldPath}', datum.value)`,
                    },
                  }
                : {}),
            },
          },
        },
      },
      ...(leftAxis ? [leftAxis.axis] : []),
      ...(rightAxis ? [rightAxis.axis] : []),
    ],
    legends: [],
    marks,
    signals,
  };

  /**************************************
   * Legend (one entry per measure)
   *************************************/
  const maxCharCt = allPaths.reduce(
    (max, f) => Math.max(max, explore.fieldAt(f).getLabel().length),
    0
  );
  const legendSize = Math.min(
    LEGEND_MAX,
    chartSettings.totalWidth * LEGEND_PERC,
    maxCharCt * 10 + 32
  );
  // Legend sits to the right of the secondary axis.
  (spec.padding as VegaPadding).right =
    (chartSettings.y2Axis ? chartSettings.y2Axis.width : 8) + legendSize;
  spec.legends!.push({
    fill: 'color',
    title: '',
    orient: 'right',
    titleLimit: legendSize - 20,
    labelLimit: legendSize - 40,
    padding: 8,
    offset: 4,
    encode: {
      labels: {
        update: {
          text: {scale: MEASURE_SERIES_LABEL_SCALE, field: 'value'},
        },
      },
    },
  });

  /**************************************
   * Data mapping
   *************************************/
  const mapMalloyDataToChartData: MalloyDataToChartDataHandler = data => {
    const getXValue = (row: RecordCell) => {
      const cell = row.column(xField.name);
      return cell.isTime() ? cell.value.valueOf() : cell.value;
    };
    const mappedData: Array<{
      __row: RecordCell;
      __values: {[name: string]: unknown};
      x: unknown;
    }> = [];
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      const xValue = getXValue(row);
      mappedData.push({
        __row: row,
        __values: row.allCellValues(),
        x: xValue ?? NULL_SYMBOL,
      });
    }
    return {data: mappedData, isDataLimited: false, dataLimitMessage: ''};
  };

  /**************************************
   * Tooltip
   *************************************/
  const tooltipMemo = new Map<Item, ChartTooltipEntry | null>();
  const getTooltipData = (item: Item, view: View): ChartTooltipEntry | null => {
    if (tooltipMemo.has(item)) return tooltipMemo.get(item)!;
    let tooltipData: ChartTooltipEntry | null = null;
    const colorScale = view.scale('color');
    if (getMarkName(item) === 'x_highlight' && item.datum) {
      const records: ComboDataRecord[] = item.datum.v ?? [];
      const first = records[0];
      if (first) {
        const row = first.__row;
        const title = xIsDateorTime
          ? renderDateTimeField(xField, new Date(first.x as number), {
              isDate: xField.isDate(),
              timeframe: xField.timeframe,
            })
          : String(first.x);
        tooltipData = {
          title: [title],
          entries: allPaths.map(path => {
            const f = explore.fieldAt(path);
            const value = row.column(f.name).value;
            return {
              label: f.getLabel(),
              value: f.isBasic() ? renderNumericField(f, value) : String(value),
              highlight: false,
              color: colorScale(f.name),
              entryType: 'list-item' as const,
            };
          }),
        };
      }
    }
    tooltipMemo.set(item, tooltipData);
    return tooltipData;
  };

  return {
    spec,
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: 'combo',
    title: plugin.chartDisplay.title,
    subtitle: plugin.chartDisplay.subtitle,
    mapMalloyDataToChartData,
    getTooltipData,
  };
}
