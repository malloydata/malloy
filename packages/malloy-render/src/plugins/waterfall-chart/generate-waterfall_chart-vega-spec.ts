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
import {getChartLayoutSettings} from '@/component/chart/chart-layout-settings';
import type {NestField} from '@/data_tree';

// Helper function to extract synthetic data for chart layout calculation
function getSyntheticDataForLayout(
  explore: NestField,
  settings: any,
  data?: {rows: RecordCell[]}
): {
  xField: Field;
  yField: Field;
  getYMinMax: () => [number, number];
} {
  // For x-axis, we need to consider all x labels including 'start', 'end', 'Others*', and actual category values
  const nestPath = JSON.parse(settings.xField).slice(0, 1);
  const xPath = JSON.parse(settings.xField).slice(-1);
  const yPath = JSON.parse(settings.yField).slice(-1);

  // Get the nested field to access x values
  const nestedField = explore.fieldAt([nestPath]);
  const xField = nestedField.isRepeatedRecord() ? nestedField.fields[0] : explore.fields[0];
  const yField = nestedField.isRepeatedRecord() ? nestedField.fields[1] : explore.fields[1];

  // Collect all possible x-axis labels
  const xLabels = new Set<string>(['start', 'end', 'Others*']);

  // Add actual x values from field metadata if available
  if (xField.valueSet && xField.valueSet.size > 0) {
    for (const val of xField.valueSet) {
      xLabels.add(String(val));
    }
  }

  // Find the longest x label
  let maxXString = '';
  for (const label of xLabels) {
    if (label.length > maxXString.length) {
      maxXString = label;
    }
  }

  // Create lazy calculation for y-axis min/max
  const getYMinMax = (): [number, number] => {
    // Use field metadata if available
    if (yField.minNumber !== undefined && yField.maxNumber !== undefined) {
      // Add some padding for the waterfall visualization
      const range = yField.maxNumber - yField.minNumber;
      return [
        Math.min(0, yField.minNumber - range * 0.1),
        yField.maxNumber + range * 0.1
      ];
    }

    // Fallback to data calculation if provided
    let min = 0;
    let max = 0;

    if (data && data.rows) {
      for (const row of data.rows as RecordCell[]) {
        const startVal = row.cellAt(settings.startField).value as number;
        const endVal = row.cellAt(settings.endField).value as number;

        min = Math.min(min, startVal, endVal);
        max = Math.max(max, startVal, endVal);

        // Calculate intermediate values
        let current = startVal;
        const nested = row.cellAt([nestPath]) as RepeatedRecordCell;
        if (nested && nested.rows) {
          for (const nRow of nested.rows) {
            const yVal = nRow.cellAt(yPath).value as number;
            current += yVal;
            min = Math.min(min, current);
            max = Math.max(max, current);
          }
        }
      }
    }

    return [min, max];
  };

  // Create a synthetic x field with the max string value
  const syntheticXField = {
    ...xField,
    maxString: maxXString,
    valueSet: xLabels,
  } as Field;

  return {
    xField: syntheticXField,
    yField,
    getYMinMax,
  };
}

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

  // Pre-process data to get synthetic values for chart layout calculation
  const syntheticData = getSyntheticDataForLayout(explore, settings);

  // Get chart layout settings with synthetic data
  const chartSettings = getChartLayoutSettings(explore, chartTag, {
    metadata,
    xField: syntheticData.xField,
    yField: syntheticData.yField,
    chartType: 'waterfall',
    getYMinMax: syntheticData.getYMinMax,
  });

  const spec: Spec = {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
    width: chartSettings.plotWidth,
    height: chartSettings.plotHeight,
    padding: chartSettings.padding,
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
        domain: chartSettings.yScale.domain || {data: 'values', fields: ['start', 'end']},
        nice: true,
        range: 'height',
      },
    ],
    axes: [
      {
        scale: 'x',
        orient: 'bottom' as const,
        labelAngle: chartSettings.xAxis.labelAngle,
        labelAlign: chartSettings.xAxis.labelAlign,
        labelBaseline: chartSettings.xAxis.labelBaseline,
        labelLimit: chartSettings.xAxis.labelLimit,
        title: syntheticData.xField.name || 'Category',
        titlePadding: 10,
      },
      {
        scale: 'y',
        orient: 'left' as const,
        tickCount: chartSettings.yAxis.tickCount ?? 'ceil(height/40)',
        labelLimit: chartSettings.yAxis.width + 10,
        title: syntheticData.yField.name || 'Value',
      },
    ].filter(axis => {
      // Hide axes for spark charts
      if (chartSettings.isSpark) {
        return false;
      }
      return true;
    }),
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
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: 'waterfall',
    chartTag,
    mapMalloyDataToChartData,
  };
}
