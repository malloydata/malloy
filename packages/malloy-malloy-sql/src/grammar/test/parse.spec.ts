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

describe('MalloySQL parse', () => {
  const getParser = () => {
    return new MalloySQLParser();
  };

  describe('Should parse inital comments', () => {
    test('initial single-line forward-slash comment', () => {
      ['//hello', '  //hello', '//hello\n', '\n //hello\n'].forEach(x =>
        getParser().parse(x)
      );
    });

    test('initial single-line double-dash comment', () => {
      ['--hello', '  --hello', '--hello\n', '\n --hello\n'].forEach(x =>
        getParser().parse(x)
      );
    });

    test('initial multi-line comment', () => {
      ['/* hi */', ' /* hi */ ', '/* hi */\n', '\n /* hi */\n'].forEach(x =>
        getParser().parse(x)
      );
    });

    test('initial comments mixed', () => {
      getParser().parse('\n   //hey -- hey \n\t --hay\n/* hi */');
    });
  });

  describe('Should parse control statement', () => {
    test('Should parse immediate delimiter', () => {
      [
        '>>>sql',
        '>>>malloy',
        '>>>sql a',
        '>>>sql a\n',
        '>>>sql a  //x\n\n',
        '>>>sql {"x":"y"} // test',
      ].forEach(x => getParser().parse(x));
    });

    test('Should parse initial comments and delimiter', () => {
      [
        '// hey\n>>>sql',
        '/* test */\n\n\n>>>malloy',
        '--info\t>>>sql a',
      ].forEach(x => getParser().parse(x));
    });

    test('Should parse multiple empty control statements', () => {
      [
        '// hey\n>>>sql\n>>>sql\n>>>malloy\n\n',
        '// hey\n>>>sql {xyz}  \n>>>sql\n>>>malloy\n\n',
        '\n>>>sql {xyz}  \n   /* test */\n\n>>>sql\n--hey\n>>>malloy\n\n',
      ].forEach(x => getParser().parse(x));
    });
  });

  describe('Should parse statement', () => {
    test('Should parse statement with comments', () => {
      getParser().parse(`>>>sql\nSELECT 1 FROM %{ malloy }% /*test*/`);
      getParser().parse(`>>>malloy\nquery -> source -> banana/*test*/`);
    });
  });
});
