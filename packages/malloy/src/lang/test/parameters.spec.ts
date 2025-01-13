/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {error, errorMessage, markSource} from './test-translator';
import './parse-expects';

describe('parameters', () => {
  test('can declare parameter with no default value', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
    `).toTranslate();
  });
  test('can declare parameter with default value literal', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number is 7) is ab
    `).toTranslate();
  });
  test('can declare parameter with default value constant', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number is 7 + 7) is ab
    `).toTranslate();
  });
  test('cannot specify default value with incompatible type', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param::number is ${'"hello"'}) is ab
    `).toLog(
      errorMessage(
        'Default value for parameter does not match declared type `number`'
      )
    );
  });
  test('error if paramter has no type or value', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param) is ab
    `).toLog(
      errorMessage('Parameter must have default value or declared type')
    );
  });
  test('error if paramter type is null', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param is null) is ab
    `).toLog(
      errorMessage(
        'Default value cannot have type `null` unless parameter type is also specified'
      )
    );
  });
  test('allowed to write null::string', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param is null::string) is ab
    `).toTranslate();
  });
  test('allowed to write ::string is null', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::string is null) is ab
    `).toTranslate();
  });
  test('can use param in null equality expression', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param is null::string) is ab extend {
        where: param is null
      }
        run: ab_new(param is "foo") -> { select: * } -> { select: * }
    `).toTranslate();
  });
  test('error if paramter type is range', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param is 10 to 20) is ab
    `).toLog(errorMessage('A Range is not a value'));
  });
  test('no additional error if default value type is error', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param::number is 1 + ${'"foo"'}) is ab
    `).toLog(
      errorMessage("The '+' operator requires a number, not a 'string'")
    );
  });
  test('can declare parameter with inferred type', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param is 7) is ab
    `).toTranslate();
  });
  test('can pass parameter into extended base source', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      source: ab_new_new(param::number) is ab_new(param) extend {}
    `).toTranslate();
  });
  test.skip('can pass parameter into source of query', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      source: ab_new_new(param::number) is ab_new(param) -> { select: * }
    `).toTranslate();
  });
  test('can pass parameter to override default value with constant', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number is 10) is ab
      source: ab_new_new is ab_new(param is 7) extend {}
    `).toTranslate();
  });
  test('can pass parameter to override default value with param value', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number is 10) is ab
      source: ab_new_new(param::number is 11) is ab_new(param) extend {}
    `).toTranslate();
  });
  test('can pass parameter into named base source', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      source: ab_new_new(param::number) is ab_new(param)
    `).toTranslate();
  });
  test('can pass differently-named parameter into extended base source', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(new_param::number) is ab
      source: ab_new_new(new_new_param::number) is ab_new(new_param is new_new_param) extend {}
    `).toTranslate();
  });
  test('can pass differently-named parameter into named base source', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(new_param::number) is ab
      source: ab_new_new(new_new_param::number) is ab_new(new_param is new_new_param)
    `).toTranslate();
  });
  test('can pass parameter into base source longhand', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      source: ab_new_new(param::number) is ab_new(param is param)
    `).toTranslate();
  });
  test('can pass parameter into base source shorthand', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      source: ab_new_new(param::number) is ab_new(param)
    `).toTranslate();
  });
  test('can use declared parameter in dimension', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab extend {
        dimension: param_plus_one is param + 1
      }
    `).toTranslate();
  });
  test('can use declared parameter in sql function', () => {
    expect(`
      ##! experimental { parameters sql_functions }
      source: ab_new(param::number) is ab extend {
        dimension: param_plus_one is sql_number("\${param} + 1")
      }
      run: ab_new(param is 1) -> param_plus_one
    `).toTranslate();
  });
  test('can use declared parameter in nest extending other', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number is 10) is ab extend {
        dimension: p1 is param
        view: my_view is {
          group_by: p2 is param
          nest: nested is {
            group_by: p3 is param
          }
        }
      }
      run: ab_new -> my_view
    `).toTranslate();
  });
  test('can use declared parameter in source extension in view', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number is 10) is ab extend {
        view: my_view is {
          extend: {
            dimension: p1 is param
          }
          group_by: p1
        }
      }
    `).toTranslate();
  });
  test('can use declared parameter in nest with table', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number is 10) is _db_.table('aTable') extend {
        dimension: p1 is param
        view: my_view is {
          group_by: p2 is param
          nest: nested is {
            group_by: p3 is param
          }
        }
      }
      run: ab_new -> my_view
    `).toTranslate();
  });
  test('can pass argument for param', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      run: ab_new(param is 1) -> { select: * }
    `).toTranslate();
  });
  test('can not pass argument for default-valued param', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param is 1) is ab
      run: ab_new -> { select: * }
    `).toTranslate();
  });
  test('can pass zero args for source with default-valued param', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param is 1) is ab
      run: ab_new() -> { select: * }
    `).toTranslate();
  });
  test('can pass non-literal argument for param', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      run: ab_new(param is 1 + 1) -> { select: * }
    `).toTranslate();
  });
  test('parameter not included in wildcard', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param::number) is ab extend {
        view: all_fields is { select: * }
      }
      run: ab_new(param is 1) -> all_fields -> { select: ${'param'} }
    `).toLog(errorMessage("'param' is not defined"));
  });
  test('cannot reference renamed param in query against source', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      run: ab_new(param is 1) -> { select: p is ${'param'} }
    `).toLog(errorMessage("'param' is not defined"));
  });
  test('cannot reference param in query against source', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      run: ab_new(param is 1) -> { select: ${'param'} }
    `).toLog(errorMessage("'param' is not defined"));
  });
  test('cannot reference param in source extension', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      source: x is ab_new(param is 1) extend {
        dimension: param_copy is ${'param'}
      }
    `).toLog(errorMessage("'param' is not defined"));
  });
  test('cannot reference param in in-query source extension', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      run: ab_new(param is 1) -> {
        extend: {
          dimension: param_copy is ${'param'}
        }
        group_by: param_copy
      }
    `).toLog(errorMessage("'param' is not defined"));
  });
  test('can reference field in source in argument', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      run: ab_new(param is ${'ai'}) -> { select: * }
    `).toLog(errorMessage('`ai` is not defined'));
  });
  test('can pass through parameter to joined source (shorthand)', () => {
    expect(`
      ##! experimental.parameters
      source: ab_ext_1(a_1::string) is ab extend {
        where: ai = a_1
      }

      source: ab_ext_2(a_2::string) is ab extend {
        where: ai = a_2
        join_many: ab_ext_1(a_1 is a_2) on 1 = 1
      }

      run: ab_ext_2(a_2 is "CA") -> {
        group_by:
          a1 is ai,
          a2 is ab_ext_1.ai
        aggregate: c is count()
      }
    `).toTranslate();
  });
  test('can pass through parameter to joined source (longhand)', () => {
    expect(`
      ##! experimental.parameters
      source: ab_ext_1(a_1::string) is ab extend {
        where: ai = a_1
      }

      source: ab_ext_2(a_2::string) is ab extend {
        where: ai = a_2
        join_many: ab_ext_1 is ab_ext_1(a_1 is a_2) on 1 = 1
      }

      run: ab_ext_2(a_2 is "CA") -> {
        group_by:
          a1 is ai,
          a2 is ab_ext_1.ai
        aggregate: c is count()
      }
    `).toTranslate();
  });
  test.skip('can pass through parameter to source in joined query', () => {
    expect(`
      ##! experimental.parameters
      source: ab_ext_1(a_1::string) is ab extend {
        where: ai = a_1
      }

      source: ab_ext_2(a_2::string) is ab extend {
        where: ai = a_2
        join_many: ab_ext_1 is ab_ext_1(a_1 is a_2) -> { select: * } on 1 = 1
      }
    `).toTranslate();
  });
  test.skip('can pass through parameter to view in joined query', () => {
    expect(`
      ##! experimental.parameters
      source: ab_ext(param::string) is ab extend {
        join_many: abq is ab -> { select: p is param } on 1 = 1
      }
    `).toTranslate();
  });
  test.skip('can pass through parameter to source in query in SQL source', () => {
    expect(`
      ##! experimental.parameters
      source: ab_ext(param::string) is ab
      source: sql_query(a_1::string) is duckdb.sql("""
        SELECT * FROM (%{ ab_ext(param is a_1) -> { select: * } })
      """)
    `).toTranslate();
  });
  test.skip('can pass through parameter to view in query in SQL source', () => {
    expect(`
      ##! experimental.parameters
      source: sql_query(a_1::string) is duckdb.sql("""
        SELECT * FROM (%{ ab -> { select: p is param } })
      """)
    `).toTranslate();
  });
  test.skip('can pass through parameter to source in query in joined SQL source', () => {
    expect(`
      ##! experimental.parameters
      source: ab_ext_1(a_1::string) is ab extend {
        where: ai = a_1
      }

      source: ab_ext_2(a_2::string) is ab extend {
        where: ai = a_2
        join_many: ab_ext_1 is duckdb.sql("""
          SELECT * FROM (%{ ab_ext_1(a_1 is a_2) -> { select: * } })
        """) on 1 = 1
      }
    `).toTranslate();
  });
  test('can reference param in query against source', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      run: ab_new(param is 1) -> { select: ${'param'} }
    `).toLog(errorMessage("'param' is not defined"));
  });
  test('can reference param in view in source', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab extend {
        view: x is { select: param }
      }
    `).toTranslate();
  });
  test('can declare dimension which is just the parameter', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab extend {
        dimension: p is param
      }
    `).toTranslate();
  });
  test('cannot reference param in expression in query against source', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      run: ab_new(param is 1) -> { select: p is ${'param'} }
    `).toLog(errorMessage("'param' is not defined"));
  });
  test('error when declaring parameter twice', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number, ${'param::number'}) is ab
      `
    ).toLog(errorMessage('Cannot redefine parameter `param`'));
  });
  // This behavior will likely change in the future; but in the meantime, this
  // safeguards against some confusion about parameter scoping
  test('error when declaring parameter with same name as field (extended)', () => {
    expect(
      `
        ##! experimental.parameters
        source: ab_new(ai::string) is ab extend {
          dimension: foo is upper(ai)
        }
      `
    ).toLog(
      errorMessage('No matching overload for function upper(number)'),
      errorMessage(
        'Illegal shadowing of field `ai` by parameter with the same name'
      )
    );
  });
  test('can shadow field that is excepted', () => {
    expect(
      `
        ##! experimental.parameters
        source: ab_new(ai::string) is ab extend {
          except: ai
          dimension: foo is upper(ai)
        }
      `
    ).toTranslate();
  });
  test('error when declaring parameter with same name as field (not extended)', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(${'ai::string'}) is ab
      `
    ).toLog(
      errorMessage(
        'Illegal shadowing of field `ai` by parameter with the same name'
      )
    );
  });
  test('do not inherit parameters from base source', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number) is ab
        source: ab_new_new is ab_new(param is 1)
        run: ab_new_new(${'param'} is 2) -> { select: * }
      `
    ).toLog(
      errorMessage('`ab_new_new` has no declared parameter named `param`')
    );
  });
  test('error when declaring field with same name as parameter', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number) is ab extend {
          dimension: param is 1
        }
      `
    ).toLog(errorMessage("Cannot redefine 'param'"));
  });
  test('error when declaring parameter without experiment enabled', () => {
    expect(
      markSource`
        source: ab_new(param::number) is ab
      `
    ).toLog(error('experiment-not-enabled', {experimentId: 'parameters'}));
  });
  test('cannot except parameter from extended source', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param_a::number) is ab
        source: ab_new_new(param_b::number) is ab_new(param_a is 1) extend {
          except: param_a
        }
      `
    ).toLog(errorMessage('`param_a` is not defined'));
  });
  test('cannot except parameter in direct extend', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number) is ab extend {
          except: param
        }
      `
    ).toLog(errorMessage('Illegal `except:` of parameter'));
  });
  test('cannot accept parameter', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number) is ab extend {
          accept: param
        }
      `
    ).toLog(errorMessage('Illegal `accept:` of parameter'));
  });
  test('error when using parameter without experiment enabled', () => {
    expect(
      markSource`
        run: ab_new${'(param is param)'} -> { select: * }
      `
    ).toLog(error('experiment-not-enabled', {experimentId: 'parameters'}));
  });
  test('parameters cannot reference themselves', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number) is ab
        run: ab_new(param is ${'param'}) -> { select: * }
      `
    ).toLog(errorMessage('`param` is not defined'));
  });
  // This just looks like circular referencing--in reality, you cannot reference other
  // parameters in parameter arguments, hence just "xxx is not defined"
  test('error when circularly referencing mutually recursive parameters in argument', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(p_a::number, p_b::number) is ab
        run: ab_new(p_a is ${'p_b'}, p_b is ${'p_a'}) -> { select: * }
      `
    ).toLog(
      errorMessage('`p_b` is not defined'),
      errorMessage('`p_a` is not defined')
    );
  });
  test('error when passing param with no name', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number) is ab
        run: ab_new(${'1'}) -> { select: * }
      `
    ).toLog(
      errorMessage(
        'Parameterized source arguments must be named with `parameter_name is`'
      ),
      errorMessage('Argument not provided for required parameter `param`')
    );
  });
  test('error when passing param with incorrect name', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number) is ab
        run: ab_new(${'wrong_name'} is 1, param is 2) -> { select: * }
      `
    ).toLog(
      errorMessage('`ab_new` has no declared parameter named `wrong_name`')
    );
  });
  test('error when passing param multiple times', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number) is ab
        run: ab_new(param is 1, ${'param is 2'}) -> { select: * }
      `
    ).toLog(errorMessage('Cannot pass argument for `param` more than once'));
  });
  test('error when not specifying argument for param with parentheses', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number) is ab
        run: ${'ab_new'}() -> { select: * }
      `
    ).toLog(
      errorMessage('Argument not provided for required parameter `param`')
    );
  });
  test('error when not specifying argument for param without parentheses', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number) is ab
        run: ${'ab_new'} -> { select: * }
      `
    ).toLog(
      errorMessage('Argument not provided for required parameter `param`')
    );
  });
  test('error when not specifying argument for param second time', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new(param::number) is ab
        run: ab_new(param is 1) -> { select: * }
        run: ${'ab_new'} -> { select: * }
      `
    ).toLog(
      errorMessage('Argument not provided for required parameter `param`')
    );
  });
  test('error when referencing parameter that does not exist in join definition', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new_1(param_1::number) is ab
        source: ab_new_2(param_2::number) is ab extend {
          join_one: ab_join is ab_new_1(param_1 is ${'param_3'})
        }
      `
    ).toLog(errorMessage('`param_3` is not defined'));
  });
  test('error when referencing identifier in default param value', () => {
    expect(
      markSource`
        ##! experimental.parameters
        source: ab_new_1(param_1 is ${'ident'}) is ab
      `
    ).toLog(errorMessage('Only constants allowed in parameter default values'));
  });
  test.skip('can use param in multi-stage query', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab extend {
        view: q is {
          select: *
        } -> {
          group_by: x is param
        }
      }
    `).toTranslate();
  });
  test('can not pass parameter into source of query yet', () => {
    expect(markSource`
      ##! experimental.parameters
      source: ab_new(param::number) is ab
      source: ab_new_new(param::number) is ab_new(${'param'}) -> { select: * }
    `).toLog(errorMessage('`param` is not defined'));
  });
  test.skip('can add an annotation to a param', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(
        # mytag=1
        param::number
      ) is ab
    `).toTranslate();
  });
  test('source arguments from query propagate as arguments not parameters', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab extend {
        dimension: param_value is param
      }
      query: foo is ab_new(param is 1) -> { select: param_value }
      source: foo_ext is foo
      run: foo_ext -> { select: param_value }
    `).toTranslate();
  });
  test('source arguments carry over from previous invocation', () => {
    expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ab extend {
        dimension: param_value is param
      }
      source: foo is ab_new(param is 1)
      source: foo_ext is foo
      run: foo_ext -> { select: param_value }
    `).toTranslate();
  });
});
