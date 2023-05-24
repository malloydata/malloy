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
    if (parse.error) {
      return {
        message: () => `unexpected parse error: ${parse.error?.message}`,
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
      MalloySQLParser.parse(
        `>>>sql connection:y\nSELECT 1 FROM %{ malloy }% /*test*/`
      );
      MalloySQLParser.parse(`>>>malloy \nquery -> source -> banana/*test*/`);
    });

    test('Should parse statements', () => {
      MalloySQLParser.parse(
        `>>>sql connection:x\nSELECT 1 FROM %{ malloy }% /*test*/\n>>>malloy\n>>>sql`
      );
      expect(
        MalloySQLParser.parse(
          `>>>malloy\nquery -> source -> banana/*test*/\n\r>>>sql connection:x\nSELECT 1 >>>malloy\n\n`
        ).error
      ).toBeFalsy();
    });
  });

  describe('connection: config', () => {
    test('Should not allow config in >>>malloy line', () => {
      expect(MalloySQLParser.parse(`>>>malloy connection`).error).toBeTruthy();
    });
  });
});
