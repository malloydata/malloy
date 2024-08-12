import {DataColumn, Explore, Field, QueryData} from '@malloydata/malloy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vega does not have good TS support
export type VegaSpec = any;
export type VegaChartProps = {
  spec: VegaSpec;
  plotWidth: number;
  plotHeight: number;
  totalWidth: number;
  totalHeight: number;
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
  values: Set<string>;
  maxRecordCt: number | null;
  absoluteColumnRange: [number, number];
  relativeColumnRange: [number, number];
  depth: number;
  vegaChartProps?: VegaChartProps;
}

export interface RenderResultMetadata {
  fields: Record<string, FieldRenderMetadata>;
  fieldKeyMap: WeakMap<Field | Explore, string>;
  getFieldKey: (f: Field | Explore) => string;
  field: (f: Field | Explore) => FieldRenderMetadata;
  getData: (cell: DataColumn) => QueryData;
  fieldHeaderRangeMap: FieldHeaderRangeMap;
  totalHeaderSize: number;
}
