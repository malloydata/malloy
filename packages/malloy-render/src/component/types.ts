/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Tag} from '@malloydata/malloy-tag';
import {Item, Runtime, Spec, View} from 'vega';
import {JSX} from 'solid-js';
import {ResultStore} from './result-store/result-store';
import * as Malloy from '@malloydata/malloy-interfaces';
import {CellDataValue, NestFieldInfo} from './util';

export type VegaSignalRef = {signal: string};
export type VegaPadding = {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
};
export type MalloyDataToChartDataHandler = (
  field: NestFieldInfo,
  data: Malloy.Cell[]
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

export interface FieldRenderMetadata {
  field: Malloy.DimensionInfo;
  key: string;
  min: number | null;
  max: number | null;
  minString: string | null;
  maxString: string | null;
  values: Set<string | number | boolean>;
  maxRecordCt: number | null;
  maxUniqueFieldValueCounts: Map<Malloy.DimensionInfo, number>;
  vegaChartProps?: VegaChartProps;
  runtime?: Runtime;
  renderAs: string;
  path: string[];
  parent: ParentFieldRenderMetadata | undefined;
}

export interface ParentFieldRenderMetadata extends FieldRenderMetadata {
  field: NestFieldInfo;
}

export interface RenderResultMetadata {
  fields: Map<Malloy.DimensionInfo, FieldRenderMetadata>;
  fieldsByKey: Map<string, Malloy.DimensionInfo>;
  // getData: (cell: Malloy.Cell) => CellDataValue;
  modelTag: Tag;
  resultTag: Tag;
  sourceName: string;
  store: ResultStore;
  rootField: NestFieldInfo;
}

export type MalloyClickEventPayload = {
  field: Malloy.DimensionInfo;
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

type CellValues = {[name: string]: CellDataValue};

export type DataRowWithRecord = CellValues & {
  __malloyDataRecord: Malloy.Row;
};

export type MalloyVegaDataRecord = {
  __source: DataRowWithRecord;
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
  dimensionFilters: DimensionContextEntry[];
  copyQueryToClipboard: () => Promise<void>;
  query: string;
  whereClause: string;
};

export type DimensionContextEntry = {
  field: Malloy.DimensionInfo;
  value: string | number | boolean | Date;
};
