import type {Tag} from '@malloydata/malloy-tag';
import {tagFromAnnotations, renderTagFromAnnotations} from '../util';
import type * as Malloy from '@malloydata/malloy-interfaces';
import {isDateUnit, isTimestampUnit} from '@malloydata/malloy';
import type {
  BooleanFieldInfo,
  DateFieldInfo,
  JSONFieldInfo,
  NumberFieldInfo,
  RecordFieldInfo,
  RepeatedRecordFieldInfo,
  ArrayFieldInfo,
  SQLNativeFieldInfo,
  StringFieldInfo,
  TimestampFieldInfo,
} from './types';
import {FieldType} from './types';
import {
  ArrayField,
  BooleanField,
  DateField,
  type Field,
  JSONField,
  NumberField,
  RecordField,
  RepeatedRecordField,
  SQLNativeField,
  StringField,
  TimestampField,
} from './fields';
import {convertLegacyToVizTag, VIZ_CHART_TYPES} from '../component/tag-utils';

export function isArrayFieldInfo(
  field: Malloy.DimensionInfo
): field is ArrayFieldInfo {
  return field.type.kind === 'array_type';
}

export function isRepeatedRecordFieldInfo(
  field: Malloy.DimensionInfo
): field is RepeatedRecordFieldInfo {
  return (
    field.type.kind === 'array_type' &&
    field.type.element_type.kind === 'record_type'
  );
}

export function isRecordFieldInfo(
  field: Malloy.DimensionInfo
): field is RecordFieldInfo {
  return field.type.kind === 'record_type';
}

export function isNumberFieldInfo(
  field: Malloy.DimensionInfo
): field is NumberFieldInfo {
  return field.type.kind === 'number_type';
}

export function isDateFieldInfo(
  field: Malloy.DimensionInfo
): field is DateFieldInfo {
  return field.type.kind === 'date_type';
}

export function isJSONFieldInfo(
  field: Malloy.DimensionInfo
): field is JSONFieldInfo {
  return field.type.kind === 'json_type';
}

export function isStringFieldInfo(
  field: Malloy.DimensionInfo
): field is StringFieldInfo {
  return field.type.kind === 'string_type';
}

export function isTimestampFieldInfo(
  field: Malloy.DimensionInfo
): field is TimestampFieldInfo {
  return field.type.kind === 'timestamp_type';
}

export function isBooleanFieldInfo(
  field: Malloy.DimensionInfo
): field is BooleanFieldInfo {
  return field.type.kind === 'boolean_type';
}

export function isSQLNativeFieldInfo(
  field: Malloy.DimensionInfo
): field is SQLNativeFieldInfo {
  return field.type.kind === 'sql_native_type';
}

const RENDER_TAG_LIST = [
  'link',
  'image',
  'cell',
  'list',
  'list_detail',
  'bar_chart',
  'line_chart',
  'dashboard',
  'scatter_chart',
  'shape_map',
  'segment_map',
];

export function shouldRenderAs(
  field: Malloy.DimensionInfo,
  parent: Field | undefined,
  tagOverride?: Tag
) {
  const tag = convertLegacyToVizTag(
    tagOverride ?? renderTagFromAnnotations(field.annotations)
  );

  // Check viz property first (new approach)
  const vizType = tag.text('viz');
  if (vizType) {
    if (vizType === 'table') return 'table';
    if (vizType === 'dashboard') return 'dashboard';
    if (VIZ_CHART_TYPES.includes(vizType)) return 'chart';
    // Handle other viz types if needed in the future
  }

  // Fall back to legacy tag detection for non-chart tags
  const properties = tag.properties ?? {};
  const tagNamesInOrder = Object.keys(properties).reverse();
  for (const tagName of tagNamesInOrder) {
    if (RENDER_TAG_LIST.includes(tagName) && !properties[tagName].deleted) {
      if (['list', 'list_detail'].includes(tagName)) return 'list';
      if (['bar_chart', 'line_chart'].includes(tagName)) return 'chart';
      return tagName;
    }
  }

  if (field.type.kind === 'record_type' && parent?.renderAs === 'chart') {
    return 'none';
  }

  const isNest =
    field.type.kind === 'array_type' || field.type.kind === 'record_type';

  if (!isNest) return 'cell';
  return 'table';
}

export function tagFor(field: Malloy.DimensionInfo, prefix = '# ') {
  return tagFromAnnotations(field.annotations, prefix);
}

export function extractLiteralFromTag(
  value: Tag | undefined
): Malloy.LiteralValue | undefined {
  if (value === undefined) return undefined;
  const valueKind = value.text('kind');
  if (valueKind === undefined) return undefined;
  switch (valueKind) {
    case 'string_literal': {
      const stringValue = value.text('string_value');
      if (stringValue === undefined) return undefined;
      return {
        kind: 'string_literal',
        string_value: stringValue,
      };
    }
    case 'number_literal': {
      const numberValue = value.numeric('number_value');
      if (numberValue === undefined) return undefined;
      return {
        kind: 'number_literal',
        number_value: numberValue,
      };
    }
    case 'date_literal': {
      const dateValue = value.text('date_value');
      const granularity = value.text('granularity');
      const timezone = value.text('timezone');
      if (granularity && !isDateUnit(granularity)) return undefined;
      if (dateValue === undefined) return undefined;
      return {
        kind: 'date_literal',
        date_value: dateValue,
        granularity: granularity as Malloy.DateTimeframe,
        timezone,
      };
    }
    case 'timestamp_literal': {
      const timestampValue = value.text('timestamp_value');
      const granularity = value.text('granularity');
      const timezone = value.text('timezone');
      if (timestampValue === undefined) return undefined;
      if (granularity && !isTimestampUnit(granularity)) return undefined;
      return {
        kind: 'timestamp_literal',
        timestamp_value: timestampValue,
        granularity: granularity as Malloy.TimestampTimeframe,
        timezone,
      };
    }
    case 'boolean_literal': {
      const booleanValue = value.text('boolean_value');
      if (booleanValue === undefined) return undefined;
      return {
        kind: 'boolean_literal',
        boolean_value: booleanValue === 'true',
      };
    }
    case 'null_literal':
      return {
        kind: 'null_literal',
      };
    case 'filter_expression_literal': {
      const filterExpressionValue = value.text('filter_expression_value');
      if (filterExpressionValue === undefined) return undefined;
      return {
        kind: 'filter_expression_literal',
        filter_expression_value: filterExpressionValue,
      };
    }
  }
  return undefined;
}

export function getFieldType(field: Field): FieldType {
  if (field instanceof RepeatedRecordField) return FieldType.RepeatedRecord;
  if (field instanceof ArrayField) return FieldType.Array;
  if (field instanceof RecordField) return FieldType.Record;
  if (field instanceof NumberField) return FieldType.Number;
  if (field instanceof DateField) return FieldType.Date;
  if (field instanceof JSONField) return FieldType.JSON;
  if (field instanceof StringField) return FieldType.String;
  if (field instanceof TimestampField) return FieldType.Timestamp;
  if (field instanceof BooleanField) return FieldType.Boolean;
  if (field instanceof SQLNativeField) return FieldType.SQLNative;
  throw new Error('Unknown field type');
}
