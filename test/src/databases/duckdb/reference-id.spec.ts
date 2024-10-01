/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {RuntimeList} from '../../runtimes';
import '../../util/db-jest-matchers';
import {describeIfDatabaseAvailable} from '../../util';
import {Explore, Field} from '@malloydata/malloy';

const [describe, databases] = describeIfDatabaseAvailable(['duckdb']);
const dbs = new RuntimeList(databases);

describe.each(dbs.runtimeList)('%s', (dbName, runtime) => {
  it('reference id is correct', async () => {
    const query = `
      run: duckdb.sql("SELECT 1 as one") -> {
        group_by: one
        nest: a is {
          group_by: one
        }
        nest: b is {
          group_by: one is "fake"
        }
        nest: c is {
          # this reference has an annotation
          group_by: one
        }
      }
    `;

    const result = await runtime.loadQuery(query).run();
    function referenceId(field: Field | Explore) {
      if (field.isExplore() || field.isQueryField()) {
        return undefined;
      }
      return field.referenceId;
    }
    const actual = referenceId(result.data.path(0, 'one').field);
    expect(actual).not.toBeUndefined();
    expect(referenceId(result.data.path(0, 'a', 0, 'one').field)).toBe(actual);
    const bOne = referenceId(result.data.path(0, 'b', 0, 'one').field);
    expect(bOne).not.toBe(undefined);
    expect(bOne).not.toBe(actual);
    expect(referenceId(result.data.path(0, 'c', 0, 'one').field)).toBe(actual);
  });
});

afterAll(async () => {
  await dbs.closeAll();
});
