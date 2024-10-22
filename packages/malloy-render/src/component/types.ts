import {DataColumn, Explore, Field, QueryData, Tag} from '@malloydata/malloy';
import {Item} from 'vega';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vega does not have good TS support
export type VegaSpec = any;
export type VegaChartProps = {
  spec: VegaSpec;
  specType: 'vega' | 'vega-lite';
  plotWidth: number;
  plotHeight: number;
  totalWidth: number;
  totalHeight: number;
  chartType: string;
  getTooltipData?: (item: Item) => ChartTooltipEntry[] | null;
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
  field: Field;
  fieldName: string;
  value: unknown;
};
