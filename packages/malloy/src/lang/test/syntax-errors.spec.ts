/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
  test('mis-spelled keyword in top-level', () => {
    expect(
      'sourc: aplus is a extend { dimension: one_more is ai + 1 }'
    ).toLogAtLeast(
      errorMessage(
        "Expected a statement, 'sourc:' is not a keyword. Did you mean 'source:'?"
      )
    );
  });
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
      `).toLogAtLeast(errorMessage("missing '{' before 'primary_key:'"));
    });

    test('use of the distinct keyword in a count', () => {
      expect(
        'source: x is a extend { measure: ai_count is count(distinct ai) }'
      ).toLogAtLeast(
        errorMessage(
          '`count(distinct expression)` deprecated, use `count(expression)` instead.'
        )
      );
    });

    test('mistakenly specifying a type instead of a value', () => {
      expect('source: x is a extend { dimension: s is string }').toLogAtLeast(
        errorMessage(
          "Unexpected type 'string' in dimension definition. Expected an expression or field reference."
        )
      );
    });
  });

  describe('exploreProperties', () => {
    test('mis-spelled keyword in extends block', () => {
      expect(
        'source: aplus is a extend { dinemsion: one_more is ai + 1 }'
      ).toLogAtLeast(
        errorMessage(
          "Expected a source statement, 'dinemsion:' is not a keyword. Did you mean 'dimension:'?"
        )
      );
    });
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
        errorMessage("unexpected '{', expected a `quoted` name or a name")
      );
    });

    test('use of as in dimension', () => {
      expect(`source: x is a extend {
        dimension: ai as dimension_name
      }`).toLogAtLeast(
        errorMessage(
          "Unsupported keyword 'as'. Use 'is' to name something (ex: `dimension: name is expression`)"
        )
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

    test('incorrect use of undefined function in unnamed aggregate', () => {
      expect(`
        source: x is a extend {
          view: t is {
            aggregate: pct_of_total(time)
          }
      }`).toLogAtLeast(
        errorMessage(
          "Unknown function 'pct_of_total'. You can find available functions here: https://docs.malloydata.dev/documentation/language/functions"
        )
      );
    });
  });

  describe('reserved word used as a name', () => {
    const quoteHint =
      "'year' is a reserved word, so to use it as a name you must quote it: `year`";
    test('group_by: a reserved word', () => {
      expect('run: a -> { group_by: year }').toLogAtLeast(
        errorMessage(quoteHint)
      );
    });
    test('select: a reserved word', () => {
      expect('run: a -> { select: year }').toLogAtLeast(
        errorMessage(quoteHint)
      );
    });
    test('naming a dimension with a reserved word', () => {
      expect('source: x is a extend { dimension: year is 1 }').toLogAtLeast(
        errorMessage(quoteHint)
      );
    });
    test('reserved word in a where expression', () => {
      expect('run: a -> { select: astr; where: timestamp = 1 }').toLogAtLeast(
        errorMessage(
          "'timestamp' is a reserved word, so to use it as a name you must quote it: `timestamp`"
        )
      );
    });
    test('reserved word as a bare source reference', () => {
      // A backtick-named reserved-word source, referenced bare, suggests quoting.
      expect(
        'source: `import` is a extend {}\nrun: import -> { select: * }'
      ).toLogAtLeast(
        errorMessage(
          "'import' is a reserved word, so to use it as a name you must quote it: `import`"
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
        errorMessage(
          "Expected a query statement, 'groop_by:' is not a keyword. Did you mean 'group_by:'?"
        )
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

    test('select in grouping query', () => {
      expect(`
          run: a -> {
            group_by: astr
            select: ai
          }
        `).toLogAtLeast(
        errorMessage('Use of select: is not allowed in a grouping query')
      );
    });

    test('group_by in selecting query', () => {
      expect(`
          run: a -> {
            select: ai
            group_by: astr
          }
        `).toLogAtLeast(
        errorMessage('Use of group_by: is not allowed in a select query')
      );
    });

    test('unexpected us of "as" in select query', () => {
      expect(`
          run: a -> {
            select: ai as name
          }
        `).toLogAtLeast(
        errorMessage(
          "Unsupported keyword 'as'. Use 'is' to name something (ex: `select: new_name is column_name`)"
        )
      );
    });
  });
});
