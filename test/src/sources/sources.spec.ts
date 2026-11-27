/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const testModel = wrapTestModel(testDatabase, '');

afterAll(() => testDatabase.shutdown());

describe('misc tests for regressions that have no better home', () => {
  test('rename a field in a join', async () => {
    // Previously the rename would cause an error in the prepare step, so any result is good
    await expect(`
      source: carriers is db.table('malloytest.carriers') extend { rename: airline is name }
      run: db.table('malloytest.flights') extend {
        join_one: carriers on carrier = carriers.code
      } -> { group_by: carriers.airline; limit: 1 }
    `).toMatchResult(testModel, {});
  });

  test('rename a field in a join below a filtered join', async () => {
    // A filtered join becomes a subquery, and the joins below it are packed
    // into a struct under their column names, which a rename leaves different
    // from the name the query uses.
    await expect(`
      source: two is db.sql("""SELECT 1 as k, 'acme' as name""") extend {
        rename: two_k is k
        primary_key: two_k
      }
      source: one is db.sql("""SELECT 1 as k, 2 as j""") extend {
        where: j > 0
        join_one: two with k
      }
      source: zero is db.sql("""SELECT 1 as k""") extend {
        join_one: one on one.k = k
      }
      run: zero -> { group_by: one.two.name, one.two.two_k }
    `).toMatchResult(testModel, {name: 'acme', two_k: 1});
  });

  describe('Object.prototype field name collisions', () => {
    test('source named constructor with a query', async () => {
      await expect(`
        source: constructor is db.table('malloytest.flights')
        run: constructor -> { group_by: carrier; limit: 1 }
      `).toMatchResult(testModel, {});
    });

    test('dimension named constructor in group_by', async () => {
      await expect(`
        run: db.table('malloytest.flights') extend {
          dimension: constructor is carrier
        } -> { group_by: constructor; limit: 1 }
      `).toMatchResult(testModel, {});
    });
  });
});

describe('parameters', () => {
  // TODO excepting a field outright removes it from the source, without consideration
  //      to other fields that use that removed field in their definition; consider
  //      changing rename/accept/except to modify a mapping layer between the underlying
  //      source and the created source, as well as a separate way to override the definition
  //      of a field deeply (without removing it or changing its type).
  it.skip('can use dimension that uses field that is excepted', async () => {
    await expect(
      `
        ##! experimental.parameters
        source: state_facts is db.table('malloytest.state_facts') extend {
          dimension: state_copy is state
        }
        source: state_facts_ext is state_facts extend {
          except: state
        }

        run: state_facts_ext -> {
          group_by: state_copy
          order_by: state_copy desc
          limit: 1
        }
      `
    ).toMatchResult(testModel, {state_copy: 'AK'});
  });
});
