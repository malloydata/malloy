/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {TestTranslator} from './test-translator';
import './parse-expects';

/**
 * Tests for the modelWasModified flag in the translator output.
 *
 * The translator outputs:
 * 1. A ModelDef (the compiled model with sources, queries, exports)
 * 2. A queryList (unnamed queries from `run:` statements)
 * 3. modelWasModified flag - true if the model was modified during translation
 *
 * The modelWasModified flag is used by the Model caching system to determine
 * if we can reuse the input model's cached QueryModel, or if we need to
 * create a new Model with the updated ModelDef.
 */
describe('modelWasModified flag', () => {
  describe('should be false when only running queries', () => {
    test('run query against existing source', () => {
      const tt = new TestTranslator('run: a -> { group_by: astr }');
      const result = tt.translate();
      expect(result.modelDef).toBeDefined();
      expect(result.modelWasModified).toBe(false);
      // Query should be in queryList
      expect(result.modelDef?.queryList.length).toBe(1);
    });

    test('run query with filter against existing source', () => {
      const tt = new TestTranslator(
        "run: a -> { where: astr = 'x' group_by: astr }"
      );
      const result = tt.translate();
      expect(result.modelDef).toBeDefined();
      expect(result.modelWasModified).toBe(false);
    });

    test('run query using existing view', () => {
      const tt = new TestTranslator('run: ab -> aturtle');
      const result = tt.translate();
      expect(result.modelDef).toBeDefined();
      expect(result.modelWasModified).toBe(false);
    });

    test('run multiple queries', () => {
      const tt = new TestTranslator(`
        run: a -> { group_by: astr }
        run: ab -> { aggregate: acount }
      `);
      const result = tt.translate();
      expect(result.modelDef).toBeDefined();
      expect(result.modelWasModified).toBe(false);
      expect(result.modelDef?.queryList.length).toBe(2);
    });

    test('run query with pipeline', () => {
      const tt = new TestTranslator(`
        run: a -> { group_by: astr; aggregate: c is count() }
             -> { where: c > 10 select: * }
      `);
      const result = tt.translate();
      expect(result.modelDef).toBeDefined();
      expect(result.modelWasModified).toBe(false);
    });
  });

  describe('should be true when adding new definitions', () => {
    test('define new source', () => {
      const tt = new TestTranslator(`
        source: new_source is a extend {
          dimension: new_dim is concat(astr, 'x')
        }
      `);
      expect(tt).toTranslate();
      const result = tt.translate();
      expect(result.modelDef).toBeDefined();
      expect(result.modelWasModified).toBe(true);
      expect(result.modelDef?.contents['new_source']).toBeDefined();
    });

    test('define named query', () => {
      const tt = new TestTranslator(`
        query: my_query is a -> { group_by: astr }
      `);
      expect(tt).toTranslate();
      const result = tt.translate();
      expect(result.modelDef).toBeDefined();
      expect(result.modelWasModified).toBe(true);
      expect(result.modelDef?.contents['my_query']).toBeDefined();
    });

    test('define source then run query', () => {
      const tt = new TestTranslator(`
        source: new_source is a
        run: new_source -> { group_by: astr }
      `);
      expect(tt).toTranslate();
      const result = tt.translate();
      expect(result.modelDef).toBeDefined();
      expect(result.modelWasModified).toBe(true);
    });

    test('extend existing source', () => {
      const tt = new TestTranslator(`
        source: extended_a is a extend {
          measure: my_count is count()
        }
      `);
      expect(tt).toTranslate();
      const result = tt.translate();
      expect(result.modelDef).toBeDefined();
      expect(result.modelWasModified).toBe(true);
    });
  });

  describe('queryList population', () => {
    test('run statements populate queryList', () => {
      const tt = new TestTranslator(`
        run: a -> { group_by: astr }
        run: ab -> { aggregate: acount }
      `);
      const result = tt.translate();
      expect(result.modelDef?.queryList.length).toBe(2);
    });

    test('named queries do not populate queryList', () => {
      const tt = new TestTranslator(`
        query: q1 is a -> { group_by: astr }
        query: q2 is ab -> { aggregate: acount }
      `);
      expect(tt).toTranslate();
      const result = tt.translate();
      expect(result.modelDef?.queryList.length).toBe(0);
      expect(result.modelDef?.contents['q1']).toBeDefined();
      expect(result.modelDef?.contents['q2']).toBeDefined();
    });

    test('mixed named and run queries', () => {
      const tt = new TestTranslator(`
        query: named_q is a -> { group_by: astr }
        run: ab -> { aggregate: acount }
      `);
      expect(tt).toTranslate();
      const result = tt.translate();
      expect(result.modelDef?.queryList.length).toBe(1);
      expect(result.modelDef?.contents['named_q']).toBeDefined();
      expect(result.modelWasModified).toBe(true); // named query adds to model
    });
  });
});
