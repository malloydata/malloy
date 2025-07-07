/* eslint-disable no-console */
/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import type * as Malloy from '@malloydata/malloy-interfaces';
import '../../util/db-jest-matchers';
import {convertFromThrift} from '@malloydata/malloy-interfaces';

function indent(str: string, indent = '  '): string {
  return indent + str.split('\n').join('\n' + indent);
}

function annotationsAsText(
  annotations: Malloy.Annotation[] | undefined
): string {
  let response = '';
  if (annotations) {
    const docs = annotations.filter(a => a.value.startsWith('#" '));
    if (docs.length > 0) {
      const doc = docs.map(a => a.value.slice(3).trim()).join('\n');
      if (doc.includes('\n')) {
        response += `  * description:\n${indent(doc)}\n`;
      } else {
        response += `  * description: ${doc}\n`;
      }
    }
    const other = annotations.filter(a => !a.value.startsWith('#" '));
    if (other.length > 0) {
      response += `  * other annotations: \n${indent(
        '  * ' + other.map(a => a.value.trim()).join('\n  * '),
        '  '
      )}\n`;
    }
  }
  return response;
}

function typeAsText(type: Malloy.AtomicType): string {
  if (type.kind === 'boolean_type') {
    return 'boolean';
  } else if (type.kind === 'number_type') {
    if (type.subtype === 'decimal') {
      return 'number (decimal)';
    } else if (type.subtype === 'integer') {
      return 'number (integer)';
    } else {
      return 'number';
    }
  } else if (type.kind === 'string_type') {
    return 'string';
  } else if (type.kind === 'sql_native_type') {
    return 'SQL native type' + (type.sql_type ? ` (${type.sql_type})` : '');
  } else if (type.kind === 'array_type') {
    return `array of (${typeAsText(type.element_type)})`;
  } else if (type.kind === 'record_type') {
    return (
      'record with:\n' +
      type.fields.map(f => `${f.name}: ${typeAsText(f.type)}`).join('\n * ')
    );
  } else if (type.kind === 'date_type') {
    return 'date' + (type.timeframe ? ` (${type.timeframe})` : '');
  } else if (type.kind === 'timestamp_type') {
    return 'timestamp' + (type.timeframe ? ` (${type.timeframe})` : '');
  } else if (type.kind === 'json_type') {
    return 'json';
  }
  return 'unknown';
}

function schemaAsText(schema: Malloy.Schema): string {
  let response = '';
  const fieldsByKind: {[kind: string]: Malloy.FieldInfo[]} = {};
  for (const field of schema.fields) {
    fieldsByKind[field.kind] ??= [];
    fieldsByKind[field.kind].push(field);
  }
  for (const kind of ['join', 'dimension', 'measure', 'view']) {
    const fields = fieldsByKind[kind];
    if (fields === undefined) continue;
    for (const field of fields) {
      if (field.kind === 'join') {
        response += `* join \`${field.name}\` (${field.relationship}):\n`;
        response += annotationsAsText(field.annotations);
        response += '  * schema: \n' + indent(schemaAsText(field.schema));
      }
      if (field.kind === 'dimension' || field.kind === 'measure') {
        response += `* ${field.kind} \`${field.name}\`:\n`;
        response += annotationsAsText(field.annotations);
        response += `  * type: ${typeAsText(field.type)}\n`;
      }
      if (field.kind === 'view') {
        response += `* view \`${field.name}\`:\n`;
        response += annotationsAsText(field.annotations);
        response +=
          '  * output schema: \n' +
          indent(schemaAsText(field.schema), '     ') +
          '\n';
      }
    }
  }
  return response;
}

function makeSchema(source: Malloy.SourceInfo): string {
  const response = `The schema for source \`${
    source.name
  }\` is:\n${schemaAsText(source.schema)}`;
  return response;
}

test('make schema', () => {
  const response = {
    'data': {
      'xfb_malloy_compile_model_v2': {
        'encoded_model':
          '{"entries":[{"source":{"name":"queries","schema":{"fields":[{"dimension":{"name":"query_sql","type":{"string_type":{}},"annotations":[{"value":"#\\" Query sql code\\n"}]}},{"dimension":{"name":"request_id","type":{"string_type":{}},"annotations":[{"value":"#\\" Onyx request UUID\\n"}]}},{"dimension":{"name":"data_source","type":{"string_type":{}},"annotations":[{"value":"#\\" Query executing service\\n"}]}},{"dimension":{"name":"latency_metric_ms_map","type":{"sql_native_type":{"sql_type":"Mapping[string?, int64?]"}},"annotations":[{"value":"#\\" Latency metric map, values in milliseconds\\n"}]}},{"dimension":{"name":"exception_message","type":{"string_type":{}},"annotations":[{"value":"#\\" Exception message if any.\\n"}]}},{"dimension":{"name":"cache_key","type":{"string_type":{}},"annotations":[{"value":"#\\" Onyx simple cache key.\\n"}]}},{"dimension":{"name":"date_aware_cache_key","type":{"string_type":{}},"annotations":[{"value":"#\\" Onyx date aware cache key.\\n"}]}},{"dimension":{"name":"cache_populating_request_id","type":{"string_type":{}},"annotations":[{"value":"#\\" If data is served from cache, the request ID that had originally populated the cache.\\n"}]}},{"dimension":{"name":"perf_aspects","type":{"string_type":{}},"annotations":[{"value":"#\\" Performance aspects of the request as a JSON string.\\n"}]}},{"dimension":{"name":"table_namespace","type":{"string_type":{}},"annotations":[{"value":"#\\" Namespace of queried table (if relevant)\\n"}]}},{"dimension":{"name":"client_tags","type":{"sql_native_type":{"sql_type":"Mapping[string?, string?]"}},"annotations":[{"value":"#\\" Client provided key/value pairs for logging correlation\\n"}]}},{"dimension":{"name":"onyx_region","type":{"string_type":{}},"annotations":[{"value":"#\\" Region in which onyx request was executed\\n"}]}},{"dimension":{"name":"hostname","type":{"string_type":{}},"annotations":[{"value":"#\\" Hostname that served the request\\n"}]}},{"dimension":{"name":"thrift_request_id","type":{"string_type":{}},"annotations":[{"value":"#\\" Thrift request id (not globally unique)\\n"}]}},{"dimension":{"name":"overall_perf_metadata","type":{"string_type":{}},"annotations":[{"value":"#\\" Overall perf metadata as json\\n"}]}},{"dimension":{"name":"analysis_perf_metadata","type":{"string_type":{}},"annotations":[{"value":"#\\" Analysis perf metadata as json\\n"}]}},{"dimension":{"name":"execution_perf_metadata","type":{"string_type":{}},"annotations":[{"value":"#\\" Execution perf metadata as json\\n"}]}},{"dimension":{"name":"backend_query_failed","type":{"boolean_type":{}},"annotations":[{"value":"#\\" Indicates whether backend (e.g., Presto) query failed\\n"}]}},{"dimension":{"name":"backend_query_deprioritized","type":{"boolean_type":{}},"annotations":[{"value":"#\\" Indicates whether backend (e.g., Presto) query was deprioritized\\n"}]}},{"dimension":{"name":"sr_client_id","type":{"string_type":{}},"annotations":[{"value":"#\\" The SR Client ID used to make the request to Onyx\\n"}]}},{"dimension":{"name":"overall_latency_breakdown_json","type":{"string_type":{}},"annotations":[{"value":"#\\" Overall query latency breakdown json\\n"}]}},{"dimension":{"name":"had_hipri_flag","type":{"boolean_type":{}},"annotations":[{"value":"#\\" Whether query sent to Onyx included UNIDASH_HIPRI tag\\n"}]}},{"dimension":{"name":"source_metadata","type":{"string_type":{}},"annotations":[{"value":"#\\" Info about the data source\\n"}]}},{"dimension":{"name":"block_class_d_queries","type":{"boolean_type":{}},"annotations":[{"value":"#\\" block_class_d_queries field from request\\n"}]}},{"dimension":{"name":"user_identity","type":{"string_type":{}},"annotations":[{"value":"#\\" The user identity used to make the request to Onyx\\n"}]}},{"dimension":{"name":"tracking_perf_metadata","type":{"string_type":{}},"annotations":[{"value":"#\\" Tracking perf metadata as json\\n"}]}},{"dimension":{"name":"is_slo_onboarded","type":{"boolean_type":{}},"annotations":[{"value":"#\\" Whether query is onboarded to SLO tracking\\n"}]}},{"dimension":{"name":"throttle_metadata","type":{"string_type":{}},"annotations":[{"value":"#\\" Info about throttling\\n"}]}},{"dimension":{"name":"table_size_bytes","type":{"number_type":{"subtype":1}},"annotations":[{"value":"#\\" in-memory table size in bytes\\n"}]}},{"dimension":{"name":"disable_simple_cache_read","type":{"boolean_type":{}},"annotations":[{"value":"#\\" whether simple cache read was disabled by user\\n"}]}},{"dimension":{"name":"dev_options_json","type":{"string_type":{}},"annotations":[{"value":"#\\" the dev options from the query request\\n"}]}},{"dimension":{"name":"is_write_mode_query","type":{"boolean_type":{}},"annotations":[{"value":"#\\" whether query was classified as write mode query\\n"}]}},{"dimension":{"name":"ds","type":{"string_type":{}}}},{"dimension":{"name":"ts","type":{"string_type":{}}}},{"measure":{"name":"cnt","type":{"number_type":{"subtype":1}}}},{"measure":{"name":"service_cnt","type":{"number_type":{"subtype":1}}}},{"measure":{"name":"www_cnt","type":{"number_type":{"subtype":1}}}},{"dimension":{"name":"date_aware_cache_ineligibility_reasons","type":{"array_type":{"element_type":{"string_type":{}}}},"annotations":[{"value":"#\\" A list of reasons why a query is not eligible for date-aware caching, if applicable\\n"}]}},{"view":{"name":"malloy_dau","schema":{"fields":[{"dimension":{"name":"ds","type":{"string_type":{}},"annotations":[{"value":"#(malloy) reference_id = \\"bcb28233-4d3f-4c70-98e2-ea61b398cf33\\" drill_expression = ds\\n"}]}},{"dimension":{"name":"user_identity","type":{"string_type":{}},"annotations":[{"value":"#\\" The user identity used to make the request to Onyx\\n"},{"value":"#(malloy) reference_id = \\"b13cae39-4d5e-4489-a72b-6e715eb02501\\" drill_expression = user_identity\\n"}]}},{"dimension":{"name":"www_cnt","type":{"number_type":{"subtype":1}},"annotations":[{"value":"#(malloy) reference_id = \\"a766a9a1-94de-42dc-9942-5867ab9126eb\\" calculation\\n"}]}},{"dimension":{"name":"service_cnt","type":{"number_type":{"subtype":1}},"annotations":[{"value":"#(malloy) reference_id = \\"cf5ee338-ffe2-4cb2-bf91-23b360585e5f\\" calculation\\n"}]}},{"dimension":{"name":"is_dq_user","type":{"boolean_type":{}},"annotations":[{"value":"#(malloy) reference_id = \\"d4f12d45-3ee3-40f6-aedb-07537f850ad6\\" calculation\\n"}]}}]},"annotations":[{"value":"#(malloy) limit = 10000 ordered_by = [{ ds = asc }]\\n"}]}},{"view":{"name":"malloy_dau_bc","schema":{"fields":[{"dimension":{"name":"ds","type":{"string_type":{}},"annotations":[{"value":"#(malloy) reference_id = \\"01d6ac23-5800-4000-9dbb-03f1e69433c4\\" drill_expression = ds\\n"}]}},{"dimension":{"name":"user_identity","type":{"string_type":{}},"annotations":[{"value":"#\\" The user identity used to make the request to Onyx\\n"},{"value":"#(malloy) reference_id = \\"404edf83-7705-42c7-8066-55c097302c67\\" drill_expression = user_identity\\n"}]}},{"dimension":{"name":"www_cnt","type":{"number_type":{"subtype":1}},"annotations":[{"value":"#(malloy) reference_id = \\"b27e2b0b-543f-46eb-9c97-0dfd8d39a529\\" calculation\\n"}]}},{"dimension":{"name":"service_cnt","type":{"number_type":{"subtype":1}},"annotations":[{"value":"#(malloy) reference_id = \\"bd50484f-f583-4d9d-9041-f93f500d50eb\\" calculation\\n"}]}},{"dimension":{"name":"is_dq_user","type":{"boolean_type":{}},"annotations":[{"value":"#(malloy) reference_id = \\"68cc2aff-2104-4db1-a37e-51c810db30d1\\" calculation\\n"}]}}]},"annotations":[{"value":"# line_chart size=xl\\n"},{"value":"#(malloy) limit = 10000 ordered_by = [{ ds = asc }]\\n"}]}},{"view":{"name":"foo","schema":{"fields":[{"dimension":{"name":"ds","type":{"string_type":{}},"annotations":[{"value":"#(malloy) reference_id = \\"f1e5e563-5e9d-46fa-ae81-0a63bb9f37a8\\" drill_expression = ds\\n"}]}},{"dimension":{"name":"user_identity","type":{"string_type":{}},"annotations":[{"value":"#\\" The user identity used to make the request to Onyx\\n"},{"value":"#(malloy) reference_id = \\"3282b380-05b1-4166-9fcf-903ff88ac5f4\\" drill_expression = user_identity\\n"}]}},{"dimension":{"name":"cnt","type":{"number_type":{"subtype":1}},"annotations":[{"value":"#(malloy) reference_id = \\"c5c2193e-f6b0-4634-8cfa-73bc5cf20084\\" calculation\\n"}]}}]},"annotations":[{"value":"#(malloy) drillable ordered_by = [{ cnt = desc }]\\n"}]}}]},"annotations":[]}}],"anonymous_queries":[]}',
        'logs': [],
        'malloy_text': null,
      },
    },
    'extensions': {'is_final': true},
  };
  const model = convertFromThrift(
    JSON.parse(response.data.xfb_malloy_compile_model_v2.encoded_model),
    'ModelInfo'
  );
  const source = (model as Malloy.ModelInfo).entries[0];
  const desc = makeSchema(source);
  console.log(desc);
  expect(desc).toBe('foo');
});
