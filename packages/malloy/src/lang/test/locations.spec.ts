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

import {
  TestTranslator,
  errorMessage,
  getExplore,
  getFieldDef,
  getJoinField,
  getModelQuery,
  getQueryField,
  getQueryFieldDef,
  getSelectOneStruct,
  markSource,
  model,
} from './test-translator';
import './parse-expects';
import type {
  DocumentLocation,
  DocumentPosition,
} from '../../model/malloy_types';

describe('source locations', () => {
  test('renamed source location', () => {
    const source = markSource`source: ${'na is a'}`;
    const m = new TestTranslator(source.code);
    expect(m).toParse();
    expect(getExplore(m.modelDef, 'na').location).toMatchObject(
      source.locations[0]
    );
  });

  test('refined source location', () => {
    const source = markSource`source: ${'na is a extend {}'}`;
    const m = new TestTranslator(source.code);
    expect(m).toParse();
    expect(getExplore(m.modelDef, 'na').location).toMatchObject(
      source.locations[0]
    );
  });

  // TODO make parameters have locations, and make references to them work
  // with existing jump-to-definition system
  test.todo('location of parameter');

  test('location of defined dimension', () => {
    const source = markSource`source: na is a extend { dimension: ${'x is 1'} }`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getFieldDef(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of defined measure', () => {
    const source = markSource`source: na is a extend { measure: ${'x is count()'} }`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getFieldDef(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of defined view', () => {
    const source = markSource`source: na is a extend { view: ${'x is { group_by: y is 1 }'} }`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getFieldDef(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of defined field inside a view', () => {
    const source = markSource`
      source: na is a extend {
        view: x is {
          group_by: ${'y is 1'}
        }
      }`;

    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getQueryField(na, 'x');
    const y = getQueryFieldDef(x.pipeline[0], 'y');
    // mtoy todo ask chris if there should be locations
    if (y.type !== 'fieldref') {
      expect(y.location).toMatchObject(source.locations[0]);
    }
  });

  test('location of filtered field inside a view', () => {
    const source = markSource`
      source: na is a extend {
        measure: y is count()
        view: x is {
          aggregate: ${'z is y { where: true }'}
        }
      }`;

    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getQueryField(na, 'x');
    const z = getQueryFieldDef(x.pipeline[0], 'z');
    if (z.type !== 'fieldref') {
      expect(z.location).toMatchObject(source.locations[0]);
    }
  });

  test('location of field inherited from table', () => {
    const source = markSource`source: na is ${"_db_.table('aTable')"}`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const abool = getFieldDef(na, 'abool');
    expect(abool.location).toMatchObject(source.locations[0]);
  });

  test('location of field inherited from sql source', () => {
    const source = markSource`
      source: na is conn.sql(${'"""SELECT 1 as one """'})
    `;
    const m = new TestTranslator(source.code);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: getSelectOneStruct(compileSql),
      });
      expect(m).toTranslate();
      const na = getExplore(m.modelDef, 'na');
      const one = getFieldDef(na, 'one');
      expect(one.location).isLocationIn(source.locations[0], source.code);
    }
  });

  test('location of fields inherited from a query', () => {
    const source = markSource`
      source: na is ${"_db_.table('aTable')"} -> {
        group_by:
          abool
          ${'y is 1'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const abool = getFieldDef(na, 'abool');
    expect(abool.location).toMatchObject(source.locations[0]);
    const y = getFieldDef(na, 'y');
    expect(y.location).toMatchObject(source.locations[1]);
  });

  test('location of named query', () => {
    const source = markSource`query: ${'q is a -> { select: * }'}`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const q = getExplore(m.modelDef, 'q');
    expect(q.location).toMatchObject(source.locations[0]);
  });

  test('location of field in named query', () => {
    const source = markSource`query: q is a -> { group_by: ${'b is 1'} }`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const q = getModelQuery(m.modelDef, 'q');
    const a = getQueryFieldDef(q.pipeline[0], 'b');
    if (a.type !== 'fieldref') {
      expect(a.location).toMatchObject(source.locations[0]);
    }
  });

  test('location of renamed field', () => {
    const source = markSource`
      source: na is a extend {
        rename: ${'bbool is abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const bbool = getFieldDef(na, 'bbool');
    expect(bbool.location).toMatchObject(source.locations[0]);
  });

  test('location of join on', () => {
    const source = markSource`
      source: na is a extend {
        join_one: ${'x is a extend { primary_key: abool } on abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getFieldDef(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of join with', () => {
    const source = markSource`
      source: na is a extend {
        join_one: ${'x is a extend { primary_key: astr } with astr'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getFieldDef(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of field in join', () => {
    const source = markSource`
      source: na is a extend {
        join_one: x is a extend {
          primary_key: abool
          dimension: ${'y is 1'}
        } on abool
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getJoinField(na, 'x');
    const y = getFieldDef(x, 'y');
    expect(y.location).toMatchObject(source.locations[0]);
  });

  test('undefined query location', () => {
    expect(model`run: ${'xyz'}`).toLog(
      errorMessage("Reference to undefined object 'xyz'")
    );
  });
  test('undefined field reference', () => {
    expect(model`run: a -> { group_by: ${'xyz'} }`).toLog(
      errorMessage("'xyz' is not defined")
    );
  });
  test('bad query', () => {
    expect(model`run: a -> { group_by: astr; ${'select: *'} }`).toLog(
      errorMessage(/Not legal in grouping query/)
    );
  });

  test.skip('undefined field reference in top', () => {
    expect(model`run: a -> { group_by: one is 1; top: 1 by ${'xyz'} }`).toLog(
      errorMessage("'xyz' is not defined")
    );
  });

  test.skip('undefined field reference in order_by', () => {
    expect(model`run: a -> { group_by: one is 1; order_by: ${'xyz'} }`).toLog(
      errorMessage("'xyz' is not defined")
    );
  });
});

describe('source references', () => {
  test('reference to explore', () => {
    const source = markSource`
      source: ${'na is a'}
      run: ${'na'} -> { select: * }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'exploreReference',
      text: 'na',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to query in query', () => {
    const source = markSource`
      source: t is a extend {
        view: ${'q is { select: * }'}
      }
      run: t -> ${'q'}
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'q',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to query in query (version 2)', () => {
    const source = markSource`
      source: na is a extend { view: ${'x is { group_by: y is 1 }'} }
      run: na -> ${'x'}
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'x',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to query', () => {
    const source = model`
      query: ${'q is a -> { select: * }'}
      source: na is ${'q'}
    `;
    expect(source).toTranslate();
    const mt = source.translator;
    expect(mt.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'queryReference',
      text: 'q',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to query in query head', () => {
    const source = markSource`
      query: ${'q is a -> { select: * }'}
      query: q2 is ${'q'} -> { select: * }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'queryReference',
      text: 'q',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to query in refined query', () => {
    const source = markSource`
      query: ${'q is a -> { select: * }'}
      query: q2 is ${'q'} + { limit: 10 }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'queryReference',
      text: 'q',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in expression', () => {
    const source = markSource`
      source: na is ${"_db_.table('aTable')"}
      run: na -> { select: bbool is not ${'abool'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to quoted field in expression', () => {
    const source = markSource`
      source: na is a extend {
        dimension: ${"`name` is 'name'"}
      }
      run: na -> { select: ${'`name`'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'name',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to joined field in expression', () => {
    const source = markSource`
      source: na is a extend {
        join_one: self is ${"_db_.table('aTable')"}
          on astr = self.astr
      }
      run: na -> { select: bstr is self.${'astr'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'astr',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to joined join in expression', () => {
    const source = markSource`
      source: na is a extend {
        join_one: ${'self is a on astr = self.astr'}
      }
      run: na -> { select: bstr is ${'self'}.astr }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'joinReference',
      text: 'self',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field not in expression (group by)', () => {
    const source = markSource`
      run: ${"_db_.table('aTable')"} -> { group_by: ${'abool'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field not in expression (project)', () => {
    const source = markSource`
      source: na is ${"_db_.table('aTable')"}
      run: na -> { select: ${'abool'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip('reference to field in order by', () => {
    const source = markSource`
      run: ${"_db_.table('aTable')"} -> {
        group_by: abool
        order_by: ${'abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip('reference to field in order by (output space)', () => {
    const source = markSource`
      run: a -> {
        group_by: ${'one is 1'}
        order_by: ${'one'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in aggregate', () => {
    const source = markSource`
      run: a extend { measure: ${'c is count()'} } -> {
        group_by: abool
        aggregate: ${'c'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'c',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in measure', () => {
    const source = markSource`
      source: e is a extend {
        measure: ${'c is count()'}
        measure: c2 is ${'c'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'c',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip('reference to field in top', () => {
    const source = markSource`
      run: ${"_db_.table('aTable')"} -> {
        group_by: abool
        top: 10 by ${'abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip('reference to field in top (output space)', () => {
    const source = markSource`
      run: a -> {
        group_by: ${'one is 1'}
        top: 10 by ${'one'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in filter', () => {
    const source = markSource`
      run: ${"_db_.table('aTable')"} -> {
        group_by: abool
        where: ${'abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in aggregate source', () => {
    const source = markSource`
      source: na is ${"_db_.table('aTable')"}
      run: na -> { aggregate: ai_sum is ${'ai'}.sum() }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'ai',
      definition: {
        location: source.locations[0],
      },
    });
  });

  function pos(location: DocumentLocation): DocumentPosition {
    return location.range.start;
  }

  test('reference to join in aggregate source', () => {
    const source = markSource`
      source: na is a extend {
        join_one: ${'self is a on astr = self.astr'}
      }
      run: na -> { aggregate: ai_sum is ${'self'}.sum(self.ai) }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'joinReference',
      text: 'self',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to join in aggregate in expr', () => {
    const source = markSource`
      source: na is a extend {
        join_one: ${'self is a on astr = self.astr'}
      }
      run: na -> { aggregate: ai_sum is self.sum(${'self'}.ai) }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'joinReference',
      text: 'self',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to sourcein join', () => {
    const source = markSource`
      source: ${'exp1 is a'}
      source: exp2 is a extend {
        join_one: ${'exp1'} on astr = exp1.astr
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'exploreReference',
      text: 'exp1',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in aggregate (in expr)', () => {
    const source = markSource`
      source: na is ${"_db_.table('aTable')"}
      run: na -> { aggregate: ai_sum is sum(${'ai'}) }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'ai',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in rename', () => {
    const source = markSource`
      source: na is ${"_db_.table('aTable')"} extend {
        rename: bbool is ${'abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in join with', () => {
    const source = markSource`
      source: exp2 is ${"_db_.table('aTable')"} extend {
        join_one: exp1 is a with ${'astr'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'astr',
      definition: {
        location: source.locations[0],
      },
    });
  });
});
