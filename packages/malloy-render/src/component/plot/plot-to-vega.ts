import {Explore, ExploreField, Tag} from '@malloydata/malloy';
import {getChartLayoutSettings} from '../chart-layout-settings';
import {PlotSpec} from './plot-spec';
import {
  RenderResultMetadata,
  VegaChartProps,
  VegaConfigHandler,
  VegaSpec,
} from '../types';
import {baseVegaConfig} from './base-vega-config';
import {mergeVegaConfigs} from './merge-vega-configs';

export const grayMedium = '#727883';
export const gridGray = '#E5E7EB';

export function plotToVega(
  plotSpec: PlotSpec,
  options: {
    field: Explore | ExploreField;
    metadata: RenderResultMetadata;
    chartTag: Tag;
    chartType: string;
    getVegaConfigOverride?: VegaConfigHandler;
  }
): VegaChartProps {
  const chartSettings = getChartLayoutSettings(
    options.field,
    options.metadata,
    options.chartTag,
    {chartType: 'plot'}
  );

  const vegaConfig = mergeVegaConfigs(
    baseVegaConfig(),
    options.getVegaConfigOverride?.(options.chartType) ?? {}
  );
  const vegaSpec: VegaSpec = {
    '$schema': 'https://vega.github.io/schema/vega/v5.json',
    'width': chartSettings.plotWidth,
    'height': chartSettings.plotHeight,
    'config': vegaConfig,
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

  vegaSpec.scales.push(xScale);
  vegaSpec.scales.push(yScale);

  for (const plotMark of plotSpec.marks) {
    const vegaMark: VegaSpec = {};

    // Set up mark data pipeline with any transformations
    const markData = {
      name: plotMark.id,
      source: 'table',
      transform: [],
    };
    vegaSpec.data.push(markData);

    if (plotMark.type === 'bar_y') {
      vegaMark.type = 'rect';
      vegaMark.from = {data: plotMark.id};
      const xField = plotMark.x ?? plotSpec.x.fields.at(0);
      const yField = plotMark.y ?? plotSpec.y.fields.at(0);
      vegaMark.encode = {
        enter: {
          x: {scale: 'xscale', field: xField, band: 0.1},
          width: {scale: 'xscale', band: 0.8},
          y: {scale: 'yscale', field: yField},
          y2: {'scale': 'yscale', 'value': 0},
          fill: {value: vegaSpec.config.range.category[0]},
        },
      };

      vegaSpec.marks.push(vegaMark);
    }
  }

  if (!chartSettings.xAxis.hidden)
    vegaSpec.axes.push({
      orient: 'bottom',
      scale: 'xscale',
      title: plotSpec.x.fields.join(', '),
      labelAngle: chartSettings.xAxis.labelAngle,
      labelLimit: chartSettings.xAxis.labelSize,
      labelAlign: chartSettings.xAxis.labelAlign,
      labelBaseline: chartSettings.xAxis.labelBaseline,
      maxExtent: chartSettings.xAxis.height,
    });

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
    specType: 'vega',
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: options.chartType,
  };
}
