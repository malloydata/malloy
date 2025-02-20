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
  SourceDef,
  TimestampUnit,
} from './model';
import {
  getResultStructDefForQuery,
  getResultStructDefForView,
} from './model/malloy_query';

export function modelDefToModelInfo(modelDef: ModelDef): Malloy.ModelInfo {
  const modelInfo: Malloy.ModelInfo = {
    entries: [],
    anonymous_queries: [],
  };
  for (const [name, entry] of Object.entries(modelDef.contents)) {
    if (!modelDef.exports.includes(name)) continue;
    if (isSourceDef(entry)) {
      const sourceInfo: Malloy.ModelEntryValueWithSource = {
        __type: Malloy.ModelEntryValueType.Source,
        name,
        schema: {
          fields: convertFieldInfos(entry, entry.fields),
        },
      };
      modelInfo.entries.push(sourceInfo);
    } else if (entry.type === 'query') {
      const outputStruct = getResultStructDefForQuery(modelDef, entry);
      const queryInfo: Malloy.ModelEntryValueWithSource = {
        __type: Malloy.ModelEntryValueType.Source,
        name,
        schema: {
          fields: convertFieldInfos(outputStruct, outputStruct.fields),
        },
      };
      modelInfo.entries.push(queryInfo);
    }
  }
  return modelInfo;
}

function convertFieldInfos(source: SourceDef, fields: FieldDef[]) {
  const result: Malloy.FieldInfo[] = [];
  for (const field of fields) {
    if (isTurtle(field)) {
      const outputStruct = getResultStructDefForView(source, field);
      const fieldInfo: Malloy.FieldInfo = {
        __type: Malloy.FieldInfoType.View,
        name: field.as ?? field.name,
        schema: {fields: convertFieldInfos(outputStruct, outputStruct.fields)},
      };
      result.push(fieldInfo);
    } else if (isAtomic(field)) {
      const aggregate = expressionIsAggregate(field.expressionType);
      const scalar = expressionIsScalar(field.expressionType);
      if (!aggregate && !scalar) continue;
      if (field.type === 'error') continue;
      const fieldInfo: Malloy.FieldInfo = {
        __type: aggregate
          ? Malloy.FieldInfoType.Measure
          : Malloy.FieldInfoType.Dimension,
        name: field.as ?? field.name,
        type: typeDefToType(field),
      };
      result.push(fieldInfo);
    } else if (isJoinedSource(field)) {
      const fieldInfo: Malloy.FieldInfo = {
        __type: Malloy.FieldInfoType.Join,
        name: field.as ?? field.name,
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

function typeDefToType(field: AtomicTypeDef): Malloy.AtomicType {
  if (isLeafAtomic(field)) {
    switch (field.type) {
      case 'string':
        return {__type: Malloy.AtomicTypeType.StringType};
      case 'number':
        return {
          __type: Malloy.AtomicTypeType.NumberType,
          subtype:
            field.numberType === 'float'
              ? Malloy.NumberSubtype.DECIMAL
              : field.numberType === 'integer'
              ? Malloy.NumberSubtype.INTEGER
              : undefined,
        };
      case 'boolean':
        return {__type: Malloy.AtomicTypeType.BooleanType};
      case 'date':
        return {
          __type: Malloy.AtomicTypeType.DateType,
          timeframe: convertDateTimeframe(field.timeframe),
        };
      case 'timestamp':
        return {
          __type: Malloy.AtomicTypeType.TimestampType,
          timeframe: convertTimestampTimeframe(field.timeframe),
        };
      case 'json':
        return {__type: Malloy.AtomicTypeType.JSONType};
      case 'sql native':
        return {
          __type: Malloy.AtomicTypeType.SQLNativeType,
          sql_type: field.rawType,
        };
      case 'error':
        throw new Error('Error type is not supported in stable interface');
    }
  } else if (isRepeatedRecord(field)) {
    return {
      __type: Malloy.AtomicTypeType.ArrayType,
      element_type: convertRecordType(field),
    };
  } else if (field.type === 'record') {
    return convertRecordType(field);
  } else if (field.type === 'array') {
    return {
      __type: Malloy.AtomicTypeType.ArrayType,
      element_type: typeDefToType(field.elementTypeDef),
    };
  }
  throw new Error('Unexpected field type');
}

function convertRecordType(
  field: RecordTypeDef | RepeatedRecordTypeDef
): Malloy.AtomicTypeWithRecordType {
  return {
    __type: Malloy.AtomicTypeType.RecordType,
    fields: field.fields.map(f => {
      if (isAtomic(f)) {
        return {
          name: f.name,
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
      throw new Error('Invalid date timeframe');
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
