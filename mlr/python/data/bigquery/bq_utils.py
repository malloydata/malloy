import pandas
import json
from google.cloud import bigquery


def get_schema_for_tables(tableIds):
    schema = {'schemas': {}}
    for tableId in tableIds:
        schema['schemas'][tableId] = to_struct_def(
            tableId,
            bigquery.Client().get_table(tableId).schema)
    return schema


def to_struct_def(tableId, schema):
    return {
        'type': "struct",
        "name": tableId,
        "dialect": "standardsql",
        "structSource": {
            "type": "table",
            "tablePath": tableId
        },
        "structRelationship": {
            "type": "basetable",
            "connectionName": "fake"
        },
        "fields": map_fields(schema)
    }


def map_fields(schema):
    fields = []
    for metadata in schema:
        field = {'name': metadata.name}
        if (metadata.field_type in type_map.keys()):
            field |= type_map[metadata.field_type]
        else:
            print("Field type not mapped: {}".format(metadata.field_type))
        fields.append(field)

    return fields


type_map = {
    'DATE': {
        'type': 'date'
    },
    'STRING': {
        'type': 'string'
    },
    'INTEGER': {
        'type': 'number',
        'numberType': 'integer'
    },
    'INT64': {
        'type': 'number',
        'numberType': 'integer'
    },
    'FLOAT': {
        'type': 'number',
        'numberType': 'float'
    },
    'FLOAT64': {
        'type': 'number',
        'numberType': 'float'
    },
    'NUMERIC': {
        'type': 'number',
        'numberType': 'float'
    },
    'BIGNUMERIC': {
        'type': 'number',
        'numberType': 'float'
    },
    'TIMESTAMP': {
        'type': 'timestamp'
    },
    'BOOLEAN': {
        'type': 'boolean'
    },
    'BOOL': {
        'type': 'boolean'
    }

    # TODO(https://cloud.google.com/bigquery/docs/reference/rest/v2/tables#tablefieldschema)
    # BYTES
    # DATETIME
    # TIME
    # GEOGRAPHY
}


def run_query(sql):
    # print("running sql: ")
    # print(sql)
    results = bigquery.Client().query(sql)
    # if (model == None):
    #     return results

    # query_def = json.loads(
    #     model)['modelDef']['contents']['sessionize_delta_southwest']

    # df = results.to_dataframe()
    # parse_nested(df, query_def)

    return results


# def parse_nested(df, query_def):
#     for pipeline in query_def['pipeline']:
#         for field in pipeline['fields']:
#             if (isinstance(field, str)):
#                 print('Warning: field definition is just a string for "{}"'.
#                       format(field))
#                 continue

#             if field['type'] == 'turtle':
#                 print("Heroes in a halfshell")
#                 # fieldFrame = pandas.DataFrame(df[field['name']][0][0])
#                 # parse_nested(fieldFrame, field)
#                 # print(json.dumps(field, indent=2))
#                 # print(df[field['name']][0][0]['tail_num'])
#                 # print(df.dtypes[field['name']])
#                 print(get_columns_from_field(field))
#                 print(df[field['name']][0][0]['flight_legs'][0]['dep_minute'])

# def get_columns_from_field(field):
#     fields = []
#     for pipeline in field['pipeline']:
#         for field in pipeline['fields']:
#             if (isinstance(field, str)):
#                 fields.append(field)
#             else:
#                 fields.append(field['name'])
#     return fields
