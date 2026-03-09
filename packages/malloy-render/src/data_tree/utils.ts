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
import {MALLOY_INTERFACE_TYPES} from '@malloydata/malloy-interfaces';

/**
 * Extracts a Malloy interface object from a tag; the inverse of
 * `writeMalloyObjectToTag` in malloy core (packages/malloy/src/to_stable.ts).
 * Lives here in the renderer because this is the only consumer, avoiding
 * a dependency on the malloy core package for deserialization.
 */
function extractMalloyObjectFromTag(tag: Tag, type: string): unknown {
  if (type === 'string') {
    return tag.text();
  } else if (type === 'number') {
    return tag.numeric();
  } else if (type === 'boolean') {
    return tag.text() === 'true';
  }
  const typeDef = MALLOY_INTERFACE_TYPES[type];
  if (typeDef === undefined) {
    throw new Error(`Unknown Malloy interface type ${type}`);
  }
  if (typeDef.type === 'enum') {
    const value = tag.text();
    if (value === undefined) {
      throw new Error(`Missing value for enum ${type}`);
    }
    if (value in typeDef.values) {
      return value;
    }
    throw new Error(`Unknown value ${value} for enum ${type}`);
  } else if (typeDef.type === 'struct') {
    const result: Record<string, unknown> = {};
    for (const [key, type] of Object.entries(typeDef.fields)) {
      const valueTag = tag.tag(key);
      if (valueTag === undefined) {
        if (type.optional) continue;
        else {
          throw new Error(`Missing value for key ${key} of type ${type}`);
        }
      }
      if (type.array) {
        const arr: unknown[] = [];
        const values = valueTag.array();
        if (values === undefined) {
          throw new Error(`Missing array value for key ${key} of type ${type}`);
        }
        for (const value of values) {
          arr.push(extractMalloyObjectFromTag(value, type.type));
        }
        result[key] = arr;
      } else {
        const value = extractMalloyObjectFromTag(valueTag, type.type);
        if (value !== undefined && value !== null) {
          result[key] = value;
        }
      }
    }
    return result;
  } /* (typeDef.type === 'union') */ else {
    const kind = tag.text('kind');
    if (kind === undefined) {
      throw new Error(`Missing kind for union ${type}`);
    }
    const unionType = typeDef.options[kind];
    if (unionType === undefined) {
      throw new Error(`Unknown kind ${kind} for union ${type}`);
    }
    const value = extractMalloyObjectFromTag(tag, unionType) as Record<
      string,
      unknown
    >;
    return {kind, ...value};
  }
}

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
  'big_value',
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

  // Fall back to legacy tag detection for non-chart tags.
  // Iterate in reverse so the last-declared renderer tag wins.
  for (let i = RENDER_TAG_LIST.length - 1; i >= 0; i--) {
    if (tag.has(RENDER_TAG_LIST[i])) {
      const tagName = RENDER_TAG_LIST[i];
      if (tagName === 'list' || tagName === 'list_detail') return 'list';
      if (tagName === 'bar_chart' || tagName === 'line_chart') return 'chart';
      return tagName;
    }
  }

  // TODO: not sure what to do here, how do we null out renderAs below charts? or do we just not?
  const parent = field.parent;
  if (field instanceof RecordField && parent && parent.renderAs() === 'chart') {
    return 'none';
  }

  // RepeatedRecordField and RecordField render as tables
  // Plain ArrayField (e.g., string[], number[]) renders as cell with comma-separated values
  const isNest =
    field instanceof RepeatedRecordField || field instanceof RecordField;

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
