from ..connection import ConnectionInterface
from collections.abc import Sequence
from google.cloud import bigquery


class BigQueryConnection(ConnectionInterface):

    def __init__(self):
        self._client_options = None

    def withOptions(self, options):
        self._client_options = options
        return self

    def get_schema_for_tables(self, tables: Sequence[str]):
        schema = {'schemas': {}}
        for table in tables:
            schema['schemas'][table] = self._to_struct_def(
                table,
                bigquery.Client(self._client_options).get_table(table).schema)
        return schema

    def run_query(self, sql: str):
        return bigquery.Client(self._client_options).query(sql)

    def _to_struct_def(self, table, schema):
        return {
            'type': "struct",
            "name": table,
            "dialect": "standardsql",
            "structSource": {
                "type": "table",
                "tablePath": table
            },
            "structRelationship": {
                "type": "basetable",
                "connectionName": "fake"
            },
            "fields": self._map_fields(schema)
        }

    def _map_fields(self, schema):
        fields = []
        for metadata in schema:
            field = {'name': metadata.name}
            if (metadata.field_type in self.TYPE_MAP.keys()):
                field |= self.TYPE_MAP[metadata.field_type]
            else:
                print("Field type not mapped: {}".format(metadata.field_type))
            fields.append(field)

        return fields

    TYPE_MAP = {
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
