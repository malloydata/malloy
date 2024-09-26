/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {runtimeFor} from './runtimes';
import './util/db-jest-matchers';

const runtime = runtimeFor('duckdb');

const envDatabases = (
  process.env['MALLOY_DATABASES'] ||
  process.env['MALLOY_DATABASE'] ||
  'duckdb'
).split(',');

let describe = globalThis.describe;
if (!envDatabases.includes('duckdb')) {
  describe = describe.skip;
  describe.skip = describe;
}

describe('emits events', () => {
  describe('for parameters', () => {
    test('argument compiled event is emitted', async () => {
      await expect(`
        ##! experimental.parameters
        source: s(x::string) is duckdb.table('malloytest.state_facts') extend {
          where: x = 'CA'
        }
        run: s(x is "foo") -> { select: * }
      `).toEmitDuringCompile(runtime, {
        id: 'source-argument-compiled',
        data: {name: 'x'},
      });
    });
    test('parameterized source compiled event is emitted when source is used', async () => {
      await expect(`
        ##! experimental.parameters
        source: s(x::string) is duckdb.table('malloytest.state_facts') extend {
          where: x = 'CA'
        }
        run: s(x is "foo") -> { select: * }
      `).toEmitDuringCompile(runtime, {
        id: 'parameterized-source-compiled',
        data: {parameters: {x: {type: 'string'}}},
      });
    });
    test('parameterized source compiled event is not emitted when source is not used', async () => {
      await expect(`
        ##! experimental.parameters
        source: a(used::string) is duckdb.table('malloytest.state_facts') extend {
          where: used = 'CA'
        }
        source: b(unused::string) is duckdb.table('malloytest.state_facts') extend {
          where: unused = 'CA'
        }
        run: a(used is "foo") -> { select: * }
      `).toEmitDuringCompile(runtime, {
        id: 'parameterized-source-compiled',
        data: {parameters: {used: {type: 'string'}}},
      });
    });
    test('parameterized source compiled event is emitted when join is used', async () => {
      await expect(`
        ##! experimental.parameters
        source: s0(x::string) is duckdb.table('malloytest.state_facts') extend {
          where: x = 'CA'
        }
        source: s1 is duckdb.table('malloytest.state_facts') extend {
          join_one: s0(x is "foo") on 1 = 1
        }
        run: s1 -> { select: s0.state }
      `).toEmitDuringCompile(runtime, {
        id: 'parameterized-source-compiled',
        data: {parameters: {x: {type: 'string'}}},
      });
    });
  });
  describe('for joins', () => {
    test('join usage is emitted', async () => {
      await expect(`
        ##! experimental.parameters
        source: s0(x::string) is duckdb.table('malloytest.state_facts') extend {
          where: x = 'CA'
        }
        source: s1 is duckdb.table('malloytest.state_facts') extend {
          join_one: s0(x is "foo") on 1 = 1
          join_one: s0_copy is s0(x is "bar") on 1 = 1
        }
        run: s1 -> {
          select: s0_copy.state
          select: foo is s0_copy.state // only should be emitted once
        }
      `).toEmitDuringCompile(runtime, {
        id: 'join-used',
        data: {name: 's0_copy'},
      });
    });
  });
  describe('for errors', () => {
    test('translator errors are emitted', async () => {
      await expect(`
        source: s1 is duckdb.table('malloytest.state_facts') extend {
          dimension: foo is pick "foo" when 1 = 1 else 2
        }
        run: s1 -> { select: foo }
      `).toEmitDuringTranslation(runtime, {
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
