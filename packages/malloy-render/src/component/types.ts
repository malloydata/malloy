/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {
  DataColumn,
  DataRecord,
  Explore,
  Field,
  QueryData,
  QueryDataRow,
  Tag,
} from '@malloydata/malloy';
import {Item, View} from 'vega';
import {JSX} from 'solid-js';
import {ResultStore} from './result-store/result-store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vega does not have good TS support
export type VegaSpec = any;
export type DataInjector = (
  field: Explore,
  data: QueryData,
  spec: VegaSpec
) => void;
export type VegaChartProps = {
  spec: VegaSpec;
  specType: 'vega' | 'vega-lite';
  plotWidth: number;
  plotHeight: number;
  totalWidth: number;
  totalHeight: number;
  chartType: string;
  injectData?: DataInjector;
  getTooltipData?: (item: Item, view: View) => ChartTooltipEntry | null;
};

export type FieldHeaderRangeMap = Record<
  string,
  {abs: [number, number]; rel: [number, number]; depth: number}
>;

export interface FieldRenderMetadata {
  field: Field | Explore;
  min: number | null;
  max: number | null;
  minString: string | null;
  maxString: string | null;
  values: Set<string | number>;
  maxRecordCt: number | null;
  maxUniqueFieldValueCounts: Map<string, number>;
  vegaChartProps?: VegaChartProps;
  renderAs: string;
}

export interface RenderResultMetadata {
  fields: Record<string, FieldRenderMetadata>;
  fieldKeyMap: WeakMap<Field | Explore, string>;
  getFieldKey: (f: Field | Explore) => string;
  field: (f: Field | Explore) => FieldRenderMetadata;
  getData: (cell: DataColumn) => QueryData;
  modelTag: Tag;
  resultTag: Tag;
  rootField: Field | Explore;
  store: ResultStore;
}

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

export type DataRowWithRecord = QueryDataRow & {
  __malloyDataRecord: DataRecord;
};

export type MalloyVegaDataRecord = {
  __source: QueryDataRow & {__malloyDataRecord: DataRecord};
};
