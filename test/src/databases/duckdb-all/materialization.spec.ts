/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';

const runtimes = ['duckdb', 'duckdb_wasm'];
const [describe, databases] = describeIfDatabaseAvailable(runtimes);
const allDucks = new RuntimeList(databases);

describe.each(allDucks.runtimeList)('duckdb:%s', (dbName, runtime) => {
  it('materialized top level query is replaced and added to queries to materialize', async () => {
    const query = `
    # materialize
    query: myMaterializedQuery is duckdb.sql("select 1 as one, 'word' as word") -> {
      select:
          two is one + 1
    }

    source: foo is myMaterializedQuery extend {
      view: fooview is {
        select:
          three is two + 1
      }
    }

    run: foo -> fooview;
    `;

    const qm = runtime.loadQuery(query, {
      replaceMaterializedReferences: true,
      materializedTablePrefix: 'myPipelinePrefix',
    });
    const preparedResult = await qm.getPreparedResult();

    expect(preparedResult.sql).toBe(
      'SELECT \n   base."two"+1 as "three"\nFROM myPipelinePrefix_myMaterializedQuery_6037d4be_8b92_5ea7_95a0_27bd26c240ca as base\n'
    );
    expect(preparedResult.dependenciesToMaterialize).toStrictEqual({
      'myPipelinePrefix_myMaterializedQuery_6037d4be_8b92_5ea7_95a0_27bd26c240ca':
        {
          'id': 'myPipelinePrefix_myMaterializedQuery_6037d4be_8b92_5ea7_95a0_27bd26c240ca',
          'path': 'internal://internal.malloy',
          'queryName': 'myMaterializedQuery',
          'source': undefined,
        },
    });
  });

  it('materialized multiple levels', async () => {
    const query = `
    # materialize
    query: myMaterializedQuery is duckdb.sql("select 1 as one, 'word' as word") -> {
      select:
          two is one + 1
    }

    # materialize
    query: secondLevelMaterializedQuery is myMaterializedQuery -> {
      select:
          three is two + 1
    }

    source: foo is secondLevelMaterializedQuery extend {
      view: fooview is {
        select:
          four is three + 1
      }
    }

    run: foo -> fooview;
    `;

    const qm = runtime.loadQuery(query, {replaceMaterializedReferences: true});
    const preparedResult = await qm.getPreparedResult();

    expect(preparedResult.sql).toBe(
      'SELECT \n   base."three"+1 as "four"\nFROM secondLevelMaterializedQuery_bd80d526_f867_587e_933e_89353d26d022 as base\n'
    );
    expect(preparedResult.dependenciesToMaterialize).toStrictEqual({
      'secondLevelMaterializedQuery_bd80d526_f867_587e_933e_89353d26d022': {
        id: 'secondLevelMaterializedQuery_bd80d526_f867_587e_933e_89353d26d022',
        path: 'internal://internal.malloy',
        queryName: 'secondLevelMaterializedQuery',
        source: undefined,
      },
    });
  });

  it('replaceMaterializedReferences = false compiles the whole sql', async () => {
    const query = `
    # materialize
    query: myMaterializedQuery is duckdb.sql("select 1 as one, 'word' as word") -> {
      select:
          two is one + 1
    }

    source: foo is myMaterializedQuery extend {
      view: fooview is {
        select:
          three is two + 1
      }
    }

    run: foo -> fooview;`;

    const qm = runtime.loadQuery(query, {replaceMaterializedReferences: false});
    const preparedResult = await qm.getPreparedResult();

    expect(preparedResult.sql).toBe(
      'WITH __stage0 AS (\n  SELECT \n     base."one"+1 as "two"\n  FROM (select 1 as one, \'word\' as word) as base\n)\nSELECT \n   base."two"+1 as "three"\nFROM __stage0 as base\n'
    );
    expect(preparedResult.dependenciesToMaterialize).toStrictEqual({});
  });
});

afterAll(async () => {
  await allDucks.closeAll();
});
