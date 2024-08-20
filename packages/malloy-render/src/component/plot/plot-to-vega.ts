import {Explore, ExploreField} from '@malloydata/malloy';
import {getChartSettings} from '../chart-settings';
import {PlotSpec} from './plot-spec';
import {RenderResultMetadata, VegaChartProps, VegaSpec} from '../types';
import {getFieldFromRelativePath} from './util';

export const grayMedium = '#727883';
export const gridGray = '#E5E7EB';

const DATE_TIME_FORMATS = {
  'year': '%Y',
  'quarter': '%B',
  'month': '%B',
  'week': '%b %d',
  'date': '%a %d',
  'hours': '%I %p',
  'minutes': '%I:%M',
  'seconds': ':%S',
  'milliseconds': '.%L',
};

export function plotToVega(
  plotSpec: PlotSpec,
  options: {
    field: Explore | ExploreField;
    metadata: RenderResultMetadata;
  }
): VegaChartProps {
  const chartSettings = getChartSettings(
    options.field,
    options.metadata,
    plotSpec
  );
  console.log({chartSettings});
  const vegaSpec: VegaSpec = {
    '$schema': 'https://vega.github.io/schema/vega/v5.json',
    'width': chartSettings.plotWidth,
    'height': chartSettings.plotHeight,
    'config': {
      axisY: {
        gridColor: gridGray,
        tickColor: gridGray,
        domain: false,

        labelFont: 'Inter, sans-serif',
        labelFontSize: 10,
        labelFontWeight: 'normal',
        labelColor: grayMedium,
        labelPadding: 5,
        titleColor: grayMedium,
        titleFont: 'Inter, sans-serif',
        titleFontSize: 12,
        titleFontWeight: 500,
        titlePadding: 10,
        labelOverlap: false,
      },
      axisX: {
        gridColor: gridGray,
        tickColor: gridGray,
        tickSize: 0,
        domain: false,
        labelFont: 'Inter, sans-serif',
        labelFontSize: 10,
        labelFontWeight: 'normal',
        labelPadding: 5,
        labelColor: grayMedium,
        titleColor: grayMedium,
        titleFont: 'Inter, sans-serif',
        titleFontSize: 12,
        titleFontWeight: 500,
        titlePadding: 10,
      },
      view: {
        strokeWidth: 0,
      },
    },
    'data': [
      {
        name: 'table',
        values: [],
      },
    ],
    'marks': [],
    'scales': [],
    'legends': [],
    'axes': [],
    'autosize': {
      type: 'none',
      resize: true,
      contains: 'content',
    },
    'padding': chartSettings.padding,
  };

  // use spec.x/y.fields to look up all data for x axis
  const xScale: VegaSpec = {
    name: 'xscale',
    type: plotSpec.x.type === 'nominal' ? 'band' : 'linear',
    domain: {data: 'table', field: plotSpec.x.fields.at(0)},
    range: 'width',
  };

  if (xScale.type === 'band') {
    xScale.paddingInner = 0.1;
    xScale.paddingOuter = 0.05;
    xScale.round = true;
  }

  const yScale: VegaSpec = {
    name: 'yscale',
    type: plotSpec.y.type === 'nominal' ? 'band' : 'linear',
    domain: chartSettings.yScale.domain ?? {
      data: 'table',
      fields: plotSpec.y.fields,
    },
    range: 'height',
  };
  if (yScale.type === 'linear') {
    yScale.nice = true;
  }

  const colorScale: VegaSpec = {
    name: 'color',
    type: 'ordinal',
    range: ['#4FA8BF', '#EDB74A', '#CC6F33'], // need bigger range...
    domain: {data: 'table', field: plotSpec.color.fields.at(0)},
  };
  const hasColorField = plotSpec.color.fields.at(0);
  if (hasColorField) {
    vegaSpec.scales.push(colorScale);
    vegaSpec.legends.push({
      fill: 'color',
      title: plotSpec.color.fields.at(0),
      orient: 'none',
      direction: 'horizontal',
      // offset: 10,
      legendX: -30,
      legendY: -40,
    });
  }

  vegaSpec.scales.push(xScale);
  vegaSpec.scales.push(yScale);

  // If chart is faceting, create a facet layer first
  const fxField = plotSpec.fx.fields.at(0);
  let groupMark;
  if (fxField) {
    xScale.domain.field = fxField;
    let innerDomain = {data: 'table', field: plotSpec.x.fields.at(0)};

    groupMark = {
      type: 'group',
      from: {
        facet: {
          data: 'table',
          name: 'facet',
          groupby: fxField,
        },
      },
      data: [],
      encode: {
        enter: {
          x: {scale: 'xscale', field: fxField},
        },
      },
      signals: [{name: 'width', 'update': "bandwidth('xscale')"}],
      scales: [
        {
          name: 'pos',
          type: 'band',
          range: 'width',
          paddingOuter: 0.2,
          // Make sure to share domain here
          domain: innerDomain,
        },
      ],
      marks: [],
    };
  }

  if (groupMark) {
    vegaSpec.marks.push(groupMark);
  }

  for (const plotMark of plotSpec.marks) {
    const vegaMark: VegaSpec = {};

    // Set up mark data pipeline with any transformations
    const markData = {
      name: plotMark.id,
      source: 'table',
      transform: [],
    };

    if (plotMark.type === 'bar_y') {
      vegaMark.type = 'rect';
      vegaMark.from = {data: plotMark.id};
      const xField = plotMark.x ?? plotSpec.x.fields.at(0);
      const yField = plotMark.y ?? plotSpec.y.fields.at(0);
      const fillField = plotMark.fill;
      const xScaleName = groupMark ? 'pos' : 'xscale';
      vegaMark.encode = {
        enter: {
          x: {scale: xScaleName, field: xField, band: 0.1},
          width: {scale: xScaleName, band: groupMark ? 1 : 0.8},
          y: {scale: 'yscale', field: yField},
          y2: {'scale': 'yscale', 'value': 0},
          fill: fillField
            ? {field: plotMark.fill, scale: 'color'}
            : {value: '#53B2C8'},
          // fillOpacity: {value: 0.5},
        },
      };
    }
    if (groupMark) {
      groupMark.marks.push(vegaMark);
      const markData = {
        name: plotMark.id,
        source: 'facet',
        transform: [],
      };
      groupMark.data.push(markData);
    } else {
      vegaSpec.marks.push(vegaMark);
      vegaSpec.data.push(markData);
    }
  }

  if (!chartSettings.xAxis.hidden) {
    const xAxis: Record<string, any> = {
      orient: 'bottom',
      scale: 'xscale',
      title: groupMark
        ? plotSpec.fx.fields.join(', ')
        : plotSpec.x.fields.join(', '),
      labelAngle: chartSettings.xAxis.labelAngle,
      labelLimit: chartSettings.xAxis.labelSize,
      labelAlign: chartSettings.xAxis.labelAlign,
      labelBaseline: chartSettings.xAxis.labelBaseline,
      maxExtent: chartSettings.xAxis.height,
    };
    // If x field is Date/Time, format; TODO: handling field existence, field lookups, multiple field types
    const xField = getFieldFromRelativePath(
      options.field,
      plotSpec.x.fields.at(0)!
    )!;
    console.log({xField, isQuery: xField!.isQuery()});
    if (
      xField &&
      !xField.isExplore() &&
      xField.isAtomicField() &&
      (xField.isDate() || xField.isTimestamp())
    ) {
      xAxis['formatType'] = 'utc';
      xAxis['format'] = DATE_TIME_FORMATS;
    }
    vegaSpec.axes.push(xAxis);
  }

  if (!chartSettings.yAxis.hidden)
    vegaSpec.axes.push({
      orient: 'left',
      scale: 'yscale',
      grid: true,
      maxExtent: chartSettings.yAxis.width,
      labelLimit: chartSettings.yAxis.width + 10,
      tickCount: chartSettings.yAxis.tickCount ?? {signal: 'ceil(height/40)'},
      title: [...new Set(yScale.domain.fields)]
        .filter(s => typeof s === 'string')
        .join(', '),
    });

  return {
    spec: vegaSpec,
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
  };
}
