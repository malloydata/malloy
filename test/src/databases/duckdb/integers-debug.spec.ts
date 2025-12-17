/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../../runtimes';
import '../../util/db-jest-matchers';
import {API} from '@malloydata/malloy';

const runtime = runtimeFor('duckdb');

describe('integer type propagation', () => {
  it('BIGINT field type flows through select *', async () => {
    const result = await runtime
      .loadQuery(
        `
        source: bigint_src is duckdb.sql("""
          SELECT 9007199254740993::BIGINT as bigint_val
        """)

        run: bigint_src -> { select: * }
        `
      )
      .run();

    const structs = result._queryResult.structs;
    const outputStruct = structs[structs.length - 1];

    console.log('=== OUTPUT STRUCT ===');
    console.log(JSON.stringify(outputStruct, null, 2));

    const field = outputStruct.fields.find(
      (f: {name: string}) => f.name === 'bigint_val'
    ) as {numberType?: string} | undefined;
    console.log('=== FIELD ===');
    console.log(JSON.stringify(field, null, 2));

    // BIGINT in DuckDB should map to 'bigint'
    expect(field?.numberType).toBe('bigint');

    // Now check the stable API conversion
    const stableResult = API.util.wrapResult(result);
    console.log('=== STABLE RESULT SCHEMA ===');
    console.log(JSON.stringify(stableResult.schema, null, 2));
    console.log('=== STABLE RESULT DATA ===');
    console.log(JSON.stringify(stableResult.data, null, 2));

    // Check that the schema has the correct subtype
    const stableField = stableResult.schema.fields.find(
      f => f.name === 'bigint_val'
    );
    console.log('=== STABLE FIELD TYPE ===');
    console.log(JSON.stringify(stableField, null, 2));
    if (
      stableField &&
      'type' in stableField &&
      stableField.type.kind === 'number_type'
    ) {
      expect(stableField.type.subtype).toBe('bigint');
    }
  });

  it('BIGINT aggregation preserves type', async () => {
    const result = await runtime
      .loadQuery(
        `
        source: bigint_src is duckdb.sql("""
          SELECT 9007199254740993::BIGINT as bigint_val
          UNION ALL SELECT 9007199254740994::BIGINT
        """)

        run: bigint_src -> {
          aggregate: total is bigint_val.sum()
        }
        `
      )
      .run();

    const structs = result._queryResult.structs;
    const outputStruct = structs[structs.length - 1];

    console.log('=== AGGREGATION OUTPUT STRUCT ===');
    console.log(JSON.stringify(outputStruct, null, 2));

    const field = outputStruct.fields.find(
      (f: {name: string}) => f.name === 'total'
    ) as {numberType?: string} | undefined;
    console.log('=== AGGREGATION FIELD ===');
    console.log(JSON.stringify(field, null, 2));

    // sum of bigint should still be bigint
    expect(field?.numberType).toBe('bigint');
  });

  it('HUGEINT field type flows through select *', async () => {
    const result = await runtime
      .loadQuery(
        `
        source: hugeint_src is duckdb.sql("""
          SELECT (1::HUGEINT << 126) as hugeint_val
        """)

        run: hugeint_src -> { select: * }
        `
      )
      .run();

    const structs = result._queryResult.structs;
    const outputStruct = structs[structs.length - 1];

    console.log('=== HUGEINT OUTPUT STRUCT ===');
    console.log(JSON.stringify(outputStruct, null, 2));

    const field = outputStruct.fields.find(
      (f: {name: string}) => f.name === 'hugeint_val'
    ) as {numberType?: string} | undefined;
    console.log('=== HUGEINT FIELD ===');
    console.log(JSON.stringify(field, null, 2));

    // HUGEINT in DuckDB should map to 'bigint'
    expect(field?.numberType).toBe('bigint');
  });
});

afterAll(async () => {
  await runtime.connection.close();
});
