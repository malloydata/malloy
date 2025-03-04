/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Tag} from '@malloydata/malloy-tag';
import {Item, Spec, View} from 'vega';
import {JSX} from 'solid-js';
import {Field, RecordCell, RepeatedRecordCell} from './render-result-metadata';

export type VegaSignalRef = {signal: string};
export type VegaPadding = {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
};
export type MalloyDataToChartDataHandler = (
  data: RepeatedRecordCell
) => unknown[];
export type VegaChartProps = {
  spec: Spec;
  plotWidth: number;
  plotHeight: number;
  totalWidth: number;
  totalHeight: number;
  chartType: string;
  chartTag: Tag;
  mapMalloyDataToChartData: MalloyDataToChartDataHandler;
  getTooltipData?: (item: Item, view: View) => ChartTooltipEntry | null;
};

export type FieldHeaderRangeMap = Record<
  string,
  {abs: [number, number]; rel: [number, number]; depth: number}
>;

export type MalloyClickEventPayload = {
  field: Field;
  // TODO: type these later
  displayValue: unknown;
  value: unknown;
  fieldPath: string[];
  isHeader: boolean;
  event: MouseEvent;
  type: 'dashboard-item' | 'table-cell';
};

export type VegaConfigHandler = (
  chartType: string
) => Record<string, unknown> | undefined;

export type ChartTooltipEntry = {
  title: string[];
  // field?: Field;
  entries: {
    label: string;
    value: string | (() => JSX.Element);
    highlight: boolean;
    entryType: 'list-item' | 'block';
    ignoreHighlightState?: boolean;
    color?: string;
  }[];
};

// type CellValues = {[name: string]: CellDataValue};

export type MalloyVegaDataRecord = {
  row: RecordCell;
};

type ScaleType = 'quantitative' | 'nominal';

export type Channel = {
  fields: string[];
  type: ScaleType | null;
};

export type TableConfig = {
  disableVirtualization: boolean;
  rowLimit: number;
  shouldFillWidth: boolean;
  enableDrill: boolean;
};
export type DashboardConfig = {
  disableVirtualization: boolean;
};

export type DrillData = {
  dimensionFilters: DrillEntry[];
  copyQueryToClipboard: () => Promise<void>;
  query: string;
  whereClause: string;
};

export type DrillEntry = {
  field: Field;
  value: string | number | boolean | Date | null;
};
