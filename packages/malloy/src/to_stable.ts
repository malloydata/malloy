/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import type {
  AtomicTypeDef,
  DateUnit,
  FieldDef,
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
  isLeafAtomic,
  isRepeatedRecord,
  isSourceDef,
  isTurtle,
} from './model';
import {
  getResultStructDefForQuery,
  getResultStructDefForView,
} from './model/malloy_query';
import {annotationToTaglines} from './annotation';
import {Tag} from '@malloydata/malloy-tag';

export function modelDefToModelInfo(modelDef: ModelDef): Malloy.ModelInfo {
  const modelInfo: Malloy.ModelInfo = {
    entries: [],
    anonymous_queries: [],
  };
  for (const [name, entry] of Object.entries(modelDef.contents)) {
    if (!modelDef.exports.includes(name)) continue;
    if (isSourceDef(entry)) {
      const sourceInfo: Malloy.ModelEntryValueWithSource = {
        kind: 'source',
        name,
        schema: {
          fields: convertFieldInfos(entry, entry.fields),
        },
      };
      modelInfo.entries.push(sourceInfo);
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

function getAnnotationsFromField(field: FieldDef | Query): Malloy.Annotation[] {
  const taglines = annotationToTaglines(field.annotation);
  return taglines.map(tagline => ({
    value: tagline,
  }));
}

export function convertFieldInfos(source: SourceDef, fields: FieldDef[]) {
  const result: Malloy.FieldInfo[] = [];
  for (const field of fields) {
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
      const fieldAnnotations = [
        ...(annotations ?? []),
        ...(resultMetadataAnnotation ? [resultMetadataAnnotation] : []),
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
  if (resultMetadata.filterList) {
    const drillFilters = resultMetadata.filterList
      .filter(f => f.expressionType === 'scalar')
      .map(f => f.code);
    tag.set(['drill_filters'], drillFilters);
    hasAny = true;
  }
  if (resultMetadata.fieldKind === 'dimension') {
    const dot = '.';
    // If field is joined-in from another table i.e. of type `tableName.columnName`,
    // return sourceField, else return name because this could be a renamed field.
    const drillExpression =
      resultMetadata?.sourceExpression ||
      (resultMetadata?.sourceField.includes(dot)
        ? resultMetadata?.sourceField
        : identifierCode(field.name));
    tag.set(['drill_expression'], drillExpression);
    hasAny = true;
  }
  return hasAny
    ? {
        value: tag.toString(),
      }
    : undefined;
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
    const drillFilters = resultMetadata.filterList
      .filter(f => f.expressionType === 'scalar')
      .map(f => f.code);
    if (drillFilters.length > 0) {
      tag.set(['drill_filters'], drillFilters);
      hasAny = true;
    }
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
  return hasAny
    ? {
        value: tag.toString(),
      }
    : undefined;
}

function typeDefToType(field: AtomicTypeDef): Malloy.AtomicType {
  if (isLeafAtomic(field)) {
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
