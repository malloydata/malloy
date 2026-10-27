/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Draws a chart written in Vega-Lite (scatter, shape map, segment map) as a
// live Vega view through ChartV2, so it gets the same tooltip and hover
// handling as the bar and line charts. Build the spec with ./vega-lite-spec.

import type {JSXElement} from 'solid-js';
import 'vega-interpreter';
import {ChartV2} from '@/component/chart/chart-v2';
import type {ChartTooltipEntry} from '@/component/types';
import type {RecordCell, RepeatedRecordCell} from '@/data_tree';
import {rowOfMark, type CompiledVegaLiteChart} from './vega-lite-spec';

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
