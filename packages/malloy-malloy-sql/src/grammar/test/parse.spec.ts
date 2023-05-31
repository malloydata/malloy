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
  });

  describe('Embedded Malloy', () => {
    test('Parenthized embedded malloy can handle space between ( and {%', () => {
      const parse = MalloySQLParser.parse(
        '>>>sql connection:bigquery\nSELECT (  %{ malloy }%  )'
      );
      const stmt = parse.statements[0] as MalloySQLSQLStatement;
      const embeddedMalloy = stmt.embeddedMalloyQueries[0];
      expect(embeddedMalloy.query).toBe(' malloy ');
      expect(embeddedMalloy.parenthized).toBeTruthy();
      expect(embeddedMalloy.range.start.character).toBe(8);
      expect(embeddedMalloy.malloyRange.start.character).toBe(13);
    });

    test('Non-parenthized embedded malloy', () => {
      const parse = MalloySQLParser.parse(
        '>>>sql connection:bigquery\nSELECT %{ malloy }%'
      );
      const stmt = parse.statements[0] as MalloySQLSQLStatement;
      const embeddedMalloy = stmt.embeddedMalloyQueries[0];
      expect(embeddedMalloy.query).toBe(' malloy ');
      expect(embeddedMalloy.parenthized).toBeFalsy();
      expect(embeddedMalloy.range.start.character).toBe(8);
      expect(embeddedMalloy.malloyRange.start.character).toBe(10);
    });
  });

  describe('Parse output', () => {
    test('Should provide correct output for single statement', () => {
      const parse = MalloySQLParser.parse(
        '>>>sql connection:bigquery\nSELECT 1'
      );
      expect(parse.statements).toHaveLength(1);
      expect(parse.statements[0].type).toBe(MalloySQLStatementType.SQL);
      expect(parse.statements[0].statementText).toBe('SELECT 1');
      expect(parse.statements[0].config?.connection).toBe('bigquery');
      expect(parse.statements[0].statementIndex).toBe(0);
      expect(parse.statements[0].range.start.line).toBe(1);
      expect(parse.statements[0].range.start.character).toBe(1);
      expect(parse.statements[0].range.end.character).toBe(9);
    });

    test('Should provide correct output for mulitple statements', () => {
      const parse = MalloySQLParser.parse(
        '>>>sql connection:bigquery\nSELECT 1\n>>>malloy\nimport "airports.malloy"'
      );
      expect(parse.statements).toHaveLength(2);
      expect(parse.statements[0].type).toBe(MalloySQLStatementType.SQL);
      expect(parse.statements[0].statementText).toBe('SELECT 1\n');
      expect(parse.statements[0].config?.connection).toBe('bigquery');
      expect(parse.statements[0].statementIndex).toBe(0);
      expect(parse.statements[0].range.start.line).toBe(1);
      expect(parse.statements[0].range.start.character).toBe(1);
      expect(parse.statements[0].range.end.character).toBe(1);

      expect(parse.statements[1].type).toBe(MalloySQLStatementType.MALLOY);
      expect(parse.statements[1].statementText).toBe(
        'import "airports.malloy"'
      );
      expect(parse.statements[1].statementIndex).toBe(1);
      expect(parse.statements[1].range.start.line).toBe(3);
      expect(parse.statements[1].range.start.character).toBe(1);
      expect(parse.statements[1].range.end.character).toBe(25);
    });

    test('Should provide correct output for mulitple statements with embedded malloy', () => {
      const parse = MalloySQLParser.parse(
        '>>>sql connection:bigquery\nSELECT 1 FROM %{ malloy-here }%;\n>>>malloy\nimport "airports.malloy"'
      );
      expect(parse.statements).toHaveLength(2);
      expect(parse.statements[0].type).toBe(MalloySQLStatementType.SQL);
      expect(parse.statements[0].statementText).toBe(
        'SELECT 1 FROM %{ malloy-here }%;\n'
      );
      expect(parse.statements[0].config?.connection).toBe('bigquery');
      expect(parse.statements[0].statementIndex).toBe(0);
      expect(parse.statements[0].range.start.line).toBe(1);
      expect(parse.statements[0].range.start.character).toBe(1);
      expect(parse.statements[0].range.end.character).toBe(1);

      const embeddedMalloy = (parse.statements[0] as MalloySQLSQLStatement)
        .embeddedMalloyQueries;
      expect(embeddedMalloy).toHaveLength(1);
      expect(embeddedMalloy[0].parenthized).toBeFalsy();
      expect(embeddedMalloy[0].query).toBe(' malloy-here ');
      expect(embeddedMalloy[0].range.start.line).toBe(1);
      expect(embeddedMalloy[0].range.start.character).toBe(15);

      expect(parse.statements[1].type).toBe(MalloySQLStatementType.MALLOY);
      expect(parse.statements[1].statementText).toBe(
        'import "airports.malloy"'
      );
      expect(parse.statements[1].statementIndex).toBe(1);
      expect(parse.statements[1].range.start.line).toBe(3);
      expect(parse.statements[1].range.start.character).toBe(1);
      expect(parse.statements[1].range.end.character).toBe(25);
    });
  });
});
