/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Splits a table path on the dots outside double quotes and strips the
 * quotes: `db.t`, `"My Db"."t"` and `cat.db.t` yield their parts.
 */
export function tablePathParts(tablePath: string): string[] {
  const parts: string[] = [];
  let part = '';
  let quoted = false;
  for (let i = 0; i < tablePath.length; i++) {
    const ch = tablePath[i];
    if (ch === '"') {
      if (quoted && tablePath[i + 1] === '"') {
        part += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === '.' && !quoted) {
      parts.push(part);
      part = '';
    } else {
      part += ch;
    }
  }
  parts.push(part);
  return parts;
}

function sqlString(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

function sqlIdentifier(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * The statement that lists a table's columns in Trino's type spelling.
 * Athena's DESCRIBE answers in Hive's (`struct<a:int>`), which the shared
 * type parser does not read; information_schema.columns spells
 * `row(a integer)`. The Glue catalog stores every identifier lowercased and
 * resolves a reference to it case-insensitively, so the filter lowercases
 * the path.
 */
export function informationSchemaColumnsSQL(
  tablePath: string,
  defaultDatabase: string | undefined
): {sql: string} | {error: string} {
  const parts = tablePathParts(tablePath);
  if (parts.length > 3 || parts.some(p => p === '')) {
    return {
      error: `Table path '${tablePath}' is not table, database.table or catalog.database.table`,
    };
  }
  const [catalog, database, table] =
    parts.length === 3
      ? parts
      : parts.length === 2
        ? [undefined, ...parts]
        : [undefined, defaultDatabase, parts[0]];
  if (database === undefined) {
    return {
      error: `Table path '${tablePath}' names no database and the connection has no default database`,
    };
  }
  const columns =
    catalog === undefined
      ? 'information_schema.columns'
      : `${sqlIdentifier(catalog)}.information_schema.columns`;
  return {
    sql:
      `SELECT column_name, data_type FROM ${columns}` +
      ` WHERE table_schema = ${sqlString(database.toLowerCase())}` +
      ` AND table_name = ${sqlString(table.toLowerCase())}` +
      ' ORDER BY ordinal_position',
  };
}

/** Splits on the commas outside parentheses. */
function splitTopLevel(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let item = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      items.push(item.trim());
      item = '';
    } else {
      item += ch;
    }
  }
  if (item.trim() !== '') {
    items.push(item.trim());
  }
  return items;
}

function unquoted(name: string): string {
  return name.length >= 2 && name.startsWith('"') && name.endsWith('"')
    ? name.slice(1, -1).replace(/""/g, '"')
    : name;
}

/**
 * Reads the output columns and their types from a Trino-format EXPLAIN plan.
 * Athena has no DESCRIBE OUTPUT and its GetQueryResults metadata types a
 * compound column only as `row` or `array`, so the plan is where a SELECT's
 * full types are written. The Output node names the columns, its Layout
 * line types the symbols it emits, and a `name := symbol` line follows for
 * each column whose name differs from its symbol:
 *
 *     Output[columnNames = [n, r]]
 *     │   Layout: [expr:integer, expr_0:row(n integer, s varchar)]
 *     │   n := expr
 *     │   r := expr_0
 */
export function schemaFromTrinoExplain(
  planLines: string[]
): {name: string; type: string}[] {
  const outputAt = planLines.findIndex(line =>
    line.includes('Output[columnNames = [')
  );
  if (outputAt < 0) {
    throw new Error('EXPLAIN plan has no Output node');
  }
  const outputLine = planLines[outputAt];
  const names = splitTopLevel(
    outputLine.slice(
      outputLine.indexOf('columnNames = [') + 'columnNames = ['.length,
      outputLine.lastIndexOf(']]')
    )
  ).map(unquoted);

  const layoutAt = planLines.findIndex(
    (line, i) => i > outputAt && line.includes('Layout: [')
  );
  if (layoutAt < 0) {
    throw new Error('EXPLAIN plan has no Layout for its Output node');
  }
  const layoutLine = planLines[layoutAt];
  const symbolTypes = new Map<string, string>();
  for (const entry of splitTopLevel(
    layoutLine.slice(
      layoutLine.indexOf('Layout: [') + 'Layout: ['.length,
      layoutLine.lastIndexOf(']')
    )
  )) {
    const colon = entry.indexOf(':');
    symbolTypes.set(
      entry.slice(0, colon).trim(),
      entry.slice(colon + 1).trim()
    );
  }

  const symbolFor = new Map<string, string>();
  for (let i = layoutAt + 1; i < planLines.length; i++) {
    const assignment = planLines[i].match(/^[\s│]*(.+?) := (\S+)\s*$/);
    if (assignment) {
      symbolFor.set(unquoted(assignment[1]), assignment[2]);
    } else if (/[└├]─/.test(planLines[i])) {
      break; // the first child node ends the Output node's lines
    }
  }

  return names.map(name => {
    const symbol = symbolFor.get(name) ?? name;
    const type = symbolTypes.get(symbol);
    if (type === undefined) {
      throw new Error(
        `EXPLAIN plan types no symbol for output column '${name}'`
      );
    }
    return {name, type};
  });
}
