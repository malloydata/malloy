/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {errorMessage} from './test-translator';
import './parse-expects';

describe('errors', () => {
  test('source missing closing curly: EOF', () => {
    expect('source: x is a extend {').toLogAtLeast(
      errorMessage("Missing '}' at '<EOF>'")
    );
  });

  test('view is missing name', () => {
    expect(`
      source: x is a extend {
        view: {
          group_by: b
        }
      }
      `).toLogAtLeast(
      errorMessage("'view:' must be followed by '<identifier> is {'")
    );
  });

  test('missing closing curly, source>view', () => {
    expect(`
      source: x is a extend {
        view: y is {
          group_by: b

        view: z is {
          group_by: c
        }
      }
      `).toLogAtLeast(errorMessage("Missing '}' at 'view:'"));
  });

  test('incorrect opening curly after dimension', () => {
    expect(`
      source: x is a extend {
        dimension: {
          test is best
        }
      }
      `).toLogAtLeast(
      errorMessage("extraneous input '{' expecting {BQ_STRING, IDENTIFIER}")
    );
  });

  test('misspelled primarykey', () => {
    expect(`
      source: x is a extend {
        primarykey: id
      }
    `).toLogAtLeast(
      errorMessage("no viable alternative at input 'primarykey'")
    );
  });

  test('missing opening curly after source extend keyword', () => {
    expect(`
      source: x is a extend
        primary_key: id
    `).toLogAtLeast(errorMessage("Missing '{' after 'extend'"));
  });

  test('missing alias for aggregate entry', () => {
    expect(`
        run: x -> {
          aggregate: count()
        }
      `).toLogAtLeast(
      errorMessage(
        "'aggregate:' entries must include a name (ex: `some_name is count()`)"
      )
    );
  });

  test('missing alias for aggregate inside source>view', () => {
    expect(`
      source: x is aa extend {
        measure: airport_count is count()

        view: by_state is {
          where: state is not null
          aggregate: count()
        }
      }
      `).toLogAtLeast(
      errorMessage(
        "'aggregate:' entries must include a name (ex: `some_name is count()`)"
      )
    );
  });
});
