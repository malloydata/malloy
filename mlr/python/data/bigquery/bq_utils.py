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
