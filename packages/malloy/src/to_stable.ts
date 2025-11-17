/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import type {
  AtomicTypeDef,
  DateUnit,
  Expr,
  FieldDef,
  FilterCondition,
  JoinType,
  ModelDef,
  Query,
  RecordTypeDef,
  RepeatedRecordTypeDef,
  ResultMetadataDef,
  ResultStructMetadataDef,
  SourceDef,
  TimestampUnit,
} from './model';
import {
  expressionIsAggregate,
  expressionIsScalar,
  isAtomic,
  isJoinedSource,
  isBasicAtomic,
  isRepeatedRecord,
  isRecordOrRepeatedRecord,
  isSourceDef,
  isTurtle,
  getResultStructDefForQuery,
  getResultStructDefForView,
} from './model';
import {annotationToTaglines} from './annotation';
import {Tag} from '@malloydata/malloy-tag';

export function sourceDefToSourceInfo(sourceDef: SourceDef): Malloy.SourceInfo {
  const parameters: Malloy.ParameterInfo[] | undefined =
    sourceDef.parameters && Object.entries(sourceDef.parameters).length > 0
      ? Object.entries(sourceDef.parameters).map(([name, parameter]) => {
          if (isAtomic(parameter)) {
            return {
              name,
              type: typeDefToType(parameter),
              default_value: convertParameterDefaultValue(parameter.value),
            };
          }
          return {
            name,
            type: {
              kind: 'filter_expression_type',
              filter_type: {
                kind: `${parameter.filterType}_type` as const,
              },
            },
            default_value: convertParameterDefaultValue(parameter.value),
          };
        })
      : undefined;

  const sourceInfo: Malloy.SourceInfo = {
    name: sourceDef.as ?? sourceDef.name,
    schema: {
      fields: convertFieldInfos(sourceDef, sourceDef.fields),
    },
    parameters,
    annotations: getAnnotationsFromField(sourceDef),
  };
  return sourceInfo;
}

export function modelDefToModelInfo(modelDef: ModelDef): Malloy.ModelInfo {
  const modelInfo: Malloy.ModelInfo = {
    entries: [],
    anonymous_queries: [],
  };
  for (const [name, entry] of Object.entries(modelDef.contents)) {
    if (!modelDef.exports.includes(name)) continue;
    if (isSourceDef(entry)) {
      const sourceInfo = sourceDefToSourceInfo(entry);
      modelInfo.entries.push({
        kind: 'source',
        ...sourceInfo,
      });
    } else if (entry.type === 'query') {
      const outputStruct = getResultStructDefForQuery(modelDef, entry);
      const annotations = getAnnotationsFromField(entry);
      const resultMetadataAnnotation = outputStruct.resultMetadata
        ? getResultStructMetadataAnnotation(
            outputStruct,
            outputStruct.resultMetadata
          )
        : undefined;
      const fieldAnnotations = [
        ...(annotations ?? []),
        ...(resultMetadataAnnotation ? [resultMetadataAnnotation] : []),
      ];
      const queryInfo: Malloy.ModelEntryValueWithSource = {
        kind: 'source',
        name,
        schema: {
          fields: convertFieldInfos(outputStruct, outputStruct.fields),
        },
        annotations: fieldAnnotations.length > 0 ? fieldAnnotations : undefined,
      };
      modelInfo.entries.push(queryInfo);
    }
  }
  for (const query of modelDef.queryList) {
    const outputStruct = getResultStructDefForQuery(modelDef, query);
    const annotations = getAnnotationsFromField(query);
    const resultMetadataAnnotation = outputStruct.resultMetadata
      ? getResultStructMetadataAnnotation(
          outputStruct,
          outputStruct.resultMetadata
        )
      : undefined;
    const fieldAnnotations = [
      ...(annotations ?? []),
      ...(resultMetadataAnnotation ? [resultMetadataAnnotation] : []),
    ];
    const queryInfo: Malloy.AnonymousQueryInfo = {
      schema: {
        fields: convertFieldInfos(outputStruct, outputStruct.fields),
      },
      annotations: fieldAnnotations.length > 0 ? fieldAnnotations : undefined,
    };
    modelInfo.anonymous_queries.push(queryInfo);
  }
  return modelInfo;
}

function convertParameterDefaultValue(
  value: Expr | null
): Malloy.LiteralValue | undefined {
  if (value === null) return undefined;
  switch (value.node) {
    case 'numberLiteral':
      // TODO handle all kinds of number literals?
      return {kind: 'number_literal', number_value: parseFloat(value.literal)};
    case 'stringLiteral':
      return {kind: 'string_literal', string_value: value.literal};
    case 'filterLiteral':
      return {
        kind: 'filter_expression_literal',
        filter_expression_value: value.filterSrc,
      };
    case 'dateLiteral':
      return {
        kind: 'date_literal',
        date_value: value.literal,
      };
    case 'timestampLiteral':
      return {
        kind: 'timestamp_literal',
        timestamp_value: value.literal,
        timezone: value.timezone,
      };
    case 'offsetTimestampLiteral':
      return {
        kind: 'timestamp_literal',
        timestamp_value: value.literal,
        timezone: value.timezone,
        offset: true,
      };
    case 'true':
      return {kind: 'boolean_literal', boolean_value: true};
    case 'false':
      return {kind: 'boolean_literal', boolean_value: false};
    case 'null':
      return {kind: 'null_literal'};
    default:
      throw new Error('Invalid parameter default value');
  }
}

function getAnnotationsFromField(
  field: FieldDef | Query | SourceDef
): Malloy.Annotation[] {
  const taglines = annotationToTaglines(field.annotation);
  return taglines.map(tagline => ({
    value: tagline,
  }));
}

export function convertFieldInfos(source: SourceDef, fields: FieldDef[]) {
  const result: Malloy.FieldInfo[] = [];
  for (const field of fields) {
    const isPublic = field.accessModifier === undefined;
    if (!isPublic) continue;
    const taglines = annotationToTaglines(field.annotation);
    const rawAnnotations: Malloy.Annotation[] = taglines.map(tagline => ({
      value: tagline,
    }));
    const annotations = rawAnnotations.length > 0 ? rawAnnotations : undefined;
    if (isTurtle(field)) {
      const outputStruct = getResultStructDefForView(source, field);
      const resultMetadataAnnotation = outputStruct.resultMetadata
        ? getResultStructMetadataAnnotation(
            outputStruct,
            outputStruct.resultMetadata
          )
        : undefined;
      const fieldAnnotations = [
        ...(annotations ?? []),
        ...(resultMetadataAnnotation ? [resultMetadataAnnotation] : []),
      ];
      const fieldInfo: Malloy.FieldInfo = {
        kind: 'view',
        name: field.as ?? field.name,
        annotations: fieldAnnotations.length > 0 ? fieldAnnotations : undefined,
        schema: {fields: convertFieldInfos(outputStruct, outputStruct.fields)},
      };
      result.push(fieldInfo);
    } else if (isAtomic(field)) {
      const aggregate = expressionIsAggregate(field.expressionType);
      const scalar = expressionIsScalar(field.expressionType);
      if (!aggregate && !scalar) continue;
      if (field.type === 'error') continue;
      const resultMetadataAnnotation = field.resultMetadata
        ? getResultMetadataAnnotation(field, field.resultMetadata)
        : undefined;

      // Check if this field has queryTimezone information (for RecordDef/RepeatedRecordDef)
      let timezoneAnnotation: Malloy.Annotation | undefined;
      if (isRecordOrRepeatedRecord(field) && field.queryTimezone) {
        const timezoneTag = Tag.withPrefix('#(malloy) ');
        timezoneTag.set(['query_timezone'], field.queryTimezone);
        timezoneAnnotation = {value: timezoneTag.toString()};
      }

      const fieldAnnotations = [
        ...(annotations ?? []),
        ...(resultMetadataAnnotation ? [resultMetadataAnnotation] : []),
        ...(timezoneAnnotation ? [timezoneAnnotation] : []),
      ];
      const fieldInfo: Malloy.FieldInfo = {
        kind: aggregate ? 'measure' : 'dimension',
        name: field.as ?? field.name,
        type: typeDefToType(field),
        annotations: fieldAnnotations.length > 0 ? fieldAnnotations : undefined,
      };
      result.push(fieldInfo);
    } else if (isJoinedSource(field)) {
      const fieldInfo: Malloy.FieldInfo = {
        kind: 'join',
        name: field.as ?? field.name,
        annotations,
        schema: {
          fields: convertFieldInfos(field, field.fields),
        },
        relationship: convertJoinType(field.join),
      };
      result.push(fieldInfo);
    }
  }
  return result;
}

function getResultMetadataAnnotation(
  field: FieldDef,
  resultMetadata: ResultMetadataDef
): Malloy.Annotation | undefined {
  const tag = Tag.withPrefix('#(malloy) ');
  let hasAny = false;
  if (resultMetadata.referenceId !== undefined) {
    tag.set(['reference_id'], resultMetadata.referenceId);
    hasAny = true;
  }
  if (resultMetadata.fieldKind === 'measure') {
    tag.set(['calculation']);
    hasAny = true;
  }
  if (resultMetadata.drillable) {
    tag.set(['drillable']);
    hasAny = true;
  }
  if (resultMetadata.filterList) {
    addDrillFiltersTag(tag, resultMetadata.filterList);
    hasAny = true;
  }
  if (resultMetadata.drillExpression) {
    writeExpressionToTag(
      tag,
      ['drill_expression'],
      resultMetadata.drillExpression
    );
    hasAny = true;
  }
  if (resultMetadata.fieldKind === 'dimension') {
    const dot = '.';
    // If field is joined-in from another table i.e. of type `tableName.columnName`,
    // return sourceField, else return name because this could be a renamed field.
    const drillExpressionCode =
      resultMetadata?.sourceExpression ||
      (resultMetadata?.sourceField.includes(dot)
        ? resultMetadata?.sourceField
        : identifierCode(field.name));
    tag.set(['drill_expression', 'code'], drillExpressionCode);
    hasAny = true;
  }
  return hasAny
    ? {
        value: tag.toString(),
      }
    : undefined;
}

function addDrillFiltersTag(tag: Tag, drillFilters: FilterCondition[]) {
  for (let i = 0; i < drillFilters.length; i++) {
    const filter = drillFilters[i];
    if (filter.expressionType !== 'scalar' || filter.isSourceFilter) continue;
    tag.set(['drill_filters', i, 'code'], filter.code);
    if (filter.filterView) {
      tag.set(['drill_filters', i, 'filter_view'], filter.filterView);
    }
    if (filter.filterView === undefined && filter.stableFilter !== undefined) {
      writeExpressionToTag(
        tag,
        ['drill_filters', i, 'expression'],
        filter.stableFilter.expression
      );
      if (filter.stableFilter.kind === 'filter_string') {
        tag.set(['drill_filters', i, 'kind'], 'filter_expression');
        tag.set(
          ['drill_filters', i, 'filter_expression'],
          filter.stableFilter.filter
        );
      } else {
        tag.set(['drill_filters', i, 'kind'], 'literal_equality');
        writeLiteralToTag(
          tag,
          ['drill_filters', i, 'value'],
          filter.stableFilter.value
        );
      }
    }
  }
}

function writeExpressionToTag(
  tag: Tag,
  path: (string | number)[],
  expression: Malloy.Expression
) {
  writeMalloyObjectToTag(tag, path, expression, 'Expression');
}

export function writeLiteralToTag(
  tag: Tag,
  path: (string | number)[],
  literal: Malloy.LiteralValue
) {
  writeMalloyObjectToTag(tag, path, literal, 'LiteralValue');
}

function escapeIdentifier(str: string) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
}

function identifierCode(name: string) {
  if (name.match(/^[A-Za-z_][0-9A-Za-z_]*$/)) return name;
  return `\`${escapeIdentifier(name)}\``;
}

export function getResultStructMetadataAnnotation(
  field: SourceDef,
  resultMetadata: ResultStructMetadataDef
): Malloy.Annotation | undefined {
  const tag = Tag.withPrefix('#(malloy) ');
  let hasAny = false;
  if (resultMetadata.limit !== undefined) {
    tag.set(['limit'], resultMetadata.limit);
    hasAny = true;
  }
  if (resultMetadata.filterList) {
    addDrillFiltersTag(tag, resultMetadata.filterList);
    hasAny = true;
  }
  if (resultMetadata.drillable) {
    tag.set(['drillable']);
    hasAny = true;
  }
  if (resultMetadata.orderBy) {
    for (let i = 0; i < resultMetadata.orderBy.length; i++) {
      const orderBy = resultMetadata.orderBy[i];
      const orderByField =
        typeof orderBy.field === 'number'
          ? field.fields[orderBy.field - 1].as ??
            field.fields[orderBy.field - 1].name
          : orderBy.field;
      const direction = orderBy.dir ?? null;
      tag.set(['ordered_by', i, orderByField], direction);
    }
    hasAny = true;
  }
  // Include queryTimezone if present on the field
  if (field.queryTimezone) {
    tag.set(['query_timezone'], field.queryTimezone);
    hasAny = true;
  }
  return hasAny
    ? {
        value: tag.toString(),
      }
    : undefined;
}

function typeDefToType(field: AtomicTypeDef): Malloy.AtomicType {
  if (isBasicAtomic(field)) {
    switch (field.type) {
      case 'string':
        return {kind: 'string_type'};
      case 'number':
        return {
          kind: 'number_type',
          subtype:
            field.numberType === 'float'
              ? 'decimal'
              : field.numberType === 'integer'
                ? 'integer'
                : undefined,
        };
      case 'boolean':
        return {kind: 'boolean_type'};
      case 'date': {
        // TODO there seems to be a bug where date literals with a timestamp truncation have
        // type: date, but still have a timestamp truncation.
        const timeframe = field.timeframe;
        if (timeframe && !isDateTimeframe(timeframe)) {
          return {
            kind: 'timestamp_type',
            timeframe: convertTimestampTimeframe(field.timeframe),
          };
        }
        return {
          kind: 'date_type',
          timeframe: convertDateTimeframe(field.timeframe),
        };
      }
      case 'timestamp':
        return {
          kind: 'timestamp_type',
          timeframe: convertTimestampTimeframe(field.timeframe),
        };
      case 'json':
        return {kind: 'json_type'};
      case 'sql native':
        return {
          kind: 'sql_native_type',
          sql_type: field.rawType,
        };
      case 'error':
        throw new Error('Error type is not supported in stable interface');
    }
  } else if (isRepeatedRecord(field)) {
    return {
      kind: 'array_type',
      element_type: convertRecordType(field),
    };
  } else if (field.type === 'record') {
    return convertRecordType(field);
  } else if (field.type === 'array') {
    return {
      kind: 'array_type',
      element_type: typeDefToType(field.elementTypeDef),
    };
  }
  throw new Error('Unexpected field type');
}

function convertRecordType(
  field: RecordTypeDef | RepeatedRecordTypeDef
): Malloy.AtomicTypeWithRecordType {
  return {
    kind: 'record_type',
    fields: field.fields.map(f => {
      const annotations: Malloy.Annotation[] = [];
      if ('resultMetadata' in f) {
        if (f.resultMetadata) {
          const ann = getResultMetadataAnnotation(f, f.resultMetadata);
          if (ann) {
            annotations.push(ann);
          }
        }
      }
      if (f.annotation) {
        const taglines = annotationToTaglines(f.annotation);
        annotations.push(
          ...taglines.map(tagline => ({
            value: tagline,
          }))
        );
      }
      if (isAtomic(f)) {
        return {
          name: f.name,
          annotations: annotations.length > 0 ? annotations : undefined,
          type: typeDefToType(f),
        };
      } else {
        throw new Error(
          'Expected record type to not have a table as its child'
        );
      }
    }),
  };
}

function isDateTimeframe(timeframe: DateUnit): boolean {
  switch (timeframe) {
    case 'day':
    case 'week':
    case 'month':
    case 'year':
    case 'quarter':
      return true;
    default:
      return false;
  }
}

function convertDateTimeframe(
  timeframe: DateUnit | undefined
): Malloy.DateTimeframe | undefined {
  switch (timeframe) {
    case undefined:
      return undefined;
    case 'day':
    case 'week':
    case 'month':
    case 'year':
    case 'quarter':
      return timeframe;
    default:
      throw new Error(`Invalid date timeframe ${timeframe}`);
  }
}

function convertTimestampTimeframe(
  timeframe: TimestampUnit | undefined
): Malloy.TimestampTimeframe | undefined {
  return timeframe;
}

function convertJoinType(type: JoinType): Malloy.Relationship {
  return type;
}

/**
 * Writes a Malloy interface object to a tag at a given path.
 *
 * E.g. `writeMalloyObjectToTag(tag, ['expr'], 'Expression', {kind: 'field_reference', name: 'carrier'})`
 *
 * produces the tag `#(malloy) expr { kind = field_reference name = carrier }`
 */
export function writeMalloyObjectToTag(
  tag: Tag,
  path: (string | number)[],
  obj: unknown,
  type: string
) {
  if (type === 'string') {
    tag.set(path, obj as string);
    return;
  } else if (type === 'number') {
    tag.set(path, obj as number);
    return;
  } else if (type === 'boolean') {
    tag.set(path, (obj as boolean).toString());
    return;
  }
  const typelookup = Malloy.MALLOY_INTERFACE_TYPES[type];
  if (typelookup === undefined) {
    throw new Error(`Unknown Malloy interface type ${type}`);
  }
  if (typelookup.type === 'enum') {
    if (typeof obj === 'string') {
      tag.set(path, obj);
    } else {
      throw new Error(`Expected string for enum ${type}`);
    }
  } else if (typelookup.type === 'struct') {
    for (const key in typelookup.fields) {
      const valueType = typelookup.fields[key];
      const value = (obj as Record<string, unknown>)[key];
      if (value === undefined) {
        if (!valueType.optional) {
          throw new Error(
            `Mising value for non-optional field ${key} in type ${type}`
          );
        }
      } else if (valueType.array) {
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            writeMalloyObjectToTag(
              tag,
              [...path, key, i],
              value[i],
              valueType.type
            );
          }
        } else {
          throw new Error(
            `Expected array for field ${key} of type ${type} but got ${typeof obj}`
          );
        }
      } else {
        writeMalloyObjectToTag(tag, [...path, key], value, valueType.type);
      }
    }
  } else {
    // enum
    const kind = (obj as {kind: 'string'}).kind;
    tag.set([...path, 'kind'], kind);
    const unionType = typelookup.options[kind];
    if (unionType === undefined) {
      throw new Error(
        `Unknown Malloy interface union kind ${kind} for type ${type}`
      );
    }
    writeMalloyObjectToTag(tag, path, obj, unionType);
  }
}

/**
 * Extracts a Malloy interface object from a tag at a given path; the inverse of `writeMalloyObjectToTag`.
 */
export function extractMalloyObjectFromTag(tag: Tag, type: string): unknown {
  if (type === 'string') {
    return tag.text();
  } else if (type === 'number') {
    return tag.numeric();
  } else if (type === 'boolean') {
    return tag.text() === 'true';
  }
  const typeDef = Malloy.MALLOY_INTERFACE_TYPES[type];
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
