/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {errorMessage} from './test-translator';
import './parse-expects';

/**
 * Unit tests intended to cover the custom error messages defined in
 * malloy-custom-error-messages.ts.
 *
 * These tests are intended to prevent unintended regressions. It is
 * okay to change or remove tests here as long as you are doing so
 * for a good reason.
 */
describe('custom error messages', () => {
  describe('source', () => {
    test('missing alias', () => {
      expect('source: x extend { }').toLogAtLeast(
        errorMessage("Expected 'is' or '(' following identifier 'x'")
      );
    });

    test('missing closing curly: EOF', () => {
      expect('source: x is a extend {').toLogAtLeast(
        errorMessage("Missing '}' at '<EOF>'")
      );
    });

    test('source: missing colon in root context', () => {
      expect('source x is a extend { }').toLogAtLeast(
        errorMessage("Expected ':' following 'source'")
      );
    });

    test('opening curly to EOF', () => {
      expect(`
          source: y is x extend {
        `).toLogAtLeast(errorMessage("Missing '}' at '<EOF>'"));
    });

    test('expression missing operand before curly', () => {
      expect(
        "source: a is presto.table('malloytest.state_facts') {}"
      ).toLogAtLeast(
        errorMessage(
          "Unexpected '{' following source expression. Expected: 'extend', 'include', '+' or '->'"
        )
      );
    });

    test('missing opening curly after source extend keyword', () => {
      expect(`
        source: x is a extend
          primary_key: id
      `).toLogAtLeast(errorMessage("missing '{' at 'primary_key:'"));
    });
  });

  describe('exploreProperties', () => {
    test('misspelled "join"', () => {
      expect(`source: x is a extend {
        join: data is y on dataId = data.id
      }`).toLogAtLeast(
        errorMessage(
          "Unexpected 'join:'. Did you mean 'join_one:', 'join_many:' or 'join_cross:'?"
        )
      );

      expect(`source: x is a extend {
        primary_key: name
        join: data is y on dataId = data.id
      }`).toLogAtLeast(
        errorMessage(
          "Unexpected 'join:'. Did you mean 'join_one:', 'join_many:' or 'join_cross:'?"
        )
      );
    });
    test('misspelled "primary_key:"', () => {
      expect('source: x is a extend { primaryKey: name }').toLogAtLeast(
        errorMessage("Unexpected 'primaryKey'. Did you mean 'primary_key:'?")
      );

      expect('source: x is a extend { primary key: name }').toLogAtLeast(
        errorMessage("Unexpected 'primary'. Did you mean 'primary_key:'?")
      );
    });

    test('explore statement keyword missing colon', () => {
      expect('source: x is a extend { where x > 5 }').toLogAtLeast(
        errorMessage("Expected ':' following 'where'")
      );
      expect('source: x is a extend { primary_key name }').toLogAtLeast(
        errorMessage("Expected ':' following 'primary_key'")
      );
      expect(
        'source: x is a extend { declare total is value.sum() }'
      ).toLogAtLeast(errorMessage("Expected ':' following 'declare'"));
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
  });

  describe('view', () => {
    test('view is missing name', () => {
      expect(`
        source: x is a extend { view: {
            group_by: b
        } }
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

  describe('queryStatement', () => {
    test('misspelled group_by:', () => {
      expect('source: x is a -> { groupBy: name }').toLogAtLeast(
        errorMessage("Unexpected 'groupBy'. Did you mean 'group_by:'?")
      );

      expect('source: x is a -> { group by: name }').toLogAtLeast(
        errorMessage("Unexpected 'group'. Did you mean 'group_by:'?")
      );

      expect('source: x is a -> { group by name }').toLogAtLeast(
        errorMessage("Unexpected 'group'. Did you mean 'group_by:'?")
      );
    });

    test('misspelled order_by:', () => {
      expect('source: x is a -> { orderBy: name }').toLogAtLeast(
        errorMessage("Unexpected 'orderBy'. Did you mean 'order_by:'?")
      );

      expect('source: x is a -> { order by: name }').toLogAtLeast(
        errorMessage("Unexpected 'order'. Did you mean 'order_by:'?")
      );

      expect('source: x is a -> { order by name }').toLogAtLeast(
        errorMessage("Unexpected 'order'. Did you mean 'order_by:'?")
      );
    });

    test('query statement keyword missing colon', () => {
      expect('source: x is a -> { group_by x > 5 }').toLogAtLeast(
        errorMessage("Expected ':' following 'group_by'")
      );
      expect('source: x is a -> { declare name is id }').toLogAtLeast(
        errorMessage("Expected ':' following 'declare'")
      );
      expect('source: x is a -> { select * }').toLogAtLeast(
        errorMessage("Expected ':' following 'select'")
      );
      expect('source: x is a -> { project i, j, k}').toLogAtLeast(
        errorMessage("Expected ':' following 'project'")
      );
      expect('source: x is a -> { where val > 5}').toLogAtLeast(
        errorMessage("Expected ':' following 'where'")
      );
      expect('source: x is a -> { order_by name desc, 2 asc}').toLogAtLeast(
        errorMessage("Expected ':' following 'order_by'")
      );
    });

    test('mis-spelled keyword in query', () => {
      expect('run: a -> { groop_by: astr }').toLog(
        errorMessage("Expected a query statement, 'groop_by:' is not a keyword")
      );
    });
  });

  describe('run', () => {
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

    test('run opening curly to EOF', () => {
      expect(`
          run: x -> {
        `).toLogAtLeast(errorMessage("Missing '}' at '<EOF>'"));
    });
  });
});
