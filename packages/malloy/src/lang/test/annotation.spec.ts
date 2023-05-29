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

import {Annotation} from '../ast';

interface AnAnnotation {
  inherits?: AnAnnotation;
  mine: string[];
}

const turtleA: AnAnnotation = {
  mine: ['#turtleNote'],
};

const queryA: AnAnnotation = {
  inherits: turtleA,
  mine: ['#queryNote'],
};

const runStmt: AnAnnotation = {
  inherits: queryA,
  mine: ['#runNote'],
};

// eslint-disable-next-line no-console
console.log(runStmt);

describe('annotation parsing', () => {
  test('doc annotations', () => {
    const a = Annotation.make('#" This is a doc string');
    expect(a).toBeDefined();
    if (a) {
      expect(a.annote).toMatchObject({docString: 'This is a doc string'});
    }
  });
  test('simple property', () => {
    const a = Annotation.make('# linechart');
    expect(a).toBeDefined();
    if (a) {
      expect(a.annote).toMatchObject({properties: {linechart: true}});
    }
  });
  test('simple quoted property', () => {
    const a = Annotation.make('# "linechart"');
    expect(a).toBeDefined();
    if (a) {
      expect(a.annote).toMatchObject({properties: {linechart: true}});
    }
  });
  test('quoted property with " and space', () => {
    const annotation = '# "a \\"chart\\""';
    const a = Annotation.make(annotation);
    expect(a).toBeDefined();
    if (a) {
      expect(a.annote).toMatchObject({properties: {'a \\"chart\\"': true}});
    }
  });
  test('quoted property with value', () => {
    const a = Annotation.make('# "linechart"=yes');
    expect(a).toBeDefined();
    if (a) {
      expect(a.annote).toMatchObject({properties: {linechart: 'yes'}});
    }
  });
  test('property with simple value', () => {
    const a = Annotation.make('# chart=line');
    expect(a).toBeDefined();
    if (a) {
      expect(a.annote).toMatchObject({properties: {chart: 'line'}});
    }
  });
  test('property with quoted value', () => {
    const a = Annotation.make('# chart="line"');
    expect(a).toBeDefined();
    if (a) {
      expect(a.annote).toMatchObject({properties: {chart: 'line'}});
    }
  });
  test('spaces ignored', () => {
    const a = Annotation.make('#     chart =  line ');
    expect(a).toBeDefined();
    if (a) {
      expect(a.annote).toMatchObject({properties: {chart: 'line'}});
    }
  });
  test('= with no value', () => {
    expect(Annotation.make('# name =  ')).toBeUndefined();
  });
  test('multiple = with no value', () => {
    expect(Annotation.make('# name =  = me')).toBeUndefined();
  });
  test('missing quote', () => {
    expect(Annotation.make('# name =  "no quote')).toBeUndefined();
  });
  test('leading =', () => {
    expect(Annotation.make('#  =name  ')).toBeUndefined();
  });
  test('complex line', () => {
    const a = Annotation.make('# a b=c "d"=e f="g" "h"="i" "j"');
    expect(a).toBeDefined();
    if (a) {
      expect(a.annote).toMatchObject({
        properties: {
          a: true,
          b: 'c',
          d: 'e',
          f: 'g',
          h: 'i',
          j: true,
        },
      });
    }
  });
});
