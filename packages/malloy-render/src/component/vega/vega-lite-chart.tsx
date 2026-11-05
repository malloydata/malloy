/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Draws a chart written in Vega-Lite (scatter, shape map, segment map) as a
// live Vega view through ChartV2, so it gets the same tooltip and hover
// handling as the bar and line charts. Build the spec with ./vega-lite-spec.

import type {JSXElement} from 'solid-js';
import {parse, type Runtime} from 'vega';
import 'vega-interpreter';
import * as lite from 'vega-lite';
import {ChartV2} from '@/component/chart/chart-v2';
import type {ChartTooltipEntry} from '@/component/types';
import type {RecordCell, RepeatedRecordCell} from '@/data_tree';
import {mergeVegaConfigs} from './merge-vega-configs';
import {
  chartVegaConfig,
  rowOfMark,
  type VegaLiteChartSize,
} from './vega-lite-spec';

export type CompiledVegaLiteChart = {
  runtime: Runtime;
  vegaSpec: unknown;
  size: VegaLiteChartSize;
};

/**
 * Compile a Vega-Lite spec whose rows come from ChartV2's values data source,
 * sized to fill `size` exactly, and parse it with the theme and the host's
 * override (see chartVegaConfig).
 */
export function compileVegaLiteChart(
  spec: lite.TopLevelSpec,
  size: VegaLiteChartSize,
  vegaConfigOverride: Record<string, unknown>,
  useVegaInterpreter = false
): CompiledVegaLiteChart {
  const {config: chartConfig, ...vegaSpec} = lite.compile({
    ...spec,
    ...size,
    // ChartV2 sizes the view to its container, so the spec's width and height
    // must be the whole chart, axes and legend included.
    autosize: {type: 'fit', contains: 'padding'},
    // The override goes in here too, for keys only Vega-Lite reads, such as
    // `point`.
    config: mergeVegaConfigs({...spec.config}, vegaConfigOverride),
  }).spec;
  // A compiled spec's own config would outrank the parse config, so it moves
  // into the parse config, under the host's override.
  const runtime = parse(
    vegaSpec,
    chartVegaConfig(chartConfig, vegaConfigOverride),
    useVegaInterpreter ? {ast: true} : undefined
  );
  return {runtime, vegaSpec, size};
}

export function VegaLiteChart(props: {
  data: RepeatedRecordCell;
  chart: CompiledVegaLiteChart;
  // A row's record for the spec, or undefined to leave the row out.
  mapRow: (row: RecordCell) => Record<string, unknown> | undefined;
  tooltip: (row: RecordCell) => ChartTooltipEntry | null;
  useVegaInterpreter?: boolean;
}): JSXElement {
  const values = props.data.rows.flatMap(row => {
    const record = props.mapRow(row);
    return record ? [{...record, __row: row}] : [];
  });
  return (
    <ChartV2
      data={props.data}
      values={values}
      runtime={props.chart.runtime}
      vegaSpec={props.chart.vegaSpec}
      plotWidth={props.chart.size.width}
      plotHeight={props.chart.size.height}
      totalWidth={props.chart.size.width}
      totalHeight={props.chart.size.height}
      getTooltipData={item => {
        const row = rowOfMark(item);
        return row ? props.tooltip(row) : null;
      }}
      useVegaInterpreter={props.useVegaInterpreter}
    />
  );
}
