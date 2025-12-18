import type {Tag} from '@malloydata/malloy-tag';
import {tagFromAnnotations} from '../util';
import type * as Malloy from '@malloydata/malloy-interfaces';
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
import type {FieldBase} from './fields/base';
import {extractMalloyObjectFromTag} from '@malloydata/malloy';

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
  return (
    field.type.kind === 'timestamp_type' ||
    field.type.kind === 'timestamptz_type'
  );
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

export function shouldRenderAs({
  field,
  tagOverride,
}: {
  field: FieldBase;
  tagOverride?: Tag;
}): string {
  const pluginRender = field.getPlugins().at(0)?.name;
  if (pluginRender) return pluginRender;

  const tag = convertLegacyToVizTag(tagOverride ?? field.tag);

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

  // TODO: not sure what to do here, how do we null out renderAs below charts? or do we just not?
  const parent = field.parent;
  if (field instanceof RecordField && parent && parent.renderAs() === 'chart') {
    return 'none';
  }

  const isNest = field instanceof ArrayField || field instanceof RecordField;

  const result = !isNest ? 'cell' : 'table';
  return result;
}

export function tagFor(field: Malloy.DimensionInfo, prefix = '# ') {
  return tagFromAnnotations(field.annotations, prefix);
}

export function extractExpressionFromTag(
  tag: Tag
): Malloy.Expression | undefined {
  try {
    return extractMalloyObjectFromTag(tag, 'Expression') as Malloy.Expression;
  } catch (e) {
    return undefined;
  }
}

export function extractLiteralFromTag(
  tag: Tag
): Malloy.LiteralValue | undefined {
  try {
    return extractMalloyObjectFromTag(
      tag,
      'LiteralValue'
    ) as Malloy.LiteralValue;
  } catch (e) {
    return undefined;
  }
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
