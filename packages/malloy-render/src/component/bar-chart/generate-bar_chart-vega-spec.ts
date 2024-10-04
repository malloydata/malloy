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

const LEGEND_PERC = 0.4;
const LEGEND_MAX = 384;

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
  const yField = getFieldFromRootPath(explore, yFieldPath);
  const seriesField = seriesFieldPath
    ? getFieldFromRootPath(explore, seriesFieldPath)
    : null;

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

  const yAxis = !chartSettings.yAxis.hidden && {
    'orient': 'left',
    'scale': 'yscale',
    ...chartSettings.yAxis,
    'tickCount': chartSettings.yAxis.tickCount ?? {
      'signal': 'ceil(height/40)',
    },
    labelLimit: chartSettings.yAxis.width + 10,
    encode: {
      labels: {
        update: {
          text: {
            // Always use first y number style
            signal: `renderMalloyNumber(malloyExplore, '${yFieldPath}', datum.value)`,
          },
        },
      },
    },
  };

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
        // 'y2': {signal: 'height + length(datum.x)*8'},
        'y2': {signal: 'height'},
      },
      'update': {
        'fill': {
          'value': '#ccc',
        },
        'stroke': {
          value: 'black',
        },
        opacity: {value: 0.5},
      },
      'hover': {
        'fill': {
          'value': 'red',
        },
      },
    },
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
    'data': [valuesData],
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
        'domain': {'data': 'values', 'field': settings.isStack ? 'y1' : 'y'},
        'nice': true,
        'range': 'height',
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
        ...chartSettings.xAxis,
      },
      yAxis,
    ],
    legends: [],
    'marks': [groupMark],
    signals: [
      {
        name: 'malloyExplore',
      },
      {
        name: 'brushX',
        on: [
          {
            events: '@x_highlight:mouseover',
            update: 'datum.x',
          },
          {
            events: '@x_highlight:mouseout',
            update: 'null',
          },
        ],
      },
    ],
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
    });
  }

  const injectData: DataInjector = (field, data, spec) => {
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
      let tooltipData: ChartTooltipEntry | null = null;
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
      if (item.mark.name === 'x_highlight') {
        const x = item.datum.x;
        const records = item.datum.v;

        tooltipData = {
          title: [x],
          entries: records.map(rec => ({
            label: rec.series,
            value: formatY(rec),
            highlight: false,
            color: colorScale(rec.series),
          })),
        };
      }
      // Have to figure out how to handle faceted stuff which is missing relevant row information...
      if (item.datum && ['bars'].includes(item.mark.name)) {
        const itemData = item.datum;
        const groupRecords = item.mark.group.datum.v;
        tooltipData = {
          title: [itemData.x],
          entries: groupRecords.map(rec => ({
            label: rec.series,
            value: formatY(rec),
            highlight: itemData.series === rec.series,
            color: colorScale(rec.series),
          })),
        };
      }
      return tooltipData;
    },
  };
}
