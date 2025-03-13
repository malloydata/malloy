/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {RuntimeList} from '../../runtimes';
import '../../util/db-jest-matchers';
import {describeIfDatabaseAvailable} from '../../util';
import type {Explore, Field} from '@malloydata/malloy';

const [describe, databases] = describeIfDatabaseAvailable(['duckdb']);
const dbs = new RuntimeList(databases);

function referenceId(field: Field | Explore) {
  if (field.isExplore() || field.isQueryField()) {
    return undefined;
  }
  return field.referenceId;
}

describe.each(dbs.runtimeList)('%s', (dbName, runtime) => {
  describe('reference id', () => {
    it('is correct for field references in table', async () => {
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
      const actual = referenceId(result.data.path(0, 'one').field);
      expect(actual).not.toBeUndefined();
      expect(referenceId(result.data.path(0, 'a', 0, 'one').field)).toBe(
        actual
      );
      const bOne = referenceId(result.data.path(0, 'b', 0, 'one').field);
      expect(bOne).not.toBe(undefined);
      expect(bOne).not.toBe(actual);
      expect(referenceId(result.data.path(0, 'c', 0, 'one').field)).toBe(
        actual
      );
    });

    it('is correct for measures', async () => {
      const query = `
        run: duckdb.sql("SELECT 1 as one") extend {
          measure: c is count()
        } -> {
          aggregate: c
          nest: a is {
            aggregate: c
          }
          nest: b is {
            aggregate: c is count() * 2
          }
          nest: d is {
            # this reference has an annotation
            aggregate: c
          }
        }
      `;

      const result = await runtime.loadQuery(query).run();
      const actual = referenceId(result.data.path(0, 'c').field);
      expect(actual).not.toBeUndefined();
      expect(referenceId(result.data.path(0, 'a', 'c').field)).toBe(actual);
      const bC = referenceId(result.data.path(0, 'b', 'c').field);
      expect(bC).not.toBe(undefined);
      expect(bC).not.toBe(actual);
      expect(referenceId(result.data.path(0, 'd', 'c').field)).toBe(actual);
    });

    it('is correct for field references from extend block', async () => {
      const query = `
        run: duckdb.sql("SELECT 1 as one") -> {
          extend: {
            dimension: two is 2
          }
          group_by: two
          nest: a is {
            group_by: two
          }
          nest: b is {
            group_by: two is "fake"
          }
          nest: c is {
            # this reference has an annotation
            group_by: two
          }
        }
      `;

      const result = await runtime.loadQuery(query).run();
      const actual = referenceId(result.data.path(0, 'two').field);
      expect(actual).not.toBeUndefined();
      expect(referenceId(result.data.path(0, 'a', 0, 'two').field)).toBe(
        actual
      );
      const bTwo = referenceId(result.data.path(0, 'b', 0, 'two').field);
      expect(bTwo).not.toBe(undefined);
      expect(bTwo).not.toBe(actual);
      expect(referenceId(result.data.path(0, 'c', 0, 'two').field)).toBe(
        actual
      );
    });

    it.skip('is unequal for different nest/extend blocks', async () => {
      const query = `
        run: duckdb.sql("SELECT 1 as one") -> {
          nest: a is {
            extend: {
              dimension: three is 3
            }
            group_by: three
          }
          nest: b is {
            extend: {
              dimension: three is 4
            }
            group_by: three
          }
        }
      `;

      const result = await runtime.loadQuery(query).run();
      const actual = referenceId(result.data.path(0, 'a', 0, 'three').field);
      expect(actual).not.toBeUndefined();
      expect(referenceId(result.data.path(0, 'b', 0, 'three').field)).toBe(
        actual
      );
    });
  });
});

afterAll(async () => {
  await dbs.closeAll();
});
