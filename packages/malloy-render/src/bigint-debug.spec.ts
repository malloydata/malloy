/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {RuntimeList} from '../../../test/src/runtimes';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {databasesFromEnvironmentOr} from '../../../test/src/util';
import {API} from '@malloydata/malloy';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(['duckdb_wasm']));

describe('bigint debug', () => {
  it('returns one huge integer via legacy API', async () => {
    const runtime = runtimes.runtimeList.find(
      ([name]) => name === 'duckdb_wasm'
    )![1];

    const result = await runtime
      .loadQuery(
        `run: duckdb_wasm.sql("""SELECT 9007199254740993::HUGEINT as big_val""")`
      )
      .run();

    // Look at the struct definition (schema)
    const structs = result._queryResult.structs;
    const lastStruct = structs[structs.length - 1];
    console.log('Legacy Fields:', JSON.stringify(lastStruct.fields, null, 2));

    // Look at raw data
    console.log('Legacy Data:', JSON.stringify(result.data.toObject(), null, 2));
  });

  it('returns one huge integer via stable API (like storybook)', async () => {
    const runtime = runtimes.runtimeList.find(
      ([name]) => name === 'duckdb_wasm'
    )![1];
    // Storybook names the connection 'duckdb' even though it's actually duckdb_wasm
    const legacyConnection = await runtime.connections.lookupConnection(
      'duckdb_wasm'
    );

    const connection = API.util.wrapLegacyConnection(legacyConnection);

    // This mimics storybook: malloy file uses duckdb.sql(...) but lookupConnection always returns the wasm connection
    const result = await API.asynchronous.runQuery(
      {
        model_url: 'file:///script.malloy',
        query_malloy: `run: duckdb.sql("""SELECT 9007199254740993::HUGEINT as big_val""")`,
      },
      {
        urls: {
          readURL: async () => '',
        },
        connections: {
          lookupConnection: async () => connection,
        },
      }
    );

    if (result.logs?.some(l => l.severity === 'error')) {
      console.log('ERROR:', JSON.stringify(result.logs, null, 2));
    } else {
      console.log('Stable API result:', JSON.stringify(result.result, null, 2));
    }
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
