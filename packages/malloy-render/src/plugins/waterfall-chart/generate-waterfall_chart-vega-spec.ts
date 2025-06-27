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
    padding: 5,
    data: [{name: 'values'}],
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
            fill: {value: '#1877F2'},
          },
        },
      },
    ],
  };

  const mapMalloyDataToChartData: MalloyDataToChartDataHandler = data => {
    const records: {x: string; value: number; start: number; end: number}[] = [];

    const startPath = Field.pathFromString(settings.startField);
    const endPath = Field.pathFromString(settings.endField);
    const xPath = Field.pathFromString(settings.xField);
    const yPath = Field.pathFromString(settings.yField);
    const nestPath = xPath.slice(0, -1);

    for (const row of data.rows as RecordCell[]) {
      const startVal = row.cellAt(startPath).value as number;
      const endVal = row.cellAt(endPath).value as number;
      let current = startVal;
      records.push({x: 'start', value: startVal, start: 0, end: startVal});
      const nested = row.cellAt(nestPath) as RepeatedRecordCell;
      for (const nRow of nested.rows) {
        const xVal = nRow.cellAt(xPath.slice(-1)).value;
        const yVal = nRow.cellAt(yPath.slice(-1)).value as number;
        const start = current;
        const end = current + yVal;
        records.push({x: String(xVal), value: yVal, start, end});
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
