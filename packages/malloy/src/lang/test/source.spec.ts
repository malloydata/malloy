/* eslint-disable no-console */
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

import {model, TestTranslator, markSource} from './test-translator';
import './parse-expects';

describe('source:', () => {
  test('table', () => {
    expect("source: testA is table('aTable')").toTranslate();
  });
  test('shorcut fitlered table', () => {
    expect("source: xA is table('aTable') {? astr ~ 'a%' }").toTranslate();
  });
  test('shorcut fitlered table m4warning', () => {
    expect(`
      ##! m4warnings
      source: xA is conn.table('aTable') extend {? astr ~ 'a%' }
    `).toTranslateWithWarnings(
      'Filter shortcut `{? condition }` is deprecated; use `{ where: condition } instead'
    );
  });
  test('fitlered table', () => {
    expect(
      "source: testA is table('aTable') { where: astr ~ 'a%' }"
    ).toTranslate();
  });
  test('ref source with no refinement', () => {
    expect('source: testA is a').toTranslate();
  });
  test('from(query)', () => {
    expect('source: testA is from(a->{group_by: astr})').toTranslate();
  });
  test('refine source', () => {
    expect('source: aa is a { dimension: a is astr }').toTranslate();
  });
  test('source refinement preserves original', () => {
    const x = new TestTranslator('source: na is a + { dimension: one is 1 }');
    expect(x).toTranslate();
    const a = x.getSourceDef('a');
    if (a) {
      const aFields = a.fields.map(f => f.as || f.name);
      expect(aFields).toContain('astr');
      expect(aFields).not.toContain('one');
    }
  });

  describe('source properties', () => {
    test('single dimension', () => {
      expect('source: aa is a { dimension: x is 1 }').toTranslate();
    });
    test('multiple dimensions', () => {
      expect(`
        source: aa is a {
          dimension:
            x is 1
            y is 2
        }
      `).toTranslate();
    });
    test('single declare', () => {
      expect('source: aa is a { declare: x is 1 }').toTranslate();
    });
    test('multiple declare', () => {
      expect(`
        source: aa is a {
          declare:
            x is 1
            y is 2
        }
      `).toTranslate();
    });
    test('single measure', () => {
      expect('source: aa is a { measure: x is count() }').toTranslate();
    });
    test('multiple measures', () => {
      expect(`
        source: aa is a {
          measure:
            x is count()
            y is x * x
        }
      `).toTranslate();
    });
    test('single where', () => {
      expect('source: aa is a { where: ai > 10 }').toTranslate();
    });
    test('multiple where', () => {
      expect(`
        source: aa is a {
          where:
            ai > 10,
            af < 1000
        }
      `).toTranslate();
    });
    test('where clause can use the join namespace in source refined query', () => {
      expect(`
      source: flights is table('malloytest.flights') + {
        query: boo is {
          join_one: carriers is table('malloytest.carriers') on carrier = carriers.code
          where: carriers.code = 'WN' | 'AA'
          group_by: carriers.nickname
          aggregate: flight_count is count()
        }
      }`).toTranslate();
    });
    describe('joins', () => {
      test('with', () => {
        expect('source: x is a { join_one: b with astr }').toTranslate();
      });
      test('with', () => {
        expect(
          model`source: x is a { join_one: y is b with astr }`
        ).toTranslate();
      });
      test('with dotted ref', () => {
        expect(
          model`source: x is ab { join_one: xz is a with b.astr }`
        ).toTranslate();
      });
      test('one on', () => {
        expect(
          model`source: x is a { join_one: b on astr = b.astr }`
        ).toTranslate();
      });
      test('one is on', () => {
        expect(
          'source: x is a { join_one: y is b on astr = y.astr }'
        ).toTranslate();
      });
      test('many on', () => {
        expect(
          'source: nab is a { join_many: b on astr = b.astr }'
        ).toTranslate();
      });
      test('many is on', () => {
        expect(
          'source: y is a { join_many: x is b on astr = x.astr }'
        ).toTranslate();
      });
      test('cross', () => {
        expect('source: nab is a { join_cross: b }').toTranslate();
      });
      test('cross is', () => {
        expect('source: nab is a { join_cross: xb is b }').toTranslate();
      });
      test('cross on', () => {
        expect('source: nab is a { join_cross: b on true}').toTranslate();
      });
      test('multiple joins', () => {
        expect(`
          source: nab is a {
            join_one:
              b with astr,
              br is b with astr
          }
        `).toTranslate();
      });
      test('with requires primary key', () => {
        expect(
          markSource`
            source: nb is b {
              join_one: ${"bb is table('aTable') with astr"}
            }
          `
        ).translationToFailWith(
          'join_one: Cannot use with unless source has a primary key'
        );
      });
    });
    test('primary_key', () => {
      expect('source: c is a { primary_key: ai }').toTranslate();
    });
    test('rename', () => {
      expect('source: c is a { rename: nn is ai }').toTranslate();
    });
    test('accept single', () => {
      const onlyAstr = new TestTranslator('source: c is a { accept: astr }');
      expect(onlyAstr).toTranslate();
      const c = onlyAstr.getSourceDef('c');
      if (c) {
        expect(c.fields.length).toBe(1);
      }
    });
    test('accept multi', () => {
      expect('source: c is a { accept: astr, af }').toTranslate();
    });
    test('except single', () => {
      const noAstr = new TestTranslator('source: c is a { except: astr }');
      expect(noAstr).toTranslate();
      const c = noAstr.getSourceDef('c');
      if (c) {
        const foundAstr = c.fields.find(f => f.name === 'astr');
        expect(foundAstr).toBeUndefined();
      }
    });
    test('except multi', () => {
      expect('source: c is a { except: astr, af }').toTranslate();
    });
    test('turtle in a source can be called view', () => {
      expect('source: c is a {view: q is { group_by: astr } }').toTranslate();
    });
    test('turtle in source can be called query', () => {
      expect('source: c is a {query: q is { group_by: astr } }').toTranslate();
    });
    test('refined explore-query', () => {
      expect(`
        source: abNew is ab {
          query: for1 is aturtle {? ai = 1 }
        }
      `).toTranslate();
    });
    test('refined explore-query m4warning', () => {
      expect(`
        ##! m4warnings
        source: abNew is ab extend {
          query: for1 is aturtle refine {? ai = 1 }
        }
      `).toTranslateWithWarnings(
        'Filter shortcut `{? condition }` is deprecated; use `{ where: condition } instead'
      );
    });
    test('chained explore-query', () => {
      expect(`
        source: c is a {
          query: chain is {
            group_by: astr
          } -> {
            top: 10; order_by: astr
            project: *
          }
        }
      `).toTranslate();
    });
    test('multiple explore-query', () => {
      expect(`
        source: abNew is ab {
          query:
            q1 is { group_by: astr },
            q2 is { group_by: ai }
        }
      `).toTranslate();
    });
  });
});
