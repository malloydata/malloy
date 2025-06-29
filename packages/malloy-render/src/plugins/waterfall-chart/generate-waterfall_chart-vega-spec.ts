import type {
  MalloyDataToChartDataHandler,
  VegaChartProps,
} from '@/component/types';
import {convertLegacyToVizTag} from '@/component/tag-utils';
import type {RenderMetadata} from '@/component/render-result-metadata';
import {Field, RepeatedRecordCell} from '@/data_tree';
import type {RecordCell} from '@/data_tree';
import type {Spec} from 'vega';
import type {WaterfallChartPluginInstance} from './waterfall-chart-plugin';

export function generateWaterfallChartVegaSpec(
  metadata: RenderMetadata,
  plugin: WaterfallChartPluginInstance
): VegaChartProps {
  const {field: explore} = plugin;
  const settings = plugin.getMetadata().settings;
  const tag = convertLegacyToVizTag(explore.tag);
  const chartTag = tag.tag('viz');
  if (!chartTag)
    throw new Error(
      'Malloy Waterfall Chart: Tried to render a waterfall chart, but no viz=waterfall tag was found'
    );

  const spec: Spec = {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
    width: metadata.parentSize.width,
    height: metadata.parentSize.height,
    padding: 64,
    data: [{name: 'values'}],
    autosize: {
      type: 'none',
      resize: true,
      contains: 'padding',
    },
    scales: [
      {
        name: 'x',
        type: 'band',
        domain: {data: 'values', field: 'x'},
        range: 'width',
        padding: 0.1,
      },
      {
        name: 'y',
        type: 'linear',
        domain: {data: 'values', fields: ['start', 'end']},
        nice: true,
        range: 'height',
      },
    ],
    axes: [
      {scale: 'x', orient: 'bottom'},
      {scale: 'y', orient: 'left'},
    ],
    marks: [
      {
        type: 'rect',
        from: {data: 'values'},
        encode: {
          update: {
            x: {scale: 'x', field: 'x'},
            width: {scale: 'x', band: 1, offset: -1},
            y: {scale: 'y', signal: 'max(datum.start, datum.end)'},
            y2: {scale: 'y', signal: 'min(datum.start, datum.end)'},
            fill: {signal: 'datum.value >= 0 ? "#1877F2" : "#DC3545"'},
          },
        },
      },
    ],
  };

  const mapMalloyDataToChartData: MalloyDataToChartDataHandler = data => {
    const records: {x: string; value: number; start: number; end: number}[] =
      [];

    for (const row of data.rows as RecordCell[]) {
      const startVal = row.cellAt(settings.startField).value as number;
      const endVal = row.cellAt(settings.endField).value as number;
      let current = startVal;
      let sumOfIntermediates = 0;

      records.push({x: 'start', value: startVal, start: 0, end: startVal});
      const nestPath = JSON.parse(settings.xField).slice(0, 1);
      const xPath = JSON.parse(settings.xField).slice(-1);
      const yPath = JSON.parse(settings.yField).slice(-1);
      const nested = row.cellAt([nestPath]) as RepeatedRecordCell;
      for (const nRow of nested.rows) {
        const xVal = nRow.cellAt(xPath).value;
        const yVal = nRow.cellAt(yPath).value as number;
        const start = current;
        const end = current + yVal;
        records.push({x: String(xVal), value: yVal, start, end});
        current = end;
        sumOfIntermediates += yVal;
      }

      // Check if sum of intermediate values equals difference between start and end
      const expectedDiff = endVal - startVal;
      const actualDiff = sumOfIntermediates;
      if (Math.abs(expectedDiff - actualDiff) > 0.0001) {
        // Using small epsilon for floating point comparison
        const othersValue = expectedDiff - actualDiff;
        const start = current;
        const end = current + othersValue;
        records.push({x: 'Others*', value: othersValue, start, end});
        current = end;
      }

      records.push({x: 'end', value: endVal, start: 0, end: endVal});
    }

    return {data: records, isDataLimited: false};
  };

  return {
    spec,
    plotWidth: metadata.parentSize.width,
    plotHeight: metadata.parentSize.height,
    totalWidth: metadata.parentSize.width,
    totalHeight: metadata.parentSize.height,
    chartType: 'waterfall',
    chartTag,
    mapMalloyDataToChartData,
  };
}
