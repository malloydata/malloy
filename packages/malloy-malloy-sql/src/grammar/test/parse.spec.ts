/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {MalloySQLParser} from '../../malloySQLParser';
import {MalloySQLSQLStatement, MalloySQLStatementType} from '../../types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeErrorFreeMalloySQLParse(): R;
    }
  }
}

expect.extend({
  toBeErrorFreeMalloySQLParse: function (document: string) {
    const parse = MalloySQLParser.parse(document);
    if (parse.errors.length > 0) {
      return {
        message: () =>
          `unexpected parse errors: ${parse.errors
            .map(m => m.message)
            .join('\n')}`,
        pass: false,
      };
    } else return {pass: true, message: () => ''};
  },
});

describe('MalloySQL parse', () => {
  describe('Should parse inital comments', () => {
    test('initial single-line forward-slash comment', () => {
      ['//hello', '  //hello', '//hello\n', '\n //hello\n'].forEach(x =>
        expect(x).toBeErrorFreeMalloySQLParse()
      );
    });

    test('initial single-line double-dash comment', () => {
      ['--hello', '  --hello', '--hello\n', '\n --hello\n'].forEach(x =>
        expect(x).toBeErrorFreeMalloySQLParse()
      );
    });

    test('initial multi-line comment', () => {
      ['/* hi */', ' /* hi */ ', '/* hi */\n', '\n /* hi */\n'].forEach(x =>
        expect(x).toBeErrorFreeMalloySQLParse()
      );
    });

    test('initial comments mixed', () => {
      expect(
        '\n   //hey -- hey \n\t --hay\n/* hi */'
      ).toBeErrorFreeMalloySQLParse();
    });
  });

  describe('Should parse control statement', () => {
    test('Should parse immediate delimiter', () => {
      [
        '>>>sql connection:x',
        '>>>malloy',
        '>>>malloy //test',
        '>>>sql connection: a',
        '>>>sql connection:  a\n',
        '>>>sql connection:a  //x\n\n',
        '>>>sql connection: my_connection_name // test',
      ].forEach(x => expect(x).toBeErrorFreeMalloySQLParse());
    });

    test('Should parse initial comments and delimiter', () => {
      [
        '// hey\n>>>sql connection:x',
        '/* test */\n\n\n>>>malloy // test',
        '--info\t>>>sql a',
      ].forEach(x => expect(x).toBeErrorFreeMalloySQLParse());
    });

    test('Should parse multiple empty control statements', () => {
      [
        '// hey\n>>>sql connection:x\n>>>sql connection:x\n>>>malloy\n',
        '// hey\n>>>sql connection:x  \n>>>sql\n>>>malloy\n\n',
        '\n>>>sql connection: my_connection_name  \n   /* test */\n\n>>>sql\n--hey\n>>>malloy\n\n',
      ].forEach(x => expect(x).toBeErrorFreeMalloySQLParse());
    });
  });

  describe('Should parse statement', () => {
    test('Should parse statement with comments', () => {
      expect(
        `>>>sql connection:y\nSELECT 1 FROM %{ malloy }% /*test*/`
      ).toBeErrorFreeMalloySQLParse();
      expect(
        `>>>malloy \nquery -> source -> banana/*test*/`
      ).toBeErrorFreeMalloySQLParse();
    });

    test('Should parse statements', () => {
      expect(
        `>>>sql connection:x\nSELECT 1 FROM %{ malloy }% /*test*/\n>>>malloy\n>>>sql`
      ).toBeErrorFreeMalloySQLParse();
      expect(
        `>>>malloy\nquery -> source -> banana/*test*/\n\r>>>sql connection:x\nSELECT 1 >>>malloy\n\n`
      ).toBeErrorFreeMalloySQLParse();
    });
  });

  describe('connection: config', () => {
    test('Should not allow connection in >>>malloy line', () => {
      expect(MalloySQLParser.parse(`>>>malloy connection`).errors).toHaveLength(
        1
      );
    });

    test('Should not allow anything besides comments in >>>malloy line', () => {
      expect(MalloySQLParser.parse(`>>>malloy a //test`).errors).toHaveLength(
        1
      );
    });

    test('Should handle a connection in a delimiter', () => {
      const parse = MalloySQLParser.parse(`\
>>>malloy
import "foo"
>>>sql connection:bigquery
SELECT 1`);
      expect(parse.statements[1].config?.connection).toBe('bigquery');
      expect(parse.statements[1].config?.fromDelimiter).toBe(true);
    });

    test('Should handle a connection in a comment', () => {
      const parse = MalloySQLParser.parse(`\
>>>malloy
import "foo"
>>>sql
-- connection:bigquery
SELECT 1`);
      expect(parse.statements[1].config?.connection).toBe('bigquery');
      expect(parse.statements[1].config?.fromDelimiter).toBeFalsy();
      expect(parse.statements[1].config?.inheritedConnection).toBeFalsy();
    });

    test('Should mark a connection as inherited', () => {
      const parse = MalloySQLParser.parse(`\
>>>malloy
import "foo"
>>>sql
-- connection:bigquery
SELECT 1
>>>sql
SELECT 2
`);
      expect(parse.statements[1].config?.connection).toBe('bigquery');
      expect(parse.statements[1].config?.fromDelimiter).toBeFalsy();
      expect(parse.statements[1].config?.inheritedConnection).toBeFalsy();
      expect(parse.statements[2].config?.connection).toBe('bigquery');
      expect(parse.statements[2].config?.fromDelimiter).toBeFalsy();
      expect(parse.statements[2].config?.inheritedConnection).toBe(true);
    });
  });

  describe('Embedded Malloy', () => {
    test('Parenthesized embedded malloy can handle space between ( and {%', () => {
      const parse = MalloySQLParser.parse(
        '>>>sql connection:bigquery\nSELECT (  %{ malloy }%  )'
      );
      const stmt = parse.statements[0] as MalloySQLSQLStatement;
      const embeddedMalloy = stmt.embeddedMalloyQueries[0];
      expect(embeddedMalloy.query).toBe(' malloy ');
      expect(embeddedMalloy.parenthesized).toBeTruthy();
      expect(embeddedMalloy.range.start.character).toBe(7);
      expect(embeddedMalloy.malloyRange.start.character).toBe(12);
    });

    test('Non-parenthesized embedded malloy', () => {
      const parse = MalloySQLParser.parse(
        '>>>sql connection:bigquery\nSELECT %{ malloy }%'
      );
      const stmt = parse.statements[0] as MalloySQLSQLStatement;
      const embeddedMalloy = stmt.embeddedMalloyQueries[0];
      expect(embeddedMalloy.query).toBe(' malloy ');
      expect(embeddedMalloy.parenthesized).toBeFalsy();
      expect(embeddedMalloy.range.start.character).toBe(7);
      expect(embeddedMalloy.malloyRange.start.character).toBe(9);
    });
  });

  describe('Parse output', () => {
    test('Should provide correct output for single statement', () => {
      const parse = MalloySQLParser.parse(`\
>>>sql connection:bigquery
SELECT 1`);
      expect(parse.statements).toHaveLength(1);
      expect(parse.statements[0].type).toBe(MalloySQLStatementType.SQL);
      expect(parse.statements[0].text).toBe('SELECT 1');
      expect(parse.statements[0].config?.connection).toBe('bigquery');
      expect(parse.statements[0].index).toBe(0);
      expect(parse.statements[0].range.start.line).toBe(1);
      expect(parse.statements[0].range.start.character).toBe(0);
      expect(parse.statements[0].range.end.character).toBe(8);
    });

    test('Should provide correct output for multiple statements', () => {
      const parse = MalloySQLParser.parse(`\
>>>markdown
# Hello SQL
>>>sql connection:bigquery
SELECT 1
>>>markdown
# Hello Malloy
>>>malloy
import "airports.malloy"`);

      expect(parse.statements).toHaveLength(4);

      expect(parse.statements[0].type).toBe(MalloySQLStatementType.MARKDOWN);
      expect(parse.statements[0].text).toBe('# Hello SQL');
      expect(parse.statements[0].index).toBe(0);
      expect(parse.statements[0].range.start.line).toBe(1);
      expect(parse.statements[0].range.start.character).toBe(0);
      expect(parse.statements[0].range.end.character).toBe(11);

      expect(parse.statements[1].type).toBe(MalloySQLStatementType.SQL);
      expect(parse.statements[1].text).toBe('SELECT 1');
      expect(parse.statements[1].config?.connection).toBe('bigquery');
      expect(parse.statements[1].index).toBe(1);
      expect(parse.statements[1].range.start.line).toBe(3);
      expect(parse.statements[1].range.start.character).toBe(0);
      expect(parse.statements[1].range.end.character).toBe(8);

      expect(parse.statements[2].type).toBe(MalloySQLStatementType.MARKDOWN);
      expect(parse.statements[2].text).toBe('# Hello Malloy');
      expect(parse.statements[2].index).toBe(2);
      expect(parse.statements[2].range.start.line).toBe(5);
      expect(parse.statements[2].range.start.character).toBe(0);
      expect(parse.statements[2].range.end.character).toBe(14);

      expect(parse.statements[3].type).toBe(MalloySQLStatementType.MALLOY);
      expect(parse.statements[3].text).toBe('import "airports.malloy"');
      expect(parse.statements[3].index).toBe(3);
      expect(parse.statements[3].range.start.line).toBe(7);
      expect(parse.statements[3].range.start.character).toBe(0);
      expect(parse.statements[3].range.end.character).toBe(24);
    });

    test('Should provide correct output for mulitple statements with embedded malloy', () => {
      const parse = MalloySQLParser.parse(`\
>>>markdown
# Hello SQL
>>>sql connection:bigquery
SELECT 1 FROM %{ malloy-here }%;
>>>markdown
# Hello Malloy
>>>malloy
import "airports.malloy"`);

      expect(parse.statements).toHaveLength(4);

      expect(parse.statements[0].type).toBe(MalloySQLStatementType.MARKDOWN);
      expect(parse.statements[0].text).toBe('# Hello SQL');
      expect(parse.statements[0].index).toBe(0);
      expect(parse.statements[0].range.start.line).toBe(1);
      expect(parse.statements[0].range.start.character).toBe(0);
      expect(parse.statements[0].range.end.character).toBe(11);

      expect(parse.statements[1].type).toBe(MalloySQLStatementType.SQL);
      expect(parse.statements[1].text).toBe('SELECT 1 FROM %{ malloy-here }%;');
      expect(parse.statements[1].config?.connection).toBe('bigquery');
      expect(parse.statements[1].index).toBe(1);
      expect(parse.statements[1].range.start.line).toBe(3);
      expect(parse.statements[1].range.start.character).toBe(0);
      expect(parse.statements[1].range.end.character).toBe(32);

      const embeddedMalloy = (parse.statements[1] as MalloySQLSQLStatement)
        .embeddedMalloyQueries;
      expect(embeddedMalloy).toHaveLength(1);
      expect(embeddedMalloy[0].parenthesized).toBeFalsy();
      expect(embeddedMalloy[0].query).toBe(' malloy-here ');
      expect(embeddedMalloy[0].text).toBe('%{ malloy-here }%');
      expect(embeddedMalloy[0].range.start.line).toBe(3);
      expect(embeddedMalloy[0].range.start.character).toBe(14);

      expect(parse.statements[2].type).toBe(MalloySQLStatementType.MARKDOWN);
      expect(parse.statements[2].text).toBe('# Hello Malloy');
      expect(parse.statements[2].index).toBe(2);
      expect(parse.statements[2].range.start.line).toBe(5);
      expect(parse.statements[2].range.start.character).toBe(0);
      expect(parse.statements[2].range.end.character).toBe(14);

      expect(parse.statements[3].type).toBe(MalloySQLStatementType.MALLOY);
      expect(parse.statements[3].text).toBe('import "airports.malloy"');
      expect(parse.statements[3].index).toBe(3);
      expect(parse.statements[3].range.start.line).toBe(7);
      expect(parse.statements[3].range.start.character).toBe(0);
      expect(parse.statements[3].range.end.character).toBe(24);
    });

    test('Should provide correct output for embedded >>>', () => {
      const parse = MalloySQLParser.parse(`\
>>>sql connection:bigquery
SELECT 1
>>>markdown
# >>> I'm not a delimiter`);
      expect(parse.statements).toHaveLength(2);

      expect(parse.statements[0].type).toBe(MalloySQLStatementType.SQL);
      expect(parse.statements[0].text).toBe('SELECT 1');
      expect(parse.statements[0].config?.connection).toBe('bigquery');
      expect(parse.statements[0].index).toBe(0);
      expect(parse.statements[0].range.start.line).toBe(1);
      expect(parse.statements[0].range.start.character).toBe(0);
      expect(parse.statements[0].range.end.character).toBe(8);

      expect(parse.statements[1].type).toBe(MalloySQLStatementType.MARKDOWN);
      expect(parse.statements[1].text).toBe(`# >>> I'm not a delimiter`);
      expect(parse.statements[1].index).toBe(1);
      expect(parse.statements[1].range.start.line).toBe(3);
      expect(parse.statements[1].range.start.character).toBe(0);
      expect(parse.statements[1].range.end.character).toBe(25);
    });

    test('Should provide correct output for cells that contain only comments', () => {
      const parse = MalloySQLParser.parse(`\
>>>sql connection:bigquery
-- Nothing to see here, move along
>>>markdown
# I'm my own cell`);
      expect(parse.statements).toHaveLength(2);

      expect(parse.statements[0].type).toBe(MalloySQLStatementType.SQL);
      expect(parse.statements[0].text).toBe(
        '-- Nothing to see here, move along'
      );
      expect(parse.statements[0].config?.connection).toBe('bigquery');
      expect(parse.statements[0].index).toBe(0);
      expect(parse.statements[0].range.start.line).toBe(1);
      expect(parse.statements[0].range.start.character).toBe(0);
      expect(parse.statements[0].range.end.character).toBe(34);

      expect(parse.statements[1].type).toBe(MalloySQLStatementType.MARKDOWN);
      expect(parse.statements[1].text).toBe(`# I'm my own cell`);
      expect(parse.statements[1].index).toBe(1);
      expect(parse.statements[1].range.start.line).toBe(3);
      expect(parse.statements[1].range.start.character).toBe(0);
      expect(parse.statements[1].range.end.character).toBe(17);
    });
  });
});
