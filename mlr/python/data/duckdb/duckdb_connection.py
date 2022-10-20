from ..connection import ConnectionInterface
from collections.abc import Sequence
import duckdb
import logging
import re


class DuckDbConnection(ConnectionInterface):
    logger = logging.getLogger(__name__)
    table_regex = re.compile('^duckdb:(.+)$')

    def __init__(self):
        self._client_options = None
        self._home_directory = None

    def withOptions(self, options):
        self._client_options = options
        return self

    def withHomeDirectory(self, path):
        self._home_directory = path
        return self

    def get_connection(self):
        con = duckdb.connect(database=':memory:', config=self._client_options)
        if self._home_directory:
            sql = "SET FILE_SEARCH_PATH='{}'".format(self._home_directory)
            self.logger.debug(sql)
            con.execute(sql)
        return con

    def get_schema_for_tables(self, tables: Sequence[str]):
        self.logger.debug("Fetching schema for tables...")
        schema = {'schemas': {}}
        con = self.get_connection()
        for table in tables:
            self.logger.debug("Fetching {}".format(table))
            table_def = self.table_regex.match(table).group(1)
            con.execute('DESCRIBE SELECT * FROM \'{}\''.format(table_def))
            schema['schemas'][table] = self._to_struct_def(
                table, con.fetchall())
        return schema

    def run_query(self, sql: str):
        self.logger.debug("Running Query:")
        self.logger.debug(sql)
        con = self.get_connection()
        con.execute(sql)
        return con

    def _to_struct_def(self, table, schema):
        return {
            'type': "struct",
            "name": table,
            "dialect": "duckdb",
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
            field = {'name': metadata[0]}
            if (metadata[1] in self.TYPE_MAP.keys()):
                field |= self.TYPE_MAP[metadata[1]]
            else:
                self.logger.warn("Field type not mapped: {}".format(
                    metadata[1]))
            fields.append(field)

        return fields

    TYPE_MAP = {
        'VARCHAR': {
            'type': 'string'
        },
        'BIGINT': {
            'type': 'number'
        },
        'DOUBLE': {
            'type': 'number'
        },
        'DATE': {
            'type': 'date'
        },
        'TIMESTAMP': {
            'type': 'timestamp'
        },
        'TIME': {
            'type': 'string'
        },
        'DECIMAL': {
            'type': 'number'
        },
        'BOOLEAN': {
            'type': 'boolean'
        },
        'INTEGER': {
            'type': 'number'
        },
    }
