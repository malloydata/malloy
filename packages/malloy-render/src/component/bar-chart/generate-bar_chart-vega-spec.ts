import {DateField, Explore, Tag, TimestampField} from '@malloydata/malloy';
import {BarChartSettings} from './get-bar_chart-settings';
import {
  ChartTooltipEntry,
  DataInjector,
  RenderResultMetadata,
  VegaChartProps,
  VegaSpec,
} from '../types';
import {getChartLayoutSettings} from '../chart-layout-settings';
import {getFieldFromRootPath} from '../plot/util';
import {Item, scale, View} from 'vega';
import {renderTimeString} from '../render-time';
import {renderNumericField} from '../render-numeric-field';
import {grayMedium, gridGray} from '../plot/base-vega-config';
import {applyRenderer} from '../apply-renderer';
import {useResultContext} from '../result-context';

const LEGEND_PERC = 0.4;
const LEGEND_MAX = 384;

function invertObject(obj: Record<string, string>): Record<string, string> {
  const inverted: Record<string, string> = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
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
  const xFieldPath = settings.xChannel.fields.at(0);
  const yFieldPath = settings.yChannel.fields.at(0);
  const seriesFieldPath = settings.seriesChannel.fields.at(0);

  if (!xFieldPath) throw new Error('Malloy Bar Chart: Missing x field');
  if (!yFieldPath) throw new Error('Malloy Bar Chart: Missing y field');

  const xField = getFieldFromRootPath(explore, xFieldPath);
  const xRef = xField.isAtomicField() ? xField.referenceId : null;
  const yField = getFieldFromRootPath(explore, yFieldPath);
  const yRef = yField.isAtomicField() ? yField.referenceId : null;
  const seriesField = seriesFieldPath
    ? getFieldFromRootPath(explore, seriesFieldPath)
    : null;
  const seriesRef =
    seriesField && seriesField.isAtomicField() ? seriesField.referenceId : null;
  const yRefsMap = settings.yChannel.fields.reduce((map, fieldPath) => {
    const field = getFieldFromRootPath(explore, fieldPath);
    return {
      ...map,
      [fieldPath]: field && field.isAtomicField() ? field.referenceId : null,
    };
  }, {});
  const yRefsMapInverted = invertObject(yRefsMap);

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

  const yDomainMin = Math.min(0, yMin);
  const yDomainMax = Math.max(0, yMax);

  const chartSettings = getChartLayoutSettings(explore, metadata, chartTag, {
    xField,
    yField,
    chartType: 'bar_chart',
    getYMinMax: () => [yDomainMin, yDomainMax],
  });

  console.log({chartSettings});

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

  const isDimensionalSeries = Boolean(seriesField);
  const isMeasureSeries = Boolean(settings.yChannel.fields.length > 1);
  const hasSeries = isDimensionalSeries || isMeasureSeries;
  const isGrouping = hasSeries && !settings.isStack;
  const isStacking = hasSeries && settings.isStack;

  const yAxisTickCt = chartSettings.yAxis.tickCount ?? 'ceil(height/40)';

  const yAxis = !chartSettings.yAxis.hidden
    ? {
        'orient': 'left',
        'scale': 'yscale',
        'title': settings.yChannel.fields.join(', '),
        ...chartSettings.yAxis,
        'tickCount': {'signal': `${yAxisTickCt}`},
        labelLimit: chartSettings.yAxis.width + 10,
        encode: {
          labels: {
            enter: {
              text: {
                // Always use first y number style
                signal: `renderMalloyNumber(malloyExplore, '${yFieldPath}', datum.value, datum, item)`,
              },
            },
            update: {
              text: {
                // Always use first y number style
                signal: `renderMalloyNumber(malloyExplore, '${yFieldPath}', datum.value, datum, item)`,
              },
              fillOpacity: [
                {
                  test: 'brushMeasureIn !== "empty" ? (datum.index !== 0 && datum.index !== 1) : false',
                  value: 0,
                },
                {
                  test: 'brushMeasureRangeIn && datum.value >= (brushMeasureRangeIn[0] - (invert("yscale", 0)-invert("yscale", 20))) && datum.value <= (brushMeasureRangeIn[1] + (invert("yscale", 0)-invert("yscale", 20)))',
                  value: 0,
                },
                {
                  value: 1,
                },
              ],
            },
          },
        },
      }
    : null;

  const barGroupPadding = 0.25;
  const barPadding = 0;

  let xOffset: VegaSpec = {};
  let xWidth: VegaSpec = {};
  if (isStacking) {
    xOffset.signal = `bandwidth("xscale")*${barGroupPadding / 2}`;
    xWidth = {scale: 'xscale', 'band': 1 - barGroupPadding};
  } else if (isGrouping) {
    xOffset.signal = `scale('xOffset', datum.series)+bandwidth("xscale")*${
      barGroupPadding / 2
    }`;
    xWidth = {scale: 'xOffset', 'band': 1 - barPadding};
  } else {
    xOffset.signal = `scale('xOffset', datum.series)+bandwidth("xscale")*${
      barGroupPadding / 2
    }`;
    xWidth = {scale: 'xOffset', 'band': 1 - barGroupPadding};
  }

  const groupMark: VegaSpec = {
    name: 'x_group',
    from: {
      facet: {
        data: 'values',
        name: 'fa',
        groupby: ['x'],
        aggregate: {
          'fields': ['x'],
          ops: ['values'],
          as: ['v'],
        },
      },
    },
    data: [
      {
        name: 'test',
        source: 'fa',
        transform: [
          {
            type: 'aggregate',
            ops: ['values', 'min'],
            as: ['v', 'x'],
            fields: ['x', 'x'],
          },
        ],
      },
    ],
    type: 'group',
    interactive: false,
    encode: {
      'enter': {
        'x': {
          'scale': 'xscale',
          'field': 'x',
        },
      },
    },
    marks: [],
  };

  // Bars
  const barMark: VegaSpec = {
    name: 'bars',
    type: 'rect',
    from: {
      data: 'fa',
    },
    zindex: 2,
    'encode': {
      'enter': {
        'x': {
          offset: xOffset,
        },
        'width': xWidth,
        'y': {
          'scale': 'yscale',
          'field': settings.isStack ? 'y0' : 'y',
        },
        'y2': settings.isStack
          ? {'scale': 'yscale', 'field': 'y1'}
          : {'scale': 'yscale', 'value': 0},
      },
      'update': {
        'fill': {
          'scale': 'color',
          'field': 'series',
        },
        fillOpacity: [
          // TODO: merge these
          {
            test: 'brushSeriesIn === datum.series',
            value: 1,
          },
          {
            test: 'brushSeriesIn && brushSeriesIn != datum.series',
            value: 0.35,
          },
          {
            test: isMeasureSeries
              ? `length(brushMeasureListIn) > 0 && indexof(brushMeasureListIn, datum.series) > -1`
              : `false`,
            value: 1,
          },
          {
            test: isMeasureSeries
              ? `length(brushMeasureListIn) > 0 && indexof(brushMeasureListIn, datum.series) === -1`
              : `false`,
            value: 0.35,
          },
          // {
          //   test: `brushXIn && length(brushXIn) > 0 && indexof(brushXIn, datum.x) > -1`,
          //   value: 1,
          // },
          {
            test: `brushXIn && length(brushXIn) > 0 && indexof(brushXIn, datum.x) === -1`,
            value: 0.35, //0.75,
          },
          {
            test: `brushMeasureRangeIn && (datum.y < brushMeasureRangeIn[0] || datum.y > brushMeasureRangeIn[1])`,
            value: 0.35, //0.75,
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
      data: 'test',
    },
    zindex: 1,
    'encode': {
      'enter': {
        'x': {
          value: 0,
        },
        'width': {'scale': 'xscale', 'band': 1},
        'y': {
          'value': 0,
        },
        'y2': {signal: 'height'},
      },
      'update': {
        'fill': {
          'value': '#4c72ba',
        },
        'fillOpacity': [
          {
            'test': 'brushXIn ? indexof(brushXIn,datum.x) > -1 : false',
            value: 0.1, // for prod: 0.075, for screenshare demo: 0.1
          },
          {value: 0},
        ],
      },
    },
  };

  const yAxisOverlay: VegaSpec = {
    name: 'y_axis_overlay',
    type: 'rect',
    encode: {
      enter: {
        x: {
          value: -chartSettings.yAxis.width + chartSettings.yAxis.yTitleSize,
        },
        x2: {value: 0},
        y: {value: 0},
        y2: {signal: 'height'},
        fill: {value: 'transparent'},
      },
    },
  };

  const xAxisOverlay: VegaSpec = {
    name: 'x_axis_overlay',
    type: 'rect',
    encode: {
      enter: {
        y: {
          signal: `height + ${chartSettings.xAxis.height} + 4`,
        },
        y2: {signal: 'height'},
        x: {value: 0},
        x2: {signal: 'width'},
        fill: {value: 'transparent'},
      },
    },
  };

  const xAxisRangeBrushRect: VegaSpec = {
    name: 'x_axis_range_brush',
    type: 'rect',
    encode: {
      enter: {
        y: {
          signal: `height + ${chartSettings.xAxis.height} + 4`,
        },
        y2: {signal: 'height'},
        fill: {
          'value': '#4c72ba',
        },
        fillOpacity: {value: 0.1},
      },
      update: {
        x: {
          signal:
            'xRangeBrushValues ? scale("xscale",xRangeBrushValues[0]) : 0',
        },
        x2: {
          signal:
            'xRangeBrushValues ? scale("xscale",xRangeBrushValues[xRangeBrushValues.length-1]) + bandwidth("xscale") : 0',
        },
      },
    },
  };

  const xAxisRangeBrush: VegaSpec = {
    type: 'group',
    marks: [
      xAxisRangeBrushRect,
      {
        type: 'rule',
        encode: {
          enter: {
            y: {
              signal: `height + ${chartSettings.xAxis.height} + 4`,
            },
            y2: {signal: 'height'},
            stroke: {value: '#b5bcc9'},
            strokeWidth: {value: 0.5},
          },
          update: {
            x: {
              signal:
                'xRangeBrushValues ? scale("xscale",xRangeBrushValues[0])+0.5 : 0',
            },
            x2: {
              signal:
                'xRangeBrushValues ? scale("xscale",xRangeBrushValues[0])+0.5 : 0',
            },
            opacity: [
              {
                test: 'xRangeBrushValues',
                value: 1,
              },
              {value: 0},
            ],
          },
        },
      },
      {
        type: 'rule',
        encode: {
          enter: {
            y: {
              signal: `height + ${chartSettings.xAxis.height} + 4`,
            },
            y2: {signal: 'height'},
            stroke: {value: '#b5bcc9'},
            strokeWidth: {value: 0.5},
          },
          update: {
            x: {
              signal:
                'xRangeBrushValues ? scale("xscale",xRangeBrushValues[xRangeBrushValues.length-1])-0.5  + bandwidth("xscale") : 0',
            },
            x2: {
              signal:
                'xRangeBrushValues ? scale("xscale",xRangeBrushValues[xRangeBrushValues.length-1])-0.5  + bandwidth("xscale") : 0',
            },
            opacity: [
              {
                test: 'xRangeBrushValues',
                value: 1,
              },
              {value: 0},
            ],
          },
        },
      },
    ],
  };

  const opacityRefLineSignal = {
    // TODO: won't this break with a value of 0?
    signal: 'brushMeasureIn === "empty" || yIsBrushing ? 0 : 1',
  };

  const referenceLines: VegaSpec = {
    name: 'y_reference_line_group',
    type: 'group',
    marks: [
      {
        name: 'y_reference_lines_backdrop',
        type: 'rect',
        // from: {
        //   data: 'referenceLineData',
        // },
        encode: {
          enter: {
            x: {
              value:
                -chartSettings.yAxis.width + chartSettings.yAxis.yTitleSize - 2,
            },
            x2: {value: 0},
            fill: {
              value: {
                'x1': 1,
                'y1': 0,
                'x2': 1,
                'y2': 1,
                'gradient': 'linear',
                stops: [
                  {offset: 0, color: 'rgba(255,255,255,0)'},
                  {offset: 0.275, color: 'white'},
                  {offset: 0.7, color: 'white'},
                  {offset: 1, color: 'rgba(255,255,255,0)'},
                ],
              },
            },
            height: {value: 40},
          },
          update: {
            y: {
              signal: `brushMeasureIn ? scale("yscale",brushMeasureIn)-25 : 0`,
            },
            opacity: opacityRefLineSignal,

            // y: {scale: 'yscale', field: 'value', offset: -25},
          },
        },
      },
      {
        name: 'y_reference_lines',
        type: 'rule',
        // from: {
        //   data: 'referenceLineData',
        // },
        encode: {
          enter: {
            x: {
              value:
                -chartSettings.yAxis.width + chartSettings.yAxis.yTitleSize,
            },
            x2: {signal: 'width'},
            stroke: {value: 'black'},
            strokeOpacity: {value: 0.5},
            strokeDash: {value: [4, 2]},
          },
          update: {
            y: {
              // scale: 'yscale', field: 'value'
              signal: `brushMeasureIn ? scale("yscale",brushMeasureIn) : 0`,
            },
            y2: {
              // scale: 'yscale', field: 'value'
              signal: `brushMeasureIn ? scale("yscale",brushMeasureIn) : 0`,
            },
            opacity: opacityRefLineSignal,
          },
        },
      },
      {
        name: 'y_reference_line_label_backdrop',
        type: 'text',
        // from: {
        //   data: 'referenceLineData',
        // },
        encode: {
          // TODO: reuse across marks, get values from config?
          enter: {
            x: {
              value:
                -chartSettings.yAxis.width + chartSettings.yAxis.yTitleSize,
            },
            dy: {value: -4},
            align: {value: 'left'},
            baseline: {value: 'alphabetic'},
            fill: {value: 'white'},
            stroke: {value: 'white'},
            strokeWidth: {value: 3},
            fontSize: {value: 10},
            fontWeight: {value: 'normal'},
            font: {value: 'Inter, sans-serif'},
            strokeOpacity: {value: 1},
          },
          update: {
            y: {
              signal: `brushMeasureIn ? scale("yscale",brushMeasureIn) : 0`,
              // scale: 'yscale', field: 'value'
            },
            text: {
              signal: `brushMeasureIn ? renderMalloyNumber(malloyExplore, '${yFieldPath}', brushMeasureIn) : ''`,
            },
            opacity: opacityRefLineSignal,
          },
        },
      },
      {
        name: 'y_reference_line_label',
        type: 'text',
        // from: {
        //   data: 'referenceLineData',
        // },
        encode: {
          enter: {
            x: {
              value:
                -chartSettings.yAxis.width + chartSettings.yAxis.yTitleSize,
            },
            dy: {value: -4},
            align: {value: 'left'},
            baseline: {value: 'alphabetic'},
            fill: {value: grayMedium},
            fontSize: {value: 10},
            fontWeight: {value: 'normal'},
            font: {value: 'Inter, sans-serif'},
          },
          update: {
            y: {
              // scale: 'yscale', field: 'value'
              signal: `brushMeasureIn ? scale("yscale",brushMeasureIn) : 0`,
            },
            text: {
              signal: `brushMeasureIn ? renderMalloyNumber(malloyExplore, '${yFieldPath}', brushMeasureIn) : ''`,
            },
            opacity: opacityRefLineSignal,
          },
        },
      },
    ],
  };

  const yAxisRangeBrushRect: VegaSpec = {
    name: 'y_axis_range_brush',
    type: 'rect',
    encode: {
      enter: {
        x: {
          signal: `-${chartSettings.yAxis.width} + ${chartSettings.yAxis.yTitleSize} - 4`,
        },
        x2: {signal: 'width'},
        fill: {
          'value': '#4c72ba',
        },
        fillOpacity: {value: 0.1},
      },
      update: {
        y: {
          signal:
            'brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[0]) : 0',
        },
        y2: {
          signal:
            'brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[brushMeasureRangeIn.length-1]) : 0',
        },
      },
    },
  };

  const yAxisRangeBrush: VegaSpec = {
    type: 'group',
    marks: [
      yAxisRangeBrushRect,
      // y range lines
      {
        type: 'rule',
        encode: {
          enter: {
            x: {
              signal: `-${chartSettings.yAxis.width} + ${chartSettings.yAxis.yTitleSize} - 4`,
            },
            x2: {signal: 'width'},
            stroke: {value: '#b5bcc9'},
            strokeWidth: {value: 0.5},
          },
          update: {
            y: {
              signal:
                'brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[0])+0.5 : 0',
            },
            y2: {
              signal:
                'brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[0])+0.5 : 0',
            },
            opacity: [
              {
                test: 'brushMeasureRangeIn',
                value: 1,
              },
              {value: 0},
            ],
          },
        },
      },
      {
        type: 'rule',
        encode: {
          enter: {
            x: {
              signal: `-${chartSettings.yAxis.width} + ${chartSettings.yAxis.yTitleSize} - 4`,
            },
            x2: {signal: 'width'},
            stroke: {value: '#b5bcc9'},
            strokeWidth: {value: 0.5},
          },

          update: {
            y: {
              signal:
                'brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[1]) : 0',
            },
            y2: {
              signal:
                'brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[1]) : 0',
            },
            opacity: [
              {
                test: 'brushMeasureRangeIn',
                value: 1,
              },
              {value: 0},
            ],
          },
        },
      },
      // y range labels
      {
        name: 'y_range_label_backdrop',
        type: 'text',
        encode: {
          // TODO: reuse across marks, get values from config?
          enter: {
            x: {
              value:
                -chartSettings.yAxis.width + chartSettings.yAxis.yTitleSize,
            },
            dy: {value: 11},
            align: {value: 'left'},
            baseline: {value: 'alphabetic'},
            fill: {value: 'white'},
            stroke: {value: 'white'},
            strokeWidth: {value: 3},
            fontSize: {value: 10},
            fontWeight: {value: 'normal'},
            font: {value: 'Inter, sans-serif'},
            strokeOpacity: {value: 1},
          },
          update: {
            y: {
              signal: `brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[0])+0.5 : 0`,
            },
            text: {
              signal: `brushMeasureRangeIn ? renderMalloyNumber(malloyExplore, '${yFieldPath}', brushMeasureRangeIn[0]) : ''`,
            },
            opacity: [
              {
                test: 'brushMeasureRangeIn',
                value: 1,
              },
              {value: 0},
            ],
          },
        },
      },
      {
        name: 'y_range_line_label',
        type: 'text',
        encode: {
          enter: {
            x: {
              value:
                -chartSettings.yAxis.width + chartSettings.yAxis.yTitleSize,
            },
            dy: {value: 11},
            align: {value: 'left'},
            baseline: {value: 'alphabetic'},
            fill: {value: grayMedium},
            fontSize: {value: 10},
            fontWeight: {value: 'normal'},
            font: {value: 'Inter, sans-serif'},
          },
          update: {
            y: {
              signal: `brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[0]) : 0`,
            },
            text: {
              signal: `brushMeasureRangeIn ? renderMalloyNumber(malloyExplore, '${yFieldPath}', brushMeasureRangeIn[0]) : ''`,
            },
            opacity: [
              {
                test: 'brushMeasureRangeIn',
                value: 1,
              },
              {value: 0},
            ],
          },
        },
      },
      {
        name: 'y_range_label_backdrop_2',
        type: 'text',
        encode: {
          // TODO: reuse across marks, get values from config?
          enter: {
            x: {
              value:
                -chartSettings.yAxis.width + chartSettings.yAxis.yTitleSize,
            },
            dy: {value: -4},
            align: {value: 'left'},
            baseline: {value: 'alphabetic'},
            fill: {value: 'white'},
            stroke: {value: 'white'},
            strokeWidth: {value: 3},
            fontSize: {value: 10},
            fontWeight: {value: 'normal'},
            font: {value: 'Inter, sans-serif'},
            strokeOpacity: {value: 1},
          },
          update: {
            y: {
              signal: `brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[1]) : 0`,
            },
            text: {
              signal: `brushMeasureRangeIn ? renderMalloyNumber(malloyExplore, '${yFieldPath}', brushMeasureRangeIn[1]) : ''`,
            },
            opacity: [
              {
                test: 'brushMeasureRangeIn',
                value: 1,
              },
              {value: 0},
            ],
          },
        },
      },
      {
        name: 'y_range_line_label_2',
        type: 'text',
        encode: {
          enter: {
            x: {
              value:
                -chartSettings.yAxis.width + chartSettings.yAxis.yTitleSize,
            },
            dy: {value: -4},
            align: {value: 'left'},
            baseline: {value: 'alphabetic'},
            fill: {value: grayMedium},
            fontSize: {value: 10},
            fontWeight: {value: 'normal'},
            font: {value: 'Inter, sans-serif'},
          },
          update: {
            y: {
              signal: `brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[1]) : 0`,
            },
            text: {
              signal: `brushMeasureRangeIn ? renderMalloyNumber(malloyExplore, '${yFieldPath}', brushMeasureRangeIn[1]) : ''`,
            },
            opacity: [
              {
                test: 'brushMeasureRangeIn',
                value: 1,
              },
              {value: 0},
            ],
          },
        },
      },
    ],
  };

  groupMark.marks.push(highlightMark, barMark);

  // Data  and transforms
  const valuesData: VegaSpec = {name: 'values', values: [], transform: []};
  if (isMeasureSeries) {
    valuesData.transform.push({
      type: 'fold',
      fields: [...settings.yChannel.fields.map(f => `__source.${f}`)],
      as: ['series', 'y'],
    });
    settings.yChannel.fields.forEach(f => {
      valuesData.transform.push({
        type: 'formula',
        as: 'series',
        expr: "replace(datum.series, '__source.', '')",
      });
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

  const brushXSourceId = `brush-x_` + crypto.randomUUID();
  const brushSeriesSourceId = `brush-series_` + crypto.randomUUID();
  const brushMeasureSourceId = `brush-measure_` + crypto.randomUUID();
  const brushMeasureRangeSourceId =
    `brush-measure-range_` + crypto.randomUUID();

  const marks = [groupMark];
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
    // TODO: handle multiple y fields
    {
      name: 'measureFieldRefId',
      value: yRef,
    },

    {
      name: 'yRefToFieldPath',
      value: yRefsMapInverted,
    },
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
      update: `getMalloyBrush(brushIn, measureFieldRefId, 'measure') || "empty"`,
    },
    // TODO: brushMeasureRangeIn: need to read this brush based on more than just field, because now we have multiple per field (point and range). arg
    {
      name: 'brushMeasureRangeIn',
      update: `getMalloyBrush(brushIn, measureFieldRefId, 'measure-range') || null`,
    },
    {
      name: 'brushMeasureListIn',
      // TODO: should this work besides measure series charts?
      update: isMeasureSeries
        ? `pluck(getMalloyMeasureBrushes(brushIn, ${JSON.stringify(
            Object.values(yRefsMap)
          )}, ${JSON.stringify(yRefsMapInverted)}),'fieldPath')`
        : `[]`,
    },
  ];
  if (settings.interactive) {
    if (!settings.hideReferences) marks.push(referenceLines);
    marks.push(yAxisOverlay, yAxisRangeBrush, xAxisOverlay, xAxisRangeBrush);
    signals.push(
      ...[
        {
          name: 'brushX',
          on: xRef
            ? [
                // temp disable while figuring out range stuff
                {
                  events: '@x_highlight:mouseover, @bars:mouseover',
                  update: `{ fieldRefId: '${xRef}', value: [datum.x], sourceId: '${brushXSourceId}', type: 'dimension'}`,
                },
                {
                  events: '@x_highlight:mouseout, @bars:mouseout',
                  update: 'null',
                },
                // TODO disabling for now until figure out interaction with range brush
                // {
                //   events: '@x_axis_overlay:mousemove',
                //   update: `{ fieldRefId: '${xRef}', sourceId: '${brushXSourceId}', value: [invert("xscale",x(item()))]}`,
                // },
                // {
                //   events: '@x_axis_overlay:mouseout',
                //   update: 'null',
                // },
                {
                  events: {signal: 'xRangeBrushValues'},
                  update: `xRangeBrushValues ? { fieldRefId: '${xRef}', sourceId: '${brushXSourceId}', value: xRangeBrushValues, type: 'dimension' } : null`,
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
                    events: '@bars:mouseover',
                    update: `{ fieldRefId: '${seriesRef}', value: datum.series, sourceId: '${brushSeriesSourceId}', type: 'dimension' }`,
                  },
                  {
                    events: '@bars:mouseout',
                    update: 'null',
                  },
                  {
                    events:
                      '@legend_labels:mouseover, @legend_symbols:mouseover',
                    update: `{ fieldRefId: '${seriesRef}', value: datum.value, sourceId: '${brushSeriesSourceId}', type: 'dimension' }`,
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
                ? `{ fieldRefId: ${JSON.stringify(
                    yRefsMap
                  )}[datum.series], value: datum['${
                    isStacking ? 'y1' : 'y'
                  }'], sourceId: '${brushMeasureSourceId}', type: 'measure'}`
                : `{ fieldRefId: '${yRef}', value: datum['${
                    isStacking ? 'y1' : 'y'
                  }'], sourceId: '${brushMeasureSourceId}', type: 'measure'}`,
            },
            {
              events: '@bars:mouseout',
              update: 'null',
            },
            {
              events: '@y_axis_overlay:mousemove',
              // TODO: could snap stepCt be data driven and axis size driven? Think [0,15_000_000] vs. [0, 0.02]. What should step sizes be for those? 10k for both? seems excessive
              update: `yIsBrushing ? null : { fieldRefId: '${yRef}', sourceId: '${brushMeasureSourceId}', value: event.shiftKey ? invert("yscale",y(item())) : snapValue([domain('yscale')[0],domain('yscale')[1]], 1000,invert("yscale",y(item()))), type: 'measure'}`,
            },
            {
              events: '@y_axis_overlay:mouseout',
              update: 'null',
            },
            ...(isMeasureSeries
              ? [
                  {
                    events:
                      '@legend_labels:mouseover, @legend_symbols:mouseover',
                    update: `{ fieldRefId: ${JSON.stringify(
                      yRefsMap
                    )}[datum.value], value: null, sourceId: '${brushMeasureSourceId}', type: 'measure' }`,
                  },
                  {
                    events: '@legend_labels:mouseout, @legend_symbols:mouseout',
                    update: 'null',
                  },
                ]
              : []),
          ],
        },
        {
          name: 'brushOut',
          update: `[{ sourceId: '${brushXSourceId}', data: brushX }, { sourceId: '${brushSeriesSourceId}', data: brushSeries, debounce: { time: 100, strategy: 'on-empty' } },{ sourceId: '${brushMeasureSourceId}', data: brushMeasure, debounce: { time: 100, strategy: 'on-empty' } }, { sourceId: '${brushMeasureRangeSourceId}', data: brushMeasureRange } ]`,
        },

        {
          name: 'testOverlay',
          on: [
            {
              events: '@y_axis_overlay:mousemove',
              update: 'invert("yscale",y(item()))',
            },
          ],
        },
        {
          name: 'testLegend',
          on: [
            {
              events: '@legend_labels:mouseover',
              update: 'datum',
            },
          ],
        },
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
            // DELTA TO MOVE IT
            // {
            //   'events': {'signal': 'delta'},
            //   'update': 'clampRange([anchor[0] + delta, anchor[1] + delta], 0, width)',
            // },
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
        // y brush
        {
          name: 'yRangeBrush',
          on: [
            {
              events: '@y_axis_overlay:mousedown',
              update: `event.shiftKey ? [invert('yscale',y()), invert('yscale',y())] : [snapValue([domain('yscale')[0],domain('yscale')[1]], 1000,invert('yscale',y())), snapValue([domain('yscale')[0],domain('yscale')[1]], 1000,invert('yscale',y()))]`,
            },
            {
              'events':
                '[@y_axis_overlay:mousedown, window:mouseup] > window:mousemove!',
              'update': `event.shiftKey ? [yRangeBrush[0], invert('yscale',clamp(y(), 0, height))]: [snapValue([domain('yscale')[0],domain('yscale')[1]], 1000,yRangeBrush[0]), snapValue([domain('yscale')[0],domain('yscale')[1]], 1000,invert('yscale',clamp(y(), 0, height)))]`,
            },
            // shortcut to clear it? if click clears it, then we can't move it
            // TODO for now, double click. later can work in moving, edge move handle semantics
            {
              'events': '@y_axis_range_brush:dblclick',
              'update': 'null',
            },
            // DELTA TO MOVE IT
            // {
            //   'events': {'signal': 'delta'},
            //   'update': 'clampRange([anchor[0] + delta, anchor[1] + delta], 0, width)',
            // },
          ],
        },
        {
          name: 'yRangeBrushSorted',
          update: 'yRangeBrush ? extent(yRangeBrush) : null',
        },
        {
          name: 'yRangeBrushValues',
          update: `yRangeBrushSorted`,
          //'yRangeBrushSorted ? [invert("yscale", yRangeBrushSorted[1]), invert("yscale", yRangeBrushSorted[0])] : null',
        },
        {
          // TODO: label the outs as Out
          name: 'brushMeasureRange',
          update: `yRangeBrushValues && yRangeBrushValues[0] !== yRangeBrushValues[1] ? { fieldRefId: '${yRef}', sourceId: '${brushMeasureRangeSourceId}', value: yRangeBrushValues, type: 'measure-range'} : null`,
        },
        {
          name: 'yIsBrushing',
          // update: 'yRangeBrush ? true : false',
          on: [
            {
              'events':
                '[@y_axis_overlay:mousedown, window:mouseup] > window:mousemove!',
              'update': 'true',
            },
            {
              'events': 'window:mouseup',
              'update': 'false',
            },
          ],
          // on: [
          //   {
          //     signal: 'yRangeBrushValues ? true : false',
          //   },
          // ],
        },
      ]
    );
  } else {
    // TODO: better way to handle this kind of thing
    signals.push({
      name: 'yIsBrushing',
      value: false,
    });
  }

  const spec: VegaSpec = {
    '$schema': 'https://vega.github.io/schema/vega/v5.json',
    'width': chartSettings.plotWidth,
    'height': chartSettings.plotHeight,
    'autosize': {
      type: 'none',
      resize: true,
      contains: 'content',
    },
    'padding': chartSettings.padding,
    'data': [
      valuesData,
      // {
      //   name: 'referenceLineData',
      //   on: [
      //     {trigger: 'brushMeasureIn', remove: true},
      //     {
      //       trigger: 'brushMeasureIn',
      //       insert:
      //         'brushMeasureIn === "empty" || yIsBrushing ? [] : [{"value": brushMeasureIn }]',
      //     },
      //   ],
      // },
    ],
    'scales': [
      {
        'name': 'xscale',
        'type': 'band',
        'domain': shouldShareXDomain
          ? [...xMeta.values]
          : {data: 'values', field: 'x'},
        'range': 'width',
        'paddingOuter': 0.05,
        'round': true,
      },
      {
        'name': 'yscale',
        // 'domain': {'data': 'values', 'field': settings.isStack ? 'y1' : 'y'},
        'nice': true,
        'range': 'height',
        domain: settings.isStack
          ? {data: 'values', field: 'y1'}
          : chartSettings.yScale.domain ?? {data: 'values', field: 'y'},
      },
      {
        'name': 'color',
        'type': 'ordinal',
        'range': 'category',
        'domain': shouldShareSeriesDomain
          ? [...seriesMeta!.values]
          : {
              'data': 'values',
              'field': 'series',
            },
      },
      {
        'name': 'xOffset',
        'type': 'band',
        'domain': shouldShareSeriesDomain
          ? [...seriesMeta!.values]
          : {'data': 'values', 'field': 'series'},
        'range': {
          'signal': `[0,bandwidth('xscale') * ${
            isGrouping ? 1 - barGroupPadding : 1
          }]`,
        },
      },
    ],

    'axes': [
      {
        'orient': 'bottom',
        'scale': 'xscale',
        'title': xFieldPath,
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
      // TODO clean this stuff up
      ...(yAxis ? [yAxis] : []),
    ],
    legends: [],
    marks,
    signals,
  };

  // Legend
  // TODO: No legend for sparks
  let maxCharCt = 0;
  if (hasSeries) {
    if (isDimensionalSeries) {
      const meta = metadata.field(seriesField!);
      maxCharCt = meta.maxString?.length ?? 0;
      maxCharCt = Math.max(maxCharCt, seriesField!.name.length);
    } else {
      maxCharCt = settings.yChannel.fields.reduce(
        (max, f) => Math.max(max, f.length),
        maxCharCt
      );
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

    spec.padding.right = legendSize;
    spec.legends.push({
      fill: 'color',
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
                      test: `length(brushMeasureListIn) > 0 && indexof(brushMeasureListIn, datum.value) > -1`,
                      value: 1,
                    },
                    {
                      test: `length(brushMeasureListIn) > 0 && indexof(brushMeasureListIn, datum.value) === -1`,
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
    const dateTimeFields = field.allFields.filter(
      f => f.isAtomicField() && (f.isDate() || f.isTimestamp())
    ) as (DateField | TimestampField)[];
    data.forEach(row => {
      const a = row[0];

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
    const mappedData = data.map(row => ({
      __source: row,
      x: row[xFieldPath],
      y: row[yFieldPath],
      // TODO: could we put the yFieldPath here instead of '', and treat single bar charts like a series chart with no legend?
      series: seriesFieldPath ? row[seriesFieldPath] : yFieldPath,
    }));
    spec.data[0].values = mappedData;
  };

  // const colorScale = scale('ordinal')
  //   .domain([minVal, maxVal])
  //   .nice()
  //   .range([chartHeight, 0]);

  // Memoize tooltip data
  const fullMemo = new Map<Item, Map<View, ChartTooltipEntry | null>>();

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
      if (!fullMemo.has(item)) {
        fullMemo.set(item, new Map());
      }
      if (!fullMemo.get(item)!.has(view)) {
        fullMemo.get(item)!.set(view, null);
      }
      if (fullMemo.get(item)!.get(view)) {
        return fullMemo.get(item)!.get(view)!;
      }
      const customTooltipFields = explore.allFields.filter(f =>
        f.tagParse().tag.has('tooltip')
      );
      let tooltipData: ChartTooltipEntry | null = null;
      let records: any[] = [];
      const colorScale = view.scale('color');
      const formatY = rec => {
        const fieldName = rec.series;
        const field = isDimensionalSeries
          ? yField
          : getFieldFromRootPath(explore, fieldName);
        const value = rec.y;
        return field.isAtomicField()
          ? renderNumericField(field, value)
          : String(value);
      };
      // @ts-ignore
      if (item.mark.name === 'x_highlight') {
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
      let highlightedSeries: string | null = null;
      // Have to figure out how to handle faceted stuff which is missing relevant row information...
      // @ts-ignore
      if (item.datum && ['bars'].includes(item.mark.name)) {
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
      // TODO: figure out what to do for measure lists
      const customTooltipRecords =
        !seriesRef && records.length === 1 ? records : highlightedRecords;

      if (tooltipData) {
        const customEntries: ChartTooltipEntry['entries'] = [];
        // try custom fields
        customTooltipFields.forEach(f => {
          if (f.isAtomicField() || f.isExploreField()) {
            customTooltipRecords.forEach(rec => {
              customEntries.push({
                label: f.name,

                value: () =>
                  applyRenderer({
                    field: f,
                    dataColumn: rec.__source.__malloyDataRecord.cell(f.name),
                    resultMetadata: metadata,
                    tag: f.tagParse().tag,
                  }).renderValue,
                // renderNumericField(f, rec.__source[f.name]),
                highlight: false,
                color: '',
                // TODO: better system / naming convention for this
                entryType: f.isExploreField() ? 'block' : 'list-item',
                ignoreHighlightState: true,
              });
            });
          }
        });
        const insertPosition = !seriesRef
          ? tooltipData.entries.length
          : tooltipData.entries.findIndex(e => e.highlight) + 1;
        tooltipData.entries.splice(insertPosition, 0, ...customEntries);
      }
      fullMemo.get(item)!.set(view, tooltipData);
      return tooltipData;
    },
  };
}
