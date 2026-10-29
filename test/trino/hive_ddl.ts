/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

/*
 * Print the DDL that serves test/data/malloytest-parquet through the trino or
 * presto hive connector, reading each parquet file in place as an external
 * table. The hive metastore lowercases every name, so a table with nested
 * columns is created under a `_hive` suffix and a view casts the row types
 * back to the parquet's field names.
 *
 *   ts-node hive_ddl.ts <catalog> <location> [--presto]
 *
 * <location> is the directory holding one directory per table, in the
 * connector's URL scheme: local:///malloytest for trino, file:///data/malloytest
 * for presto.
 */

import type {QueryRecord} from '@malloydata/malloy';
import {TinyParser} from '../../packages/malloy/src/dialect/tiny_parser';
import {openDuckDB, parquetPath, parquetTables} from '../data/parquet_loader';

const [catalog, location, ...flags] = process.argv.slice(2);
const presto = flags.length === 1 && flags[0] === '--presto';
if (!catalog || !location || (flags.length > 0 && !presto)) {
  console.error('usage: hive_ddl.ts <catalog> <location> [--presto]');
  process.exit(1);
}
// Presto's timestamp is milliseconds and takes no precision; trino's is
// declared to match hive.timestamp-precision in the catalog properties.
const timestampType = presto ? 'TIMESTAMP' : 'TIMESTAMP(6)';

// DuckDB types hive spells the same way
const sameNameTypes = new Set([
  'BIGINT',
  'INTEGER',
  'DOUBLE',
  'VARCHAR',
  'BOOLEAN',
  'DATE',
]);

/**
 * Reads a DuckDB type as DESCRIBE writes it and writes the hive type for the
 * same parquet column: STRUCT(a T, b T) becomes ROW("a" T, "b" T), T[]
 * becomes ARRAY(T), DECIMAL(p,s) and the same-name scalars carry over. The
 * dialect's own DuckDBTypeParser reads the same text into Malloy types, which
 * drop the decimal precision hive needs; this one keeps the SQL spelling.
 */
class HiveTypeParser extends TinyParser {
  constructor(input: string) {
    super(input, {
      space: /^\s+/,
      qdouble: /^"([^"]|"")*"/,
      precision: /^\(\d+,\d+\)/,
      arrayOf: /^\[]/,
      char: /^[,()]/,
      id: /^\w+/,
    });
  }

  hiveType(): string {
    const id = this.expect('id').text.toUpperCase();
    let type: string;
    if (id === 'STRUCT') {
      this.expect('(');
      const fields: string[] = [];
      for (;;) {
        const name = this.match('qdouble') ?? this.expect('id');
        fields.push(`"${name.text}" ${this.hiveType()}`);
        if (!this.match(',')) {
          break;
        }
      }
      this.expect(')');
      type = `ROW(${fields.join(', ')})`;
    } else if (id === 'DECIMAL') {
      type = `DECIMAL${this.expect('precision').text}`;
    } else if (id === 'TIMESTAMP') {
      this.matchText('WITH', 'TIME', 'ZONE');
      type = timestampType;
    } else if (sameNameTypes.has(id)) {
      type = id;
    } else {
      throw this.parseError(`No hive type for DuckDB type ${id}`);
    }
    while (this.match('arrayOf')) {
      type = `ARRAY(${type})`;
    }
    return type;
  }
}

function hiveType(duckdbType: string): string {
  const parser = new HiveTypeParser(duckdbType);
  const type = parser.hiveType();
  if (!parser.eof()) {
    throw parser.parseError('Unexpected text after the type');
  }
  return type;
}

function isNested(duckdbType: string): boolean {
  return duckdbType.includes('STRUCT(');
}

function text(row: QueryRecord, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') {
    throw new Error(`DESCRIBE gave no ${column}`);
  }
  return value;
}

(async () => {
  const db = await openDuckDB();
  const ddl = [`CREATE SCHEMA IF NOT EXISTS ${catalog}.malloytest;`];
  for (const table of parquetTables()) {
    const described = await db.run(
      `DESCRIBE SELECT * FROM read_parquet('${parquetPath(table)}')`
    );
    const columns = described.map(row => ({
      name: text(row, 'column_name'),
      type: text(row, 'column_type'),
    }));
    const nested = columns.some(c => isNested(c.type));
    const hiveTable = nested ? `${table}_hive` : table;
    const declarations = columns.map(c => `  "${c.name}" ${hiveType(c.type)}`);
    ddl.push(
      `CREATE TABLE IF NOT EXISTS ${catalog}.malloytest.${hiveTable} (\n${declarations.join(',\n')}\n) WITH (format = 'PARQUET', external_location = '${location}/${table}');`
    );
    if (nested) {
      const select = columns.map(c =>
        isNested(c.type)
          ? `  CAST("${c.name}" AS ${hiveType(c.type)}) AS "${c.name}"`
          : `  "${c.name}"`
      );
      ddl.push(
        `CREATE OR REPLACE VIEW ${catalog}.malloytest.${table} AS SELECT\n${select.join(',\n')}\nFROM ${catalog}.malloytest.${hiveTable};`
      );
    }
  }
  await db.close();
  console.log(ddl.join('\n'));
})();
