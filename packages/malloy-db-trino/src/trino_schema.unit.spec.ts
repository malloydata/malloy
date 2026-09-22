/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {StructDef} from '@malloydata/malloy';
import {TrinoPrestoConnection} from './trino_connection';
import type {BaseRunner} from './trino_connection';

class SchemaConnection extends TrinoPrestoConnection {
  protected async fillStructDefForSqlBlockSchema(
    sql: string,
    structDef: StructDef
  ): Promise<void> {
    await this.loadSchemaForSqlBlock(sql, structDef, `query ${sql}`);
  }
}

describe.each(['trino', 'presto'])('%s schema discovery', dialect => {
  it('retries an empty DESCRIBE and caches only the successful schema', async () => {
    const runSQL = jest
      .fn<ReturnType<BaseRunner['runSQL']>, [string]>()
      .mockResolvedValueOnce({rows: [], columns: []})
      .mockResolvedValue({rows: [['state', 'varchar', '', '']], columns: []});
    const connection = new SchemaConnection(dialect, {runSQL});
    const tables = {states: 'malloytest.state_facts'};

    const failed = await connection.fetchSchemaForTables(tables, {});
    expect(failed).toEqual({
      schemas: {},
      errors: {
        states:
          'Could not fetch schema for table malloytest.state_facts: DESCRIBE returned no columns',
      },
    });

    const recovered = await connection.fetchSchemaForTables(tables, {});
    expect(recovered.errors).toEqual({});
    expect(recovered.schemas.states.fields).toEqual([
      {name: 'state', type: 'string'},
    ]);
    expect(await connection.fetchSchemaForTables(tables, {})).toEqual(
      recovered
    );
    expect(runSQL).toHaveBeenCalledTimes(2);
    expect(runSQL).toHaveBeenCalledWith('DESCRIBE malloytest.state_facts', {});
  });
});
