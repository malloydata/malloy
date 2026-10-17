/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The charts still written in Vega-Lite (scatter, shape map, segment map),
// drawn as a live Vega view through ChartV2 so they get Malloy's tooltip and
// hover handling, as the bar and line charts do.

import type {JSXElement} from 'solid-js';
import type {Item} from 'vega';
import {parse, type Runtime} from 'vega';
import * as lite from 'vega-lite';
import 'vega-interpreter';
import {ChartV2} from '@/component/chart/chart-v2';
import type {ChartTooltipEntry} from '@/component/types';
import type {Cell, RecordCell, RepeatedRecordCell} from '@/data_tree';
import {
  renderDateTimeField,
  renderNumberCell,
} from '@/component/render-numeric-field';
import {NULL_SYMBOL} from '@/util';

export type VegaLiteChartSize = {width: number; height: number};

export type CompiledVegaLiteChart = {
  runtime: Runtime;
  vegaSpec: unknown;
  size: VegaLiteChartSize;
};

/**
 * Compile a Vega-Lite spec whose rows come from the `values` data source
 * (`data: {name: VEGA_LITE_VALUES}`, from ./vega-lite-spec), sized to fill `size` exactly.
 */
export function compileVegaLiteChart(
  spec: lite.TopLevelSpec,
  size: VegaLiteChartSize,
  useVegaInterpreter = false
): CompiledVegaLiteChart {
  const sized = {
    ...spec,
    ...size,
    // ChartV2 sets the view to its container's size, so the spec's width and
    // height must be the whole chart, axes and legend included.
    autosize: {type: 'fit', contains: 'padding'},
  } as lite.TopLevelSpec;
  const vegaSpec = lite.compile(sized).spec;
  const runtime = parse(
    vegaSpec,
    undefined,
    useVegaInterpreter ? {ast: true} : undefined
  );
  return {runtime, vegaSpec, size};
}

function displayCell(cell: Cell): string {
  if (cell.isNull()) return NULL_SYMBOL;
  if (cell.isNumber()) return renderNumberCell(cell);
  if (cell.isTime()) {
    return renderDateTimeField(cell.field, cell.value, {
      isDate: cell.field.isDate(),
      timeframe: cell.field.timeframe,
    });
  }
  return String(cell.value);
}

/**
 * The tooltip for a mark drawn from one row: the row's first column as the
 * title, then each other column with its label and formatted value. Marks not
 * drawn from a row (a map's background states) have no tooltip.
 */
export function rowTooltip(item: Item): ChartTooltipEntry | null {
  const row = (item?.datum as {__row?: RecordCell} | undefined)?.__row;
  if (!row) return null;
  const [first, ...rest] = row.field.fields.filter(f => !f.isHidden());
  if (!first) return null;
  return {
    title: [displayCell(row.column(first.name))],
    entries: rest.map(f => ({
      label: f.getLabel(),
      value: displayCell(row.column(f.name)),
      highlight: false,
      entryType: 'list-item' as const,
    })),
  };
}

export function VegaLiteChart(props: {
  data: RepeatedRecordCell;
  chart: CompiledVegaLiteChart;
  // A row's record for the spec, or undefined to leave the row out.
  mapRow: (row: RecordCell) => Record<string, unknown> | undefined;
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
      getTooltipData={rowTooltip}
      useVegaInterpreter={props.useVegaInterpreter}
    />
  );
}
