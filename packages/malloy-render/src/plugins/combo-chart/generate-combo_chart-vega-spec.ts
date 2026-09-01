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
  Axis,
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
  // a line axis is nice-scaled without forcing 0. Explicit `min`/`max` bounds
  // (from `y.min`/`y2.max` etc.) override the corresponding end.
  const axisMinMax = (
    paths: string[],
    includeZero: boolean,
    bounds: {min?: number; max?: number}
  ) => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of paths) {
      const f = explore.fieldAt(p);
      if (f.minNumber !== undefined) min = Math.min(min, f.minNumber);
      if (f.maxNumber !== undefined) max = Math.max(max, f.maxNumber);
    }
    if (!isFinite(min)) min = 0;
    if (!isFinite(max)) max = 0;
    let lo = includeZero ? Math.min(0, min) : min;
    let hi = includeZero ? Math.max(0, max) : max;
    if (bounds.min !== undefined) lo = bounds.min;
    if (bounds.max !== undefined) hi = bounds.max;
    return [lo, hi] as [number, number];
  };

  const leftIsBar = settings.yChannel.chart === 'bar';
  const rightIsBar = settings.y2Channel.chart === 'bar';
  const leftMinMax = axisMinMax(leftPaths, leftIsBar, settings.yChannel);
  const rightMinMax = axisMinMax(rightPaths, rightIsBar, settings.y2Channel);

  // Every bar-drawing measure across both axes, left-then-right (matches the
  // color scale order). Drives both the shared `xOffset` bar scale and the
  // per-band width budget used to auto-fit the x limit below.
  const barPaths = [
    ...(leftIsBar ? leftPaths : []),
    ...(rightIsBar ? rightPaths : []),
  ];

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

  // Cap the number of x bands. A numeric `x.limit` is honored directly;
  // otherwise auto-fit to the plot width, budgeting each band by how many bars
  // share it (mirrors bar chart). Lines don't widen a band, so a lines-only
  // combo budgets a single slot per band. Rows outside this set are dropped in
  // mapMalloyDataToChartData, which sets isDataLimited / the "Showing N of M"
  // note.
  const barsPerBand = Math.max(1, barPaths.length);
  const maxSizePerXGroup = chartSettings.isSpark ? 2 : 8 * barsPerBand;
  const xLimit =
    typeof settings.xChannel.limit === 'number'
      ? settings.xChannel.limit
      : Math.floor(chartSettings.plotWidth / maxSizePerXGroup);
  const xValuesToPlot = xValues.slice(0, Math.max(1, xLimit));

  /**************************************
   * Scales
   *************************************/
  const scales: Scale[] = [
    {
      name: 'xscale',
      type: 'band',
      domain: [...xValuesToPlot],
      range: 'width',
      paddingOuter: 0.05,
      round: true,
    },
    {
      name: 'yscale',
      // Disable nice for sparklines to maximize variation (matches line_chart).
      nice: chartSettings.isSpark ? false : true,
      range: 'height',
      // Fallback (no precomputed domain: spark size, or `.independent`) is the
      // per-axis extent of the folded `left_values` dataset. The raw `values`
      // rows carry only {x, __row, __values}; the measure value lives under
      // field `y` on the folded dataset, so the domain must read it there.
      domain: chartSettings.yScale.domain ?? {data: 'left_values', field: 'y'},
      // Pin either end when explicitly set; holds even for the data-driven
      // (independent / spark) domain above.
      ...(settings.yChannel.min !== undefined && {
        domainMin: settings.yChannel.min,
      }),
      ...(settings.yChannel.max !== undefined && {
        domainMax: settings.yChannel.max,
      }),
    },
    {
      name: 'yscaleRight',
      nice: chartSettings.isSpark ? false : true,
      range: 'height',
      domain: chartSettings.y2Scale?.domain ?? {
        data: 'right_values',
        field: 'y',
      },
      ...(settings.y2Channel.min !== undefined && {
        domainMin: settings.y2Channel.min,
      }),
      ...(settings.y2Channel.max !== undefined && {
        domainMax: settings.y2Channel.max,
      }),
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

  // Build grouped bars for a channel on the given scale. All bar measures
  // (from either axis) share the single `xOffset` band scale built below, so
  // bars sit side-by-side within a band even when both axes draw bars — they
  // never overlap. The scale collapses to a single channel's measures when only
  // that channel draws bars, preserving the bar+line default's layout.
  const buildBars = (dataName: string, scaleName: string) => {
    // Bars are non-interactive so pointer events fall through to the
    // full-band `x_highlight` rect behind them; that single background target
    // drives the tooltip/brush for the whole band (see highlightGroup). Without
    // this, bars (drawn on top) swallow the hover and the tooltip only appears
    // in the gaps between them.
    const barMark: RectMark = {
      name: `${dataName}_bars`,
      type: 'rect',
      from: {data: `${dataName}_facet`},
      zindex: 2,
      interactive: false,
      encode: {
        enter: {
          x: {
            offset: {
              signal: `scale('xOffset', datum.series) + bandwidth('xscale') * ${
                BAR_GROUP_PADDING / 2
              }`,
            } as VegaSignalRef,
          },
          width: {scale: 'xOffset', band: 1},
          y: {scale: scaleName, field: 'y'},
          y2: {scale: scaleName, value: 0},
        },
        update: {fill: {scale: 'color', field: 'series'}},
      },
    };
    const group: GroupMark = {
      name: `${dataName}_group`,
      type: 'group',
      from: {
        facet: {data: dataName, name: `${dataName}_facet`, groupby: ['x']},
      },
      interactive: false,
      encode: {enter: {x: {scale: 'xscale', field: 'x'}}},
      marks: [barMark],
    };
    marks.push(group);
  };

  // Build a line + points for a channel on the given scale, positioned at each
  // band's midpoint so it aligns with the categorical x-axis shared with bars.
  const buildLine = (
    channel: ComboYChannel,
    dataName: string,
    scaleName: string
  ) => {
    // Point (dot) visibility: `points=true`/`false` forces it; otherwise auto —
    // hidden once a series has more than one point (matching line_chart), shown
    // for a single-point series or when its x-band is brushed. `count` comes
    // from the series-facet aggregate below.
    const pointFillOpacity =
      channel.showPoints === true
        ? {value: 1}
        : channel.showPoints === false
          ? {value: 0}
          : [
              {
                test: 'isValid(brushXIn) ? indexof(brushXIn, datum.x) > -1 : false',
                value: 1,
              },
              {signal: 'item.mark.group.datum.count > 1 ? 0 : 1'},
            ];

    const lineMark: LineMark = {
      name: `${dataName}_lines`,
      type: 'line',
      from: {data: `${dataName}_series_facet`},
      zindex: 3,
      interactive: false,
      encode: {
        enter: {
          x: {scale: 'xscale', field: 'x', band: 0.5},
          y: {scale: scaleName, field: 'y'},
          stroke: {scale: 'color', field: 'series'},
          strokeWidth: {value: channel.lineWidth ?? 2},
        },
      },
    };
    const pointMark: SymbolMark = {
      name: `${dataName}_points`,
      type: 'symbol',
      from: {data: `${dataName}_series_facet`},
      zindex: 4,
      interactive: false,
      encode: {
        enter: {
          x: {scale: 'xscale', field: 'x', band: 0.5},
          y: {scale: scaleName, field: 'y'},
          fill: {scale: 'color', field: 'series'},
          size: {value: 36},
        },
        update: {
          fillOpacity: pointFillOpacity,
        },
      },
    };
    const seriesGroup: GroupMark = {
      name: `${dataName}_series_group`,
      type: 'group',
      from: {
        facet: {
          data: dataName,
          name: `${dataName}_series_facet`,
          groupby: ['series'],
          // Per-series point count drives the auto dot-hiding rule above.
          aggregate: {fields: [''], ops: ['count'], as: ['count']},
        },
      },
      interactive: false,
      marks: [lineMark, pointMark],
    };
    marks.push(seriesGroup);
  };

  const buildChannel = (
    channel: ComboYChannel,
    dataName: string,
    scaleName: string
  ) => {
    data.push(channelData(dataName, channel.fields));
    if (channel.chart === 'bar') {
      buildBars(dataName, scaleName);
    } else {
      buildLine(channel, dataName, scaleName);
    }
  };

  // Single grouped-bar offset scale shared by both axes, over the union of every
  // bar-drawing measure (see barPaths), so each bar gets a distinct slot within
  // the band — side-by-side, never stacked on top of each other. Only built when
  // at least one axis draws bars.
  if (barPaths.length > 0) {
    scales.push({
      name: 'xOffset',
      type: 'band',
      domain: barPaths.map(p => explore.fieldAt(p).name),
      range: {signal: `[0, bandwidth('xscale') * ${1 - BAR_GROUP_PADDING}]`},
    });
  }

  // x-highlight band + record collection for tooltips (faceted over raw values).
  // This full-height, full-band rect is the only interactive mark in the plot
  // (bars/lines/points are interactive:false), so it catches hover anywhere in
  // a band — including on top of a bar or point — and drives the tooltip/brush.
  const xHighlightMark: RectMark = {
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
  };
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
          // Re-materialize `x` alongside the collected values so the highlight
          // band's `datum.x` is defined: the outgoing brush is `[datum.x]` and
          // the sibling-lit test reads `indexof(brushXIn, datum.x)`. Without the
          // second (`min`→`x`) aggregate, `datum.x` is undefined and cross-chart
          // X highlighting never fires (mirrors bar chart).
          {
            type: 'aggregate',
            fields: ['x', 'x'],
            ops: ['values', 'min'],
            as: ['v', 'x'],
          },
        ],
      },
    ],
    interactive: false,
    encode: {enter: {x: {scale: 'xscale', field: 'x'}}},
    marks: [xHighlightMark],
  };
  marks.push(highlightGroup);

  buildChannel(settings.yChannel, 'left_values', 'yscale');
  buildChannel(settings.y2Channel, 'right_values', 'yscaleRight');

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

  // Tint each axis's title, ticks and domain line to match its mark's color,
  // using the same `color` scale the marks read. This makes the two independent
  // scales read as two separate rulers — the defense against misreading the
  // bar/line crossover as meaningful (see the axis scaling note in
  // docs/renderer_tags_overview.md). The numeric value labels are left at the
  // default (dark) color so they stay legible; the colored title + axis line
  // carry the binding. Only applied when an axis carries a single measure, so
  // the color is unambiguous; a multi-measure axis (each measure its own color)
  // keeps the neutral default. Opt out entirely with `color_axes=false`.
  const tintAxisToMeasure = (axis: Axis, paths: string[]) => {
    if (paths.length !== 1) return;
    const colorRef = {scale: 'color', value: explore.fieldAt(paths[0]).name};
    axis.encode = axis.encode ?? {};
    axis.encode.title = {update: {fill: colorRef}};
    axis.encode.ticks = {update: {stroke: colorRef}};
    axis.encode.domain = {update: {stroke: colorRef}};
  };
  if (settings.colorAxes) {
    if (leftAxis) tintAxisToMeasure(leftAxis.axis, leftPaths);
    if (rightAxis) tintAxisToMeasure(rightAxis.axis, rightPaths);
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
  // Spark charts are tiny inline glyphs with deliberately near-zero padding
  // (see getChartLayoutSettings) and no secondary axis; a legend + right
  // padding would swamp the plot, so skip both — matching how bar/line only
  // draw a legend when they have a series.
  if (!chartSettings.isSpark) {
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
  }

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
    // Only rows whose x is in the plotted (capped) band set survive; the rest
    // are dropped so the cap holds (mirrors bar chart's out-of-limit skip).
    const plotSet = new Set(xValuesToPlot);
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      const xValue = getXValue(row);
      if (!plotSet.has(xValue ?? NULL_SYMBOL)) continue;
      mappedData.push({
        __row: row,
        __values: row.allCellValues(),
        x: xValue ?? NULL_SYMBOL,
      });
    }
    const isDataLimited = xValues.length > xValuesToPlot.length;
    return {
      data: mappedData,
      isDataLimited,
      dataLimitMessage: isDataLimited
        ? `Showing ${xValuesToPlot.length.toLocaleString()} of ${xValues.length.toLocaleString()}`
        : '',
    };
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
        // Guard the null x before `new Date()` — an unmapped time value comes
        // through as NULL_SYMBOL, and `new Date(NULL_SYMBOL)` renders as
        // "Invalid Date" (matches line_chart's guard).
        const title =
          first.x === NULL_SYMBOL
            ? NULL_SYMBOL
            : xIsDateorTime
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
