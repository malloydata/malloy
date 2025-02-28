import * as Malloy from '@malloydata/malloy-interfaces';
import {
  AtomicTypeDef,
  DateUnit,
  expressionIsAggregate,
  expressionIsScalar,
  FieldDef,
  isAtomic,
  isJoinedSource,
  isLeafAtomic,
  isRepeatedRecord,
  isSourceDef,
  isTurtle,
  JoinType,
  ModelDef,
  RecordTypeDef,
  RepeatedRecordTypeDef,
  ResultMetadataDef,
  SourceDef,
  TimestampUnit,
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
      const queryInfo: Malloy.ModelEntryValueWithSource = {
        kind: 'source',
        name,
        schema: {
          fields: convertFieldInfos(outputStruct, outputStruct.fields),
        },
      };
      modelInfo.entries.push(queryInfo);
    }
  }
  for (const query of modelDef.queryList) {
    const outputStruct = getResultStructDefForQuery(modelDef, query);
    const queryInfo: Malloy.AnonymousQueryInfo = {
      schema: {
        fields: convertFieldInfos(outputStruct, outputStruct.fields),
      },
    };
    modelInfo.anonymous_queries.push(queryInfo);
  }
  return modelInfo;
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
      const fieldInfo: Malloy.FieldInfo = {
        kind: 'view',
        name: field.as ?? field.name,
        annotations,
        schema: {fields: convertFieldInfos(outputStruct, outputStruct.fields)},
      };
      result.push(fieldInfo);
    } else if (isAtomic(field)) {
      const aggregate = expressionIsAggregate(field.expressionType);
      const scalar = expressionIsScalar(field.expressionType);
      if (!aggregate && !scalar) continue;
      if (field.type === 'error') continue;
      const resultMetadataAnnotation = field.resultMetadata
        ? getResultMetadataAnnotation(field.resultMetadata)
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
      case 'date':
        return {
          kind: 'date_type',
          timeframe: convertDateTimeframe(field.timeframe),
        };
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
          const ann = getResultMetadataAnnotation(f.resultMetadata);
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
