/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '../util/db-jest-matchers';

describe('emits events', () => {
  describe('for parameters', () => {
    test('argument compiled event is emitted', async () => {
      await expect(`
        ##! experimental.parameters
        source: s(x::string) is db.table('malloytest.state_facts') extend {
          where: x = 'CA'
        }
        run: s(x is "foo") -> { select: * }
      `).toEmitDuringCompile(testDatabase.runtime, {
        id: 'source-argument-compiled',
        data: {name: 'x'},
      });
    });
    test('parameterized source compiled event is emitted when source is used', async () => {
      await expect(`
        ##! experimental.parameters
        source: s(x::string) is db.table('malloytest.state_facts') extend {
          where: x = 'CA'
        }
        run: s(x is "foo") -> { select: * }
      `).toEmitDuringCompile(testDatabase.runtime, {
        id: 'parameterized-source-compiled',
        data: {parameters: {x: {type: 'string'}}},
      });
    });
    test('parameterized source compiled event is not emitted when source is not used', async () => {
      await expect(`
        ##! experimental.parameters
        source: a(used::string) is db.table('malloytest.state_facts') extend {
          where: used = 'CA'
        }
        source: b(unused::string) is db.table('malloytest.state_facts') extend {
          where: unused = 'CA'
        }
        run: a(used is "foo") -> { select: * }
      `).toEmitDuringCompile(testDatabase.runtime, {
        id: 'parameterized-source-compiled',
        data: {parameters: {used: {type: 'string'}}},
      });
    });
    test('parameterized source compiled event is emitted when join is used', async () => {
      await expect(`
        ##! experimental.parameters
        source: s0(x::string) is db.table('malloytest.state_facts') extend {
          where: x = 'CA'
        }
        source: s1 is db.table('malloytest.state_facts') extend {
          join_one: s0(x is "foo") on 1 = 1
        }
        run: s1 -> { select: s0.state }
      `).toEmitDuringCompile(testDatabase.runtime, {
        id: 'parameterized-source-compiled',
        data: {parameters: {x: {type: 'string'}}},
      });
    });
  });
  describe('for joins', () => {
    test('join usage is emitted', async () => {
      await expect(`
        ##! experimental.parameters
        source: s0(x::string) is db.table('malloytest.state_facts') extend {
          where: x = 'CA'
        }
        source: s1 is db.table('malloytest.state_facts') extend {
          join_one: s0(x is "foo") on 1 = 1
          join_one: s0_copy is s0(x is "bar") on 1 = 1
        }
        run: s1 -> {
          select: s0_copy.state
          select: foo is s0_copy.state // only should be emitted once
        }
      `).toEmitDuringCompile(testDatabase.runtime, {
        id: 'join-used',
        data: {name: 's0_copy'},
      });
    });
  });
  describe('for errors', () => {
    test('translator errors are emitted', async () => {
      await expect(`
        source: s1 is db.table('malloytest.state_facts') extend {
          dimension: foo is pick "foo" when 1 = 1 else 2
        }
        run: s1 -> { select: foo }
      `).toEmitDuringTranslation(testDatabase.runtime, {
        id: 'translation-error',
        data: {
          code: 'pick-else-type-does-not-match',
          data: {
            elseType: 'number',
            returnType: 'string',
          },
          message: 'else type `number` does not match return type `string`',
        },
      });
    });
  });
});

afterAll(() => testDatabase.shutdown());
