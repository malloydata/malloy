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

import {MarkedSource, TestTranslator, markSource} from './test-translator';
import {DocumentSymbol} from '../parse-tree-walkers/document-symbol-walker';

class MalloyExplore extends TestTranslator {
  constructor(src: string) {
    super(src);
  }

  get symbols(): DocumentSymbol[] {
    const md = this.metadata();
    return md.symbols || [];
  }
}

function testSymbol(
  source: MarkedSource,
  name: string,
  type: string,
  path: number[]
) {
  const doc = new MalloyExplore(source.code);
  let current = {children: doc.symbols};
  path.forEach(segment => {
    current = current.children[segment];
  });
  expect(doc.logger.hasErrors()).toBeFalsy();
  expect(current).toMatchObject({
    name,
    range: source.locations[0].range,
    type,
  });
}

test('explore symbols are included', () => {
  testSymbol(
    markSource`source: ${"flights is table('my.table.flights')"}`,
    'flights',
    'explore',
    [0]
  );
});

test('query symbols are included', () => {
  testSymbol(
    markSource`query: ${'flights_by_carrier is flights -> by_carrier'}`,
    'flights_by_carrier',
    'query',
    [0]
  );
});

test('expression field defs are included', () => {
  testSymbol(
    markSource`
      source: flights is table('my.table.flights') {
        dimension: ${'one is 1'}
      }
    `,
    'one',
    'field',
    [0, 0]
  );
});

test('renamed fields are included', () => {
  testSymbol(
    markSource`
      source: flights is table('my.table.flights') {
        rename: ${'field_two is field_2'}
      }
    `,
    'field_two',
    'field',
    [0, 0]
  );
});

test('name only fields are included', () => {
  testSymbol(
    markSource`
      source: flights is table('my.table.flights') {
        dimension: ${'field_two is field_2'}
      }
    `,
    'field_two',
    'field',
    [0, 0]
  );
});

test('turtle fields are included', () => {
  testSymbol(
    markSource`
      source: flights is table('my.table.flights') {
        query: ${'my_turtle is { group_by: a }'}
      }
    `,
    'my_turtle',
    'query',
    [0, 0]
  );
});

test('turtle children fields are included', () => {
  testSymbol(
    markSource`
      source: flights is table('my.table.flights') {
        query: my_turtle is { group_by: ${'a'} }
      }
    `,
    'a',
    'field',
    [0, 0, 0]
  );
});

test('turtle children turtles are included', () => {
  testSymbol(
    markSource`
      source: flights is table('my.table.flights') {
        query: my_turtle is { nest: ${'inner_turtle is { group_by: a }'} }
      }
    `,
    'inner_turtle',
    'query',
    [0, 0, 0]
  );
});

test('join withs are included', () => {
  testSymbol(
    markSource`
      source: flights is table('my.table.flights') {
        join_one: ${'a is b with c'}
      }
    `,
    'a',
    'join',
    [0, 0]
  );
});

test('join ons are included', () => {
  testSymbol(
    markSource`
      source: flights is table('my.table.flights') {
        join_one: ${'a is b on c'}
      }
    `,
    'a',
    'join',
    [0, 0]
  );
});
