/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import type {Item, Spec, View} from 'vega';
import type {JSX} from 'solid-js';
import type {
  Cell,
  DrillEntry,
  Field,
  RecordCell,
  RepeatedRecordCell,
} from '../data_tree';

export type RendererProps = {
  dataColumn: Cell;
  customProps?: Record<string, Record<string, unknown>>;
};

export type VegaSignalRef = {signal: string};
export type VegaPadding = {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
};
export type MalloyDataToChartDataHandler = (data: RepeatedRecordCell) => {
  data: unknown[];
  isDataLimited: boolean;
  dataLimitMessage?: string;
};
export type VegaChartProps = {
  spec: Spec;
  plotWidth: number;
  plotHeight: number;
  totalWidth: number;
  totalHeight: number;
  chartType: string;
  title?: string;
  subtitle?: string;
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

export type MalloyVegaDataRecord = {
  __row: RecordCell;
};

type ScaleType = 'quantitative' | 'nominal';

export type Channel = {
  fields: string[];
  type: ScaleType | null;
  independent: boolean | 'auto';
};

export type XChannel = Channel & {
  limit: number | 'auto';
};

export type YChannel = {
  fields: string[];
  type: ScaleType | null;
  independent: boolean;
};

export type SeriesChannel = Channel & {
  limit: number | 'auto';
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
  stableQuery: Malloy.Query | undefined;
  stableDrillClauses: Malloy.DrillOperation[] | undefined;
};
