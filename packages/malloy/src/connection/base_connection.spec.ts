/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vm from 'vm';
import {BaseConnection} from './base_connection';

// A connection whose driver fails with whatever it is given.
function failingWith(thrown: () => unknown) {
  class Failing extends BaseConnection {
    get name() {
      return 'failing';
    }
    get dialectName() {
      return 'duckdb';
    }
    getDigest = () => 'failing';
    runSQL = jest.fn();
    fetchTableSchema = async () => {
      throw thrown();
    };
    fetchSelectSchema = jest.fn();
  }
  return new Failing();
}

describe('BaseConnection schema errors', () => {
  test.each([
    ['a string', () => 'no table t'],
    [
      'an Error from another realm',
      () => vm.runInNewContext('new Error("no table t")'),
    ],
  ])('keep the message of %s a driver throws', async (_, thrown) => {
    const {errors} = await failingWith(thrown).fetchSchemaForTables(
      {'failing.t': 't'},
      {}
    );
    expect(errors['failing.t']).toBe('no table t');
  });
});
