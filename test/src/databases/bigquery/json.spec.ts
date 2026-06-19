/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {describeIfDatabaseAvailable} from '../../util';
import {RuntimeList} from '../../runtimes';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const [describe] = describeIfDatabaseAvailable(['bigquery']);

const tJson = `
  bigquery.sql("""
    SELECT *
      FROM UNNEST([
        STRUCT( JSON '{"class_name": "A", "class" : {"students" : [{"name" : "Jane"}]}}' as j, 1 as r),
        STRUCT( JSON '{"class_name": "B", "class" : {"students" : []}}', 2),
        STRUCT( JSON '{"class_name": "C", "class" : {"students" : [{"name" : "John"}, {"name": "Jamie"}]}}', 3)
    ]) AS t
  """)`;

describe('JSON tests', () => {
  const runtimes = new RuntimeList(['bigquery']);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  runtimes.runtimeMap.forEach((runtime, databaseName) => {
    const testModel = wrapTestModel(runtime, '');

    // Issue: #151
    it(`JSON Scalar  - ${databaseName}`, async () => {
      await expect(`
        run: ${tJson} -> {
          group_by: class_name is json_extract_scalar!(j, '$.class_name')
          order_by: 1 desc
        }
      `).toMatchResult(testModel, {class_name: 'C'});
    });

    it(`Returns JSON as value - ${databaseName}`, async () => {
      await expect(`
        run: ${tJson} -> {
          select: j, r
          order_by: 2 desc
        }
      `).toMatchResult(testModel, {
        j: '{"class":{"students":[{"name":"John"},{"name":"Jamie"}]},"class_name":"C"}',
      });
    });
  });
});
