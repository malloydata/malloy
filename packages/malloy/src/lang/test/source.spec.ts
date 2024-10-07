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

import {
  model,
  TestTranslator,
  markSource,
  errorMessage,
  warningMessage,
} from './test-translator';
import './parse-expects';

describe('source:', () => {
  test('table', () => {
    expect("source: testA is _db_.table('aTable')").toTranslate();
  });
  test('shorcut fitlered table', () => {
    expect(
      "source: xA is _db_.table('aTable') extend { where: astr ~ 'a%' }"
    ).toTranslate();
  });
  test('shorcut fitlered table m4warning', () => {
    expect(`
      ##! m4warnings=warn
      source: xA is _db_.table('aTable') extend {? astr ~ 'a%' }
    `).toLog(
      warningMessage(
        'Filter shortcut `{? condition }` is deprecated; use `{ where: condition } instead'
      )
    );
  });
  test('fitlered table', () => {
    expect(
      "source: testA is _db_.table('aTable') extend { where: astr ~ 'a%' }"
    ).toTranslate();
  });
  test('ref source with no refinement', () => {
    expect('source: testA is a').toTranslate();
  });
  test('source from query', () => {
    expect('source: testA is a->{group_by: astr}').toTranslate();
  });
  test('refine source', () => {
    expect('source: aa is a extend { dimension: a is astr }').toTranslate();
  });
  test('source refinement preserves original', () => {
    const x = new TestTranslator(
      'source: na is a extend { dimension: one is 1 }'
    );
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
      expect('source: aa is a extend { dimension: x is 1 }').toTranslate();
    });
    test('field def with null value', () => {
      expect(
        markSource`source: aa is a extend { dimension: x is ${'null'} }`
      ).toLog(
        warningMessage(
          'null value defaults to type number, use "null::TYPE" to specify correct type'
        )
      );
    });
    test('multiple dimensions', () => {
      expect(`
        source: aa is a extend {
          dimension:
            x is 1
            y is 2
        }
      `).toTranslate();
    });
    test('single declare ok b4 m4', () => {
      expect(
        '##! -m4warnings\nsource: aa is a extend { declare: x is 1 }'
      ).toTranslate();
    });
    test('multiple declare ok b4 m4', () => {
      expect(`
        ##! -m4warnings
        source: aa is a extend {
          declare:
            x is 1
            y is 2
        }
      `).toTranslate();
    });
    test('single measure', () => {
      expect('source: aa is a extend { measure: x is count() }').toTranslate();
    });
    test('multiple measures', () => {
      expect(`
        source: aa is a extend {
          measure:
            x is count()
            y is x * x
        }
      `).toTranslate();
    });
    test('single where', () => {
      expect('source: aa is a extend { where: ai > 10 }').toTranslate();
    });
    test('multiple where', () => {
      expect(`
        source: aa is a extend {
          where:
            ai > 10,
            af < 1000
        }
      `).toTranslate();
    });
    test('where clause can use the join namespace in source refined query', () => {
      expect(`
      source: flights is _db_.table('malloytest.flights') extend {
        view: boo is {
          extend: { join_one: carriers is _db_.table('malloytest.carriers') on carrier = carriers.code }
          where: carriers.code = 'WN' | 'AA'
          group_by: carriers.nickname
          aggregate: flight_count is count()
        }
      }`).toTranslate();
    });
    describe('joins', () => {
      test('with', () => {
        expect('source: x is a extend { join_one: b with astr }').toTranslate();
      });
      test('with', () => {
        expect(
          model`source: x is a extend { join_one: y is b with astr }`
        ).toTranslate();
      });
      test('with dotted ref', () => {
        expect(
          model`source: x is ab extend { join_one: xz is a with b.astr }`
        ).toTranslate();
      });
      test('one on', () => {
        expect(
          model`source: x is a extend { join_one: b on astr = b.astr }`
        ).toTranslate();
      });
      test('one is on', () => {
        expect(
          'source: x is a extend { join_one: y is b on astr = y.astr }'
        ).toTranslate();
      });
      test('many on', () => {
        expect(
          'source: nab is a extend { join_many: b on astr = b.astr }'
        ).toTranslate();
      });
      test('many with', () => {
        expect(
          model`source: nab is a extend { ${'join_many: b with astr'} }`
        ).toLog(errorMessage('Foreign key join not legal in join_many:'));
      });
      test('many is on', () => {
        expect(
          'source: y is a extend { join_many: x is b on astr = x.astr }'
        ).toTranslate();
      });
      test('cross', () => {
        expect('source: nab is a extend { join_cross: b }').toTranslate();
      });
      test('cross is', () => {
        expect('source: nab is a extend { join_cross: xb is b }').toTranslate();
      });
      test('cross on', () => {
        expect(
          'source: nab is a extend { join_cross: b on true}'
        ).toTranslate();
      });
      test('multiple joins', () => {
        expect(`
          source: nab is a extend {
            join_one:
              b with astr,
              br is b with astr
          }
        `).toTranslate();
      });
      test('with requires primary key', () => {
        expect(
          markSource`
            source: nb is b extend {
              join_one: ${'bb is _db_.table("aTable") with astr'}
            }
          `
        ).toLog(
          errorMessage(
            'join_one: Cannot use with unless source has a primary key'
          )
        );
      });
      test('can join a query without a rename', () => {
        expect(`
          query: aq is a -> {select: *}
          source: aqs is a extend {
            join_one: aq on ai = aq.ai
          }
        `).toTranslate();
      });
      test('can with join a single column query', () => {
        expect(`
          source: awith is a extend {
            join_one: has_primary_key is a -> { group_by: one_val is astr } with astr
          }
        `).toTranslate();
      });
    });
    test('primary_key', () => {
      expect('source: c is a extend { primary_key: ai }').toTranslate();
    });
    test('rename', () => {
      expect('source: c is a extend { rename: nn is ai }').toTranslate();
    });
    test('accept single', () => {
      const onlyAstr = new TestTranslator(
        'source: c is a extend { accept: astr }'
      );
      expect(onlyAstr).toTranslate();
      const c = onlyAstr.getSourceDef('c');
      if (c) {
        expect(c.fields.length).toBe(1);
      }
    });
    test('accept multi', () => {
      expect('source: c is a extend { accept: astr, af }').toTranslate();
    });
    test('except single', () => {
      const noAstr = new TestTranslator(
        'source: c is a extend { except: astr }'
      );
      expect(noAstr).toTranslate();
      const c = noAstr.getSourceDef('c');
      if (c) {
        const foundAstr = c.fields.find(f => f.name === 'astr');
        expect(foundAstr).toBeUndefined();
      }
    });
    test('except multi', () => {
      expect('source: c is a extend { except: astr, af }').toTranslate();
    });
    test('turtle in a source can be called view', () => {
      expect(
        'source: c is a extend {view: q is { group_by: astr } }'
      ).toTranslate();
    });
    test('turtle in source can be called query with m4 warning', () => {
      expect(
        `##! m4warnings=warn
          source: c is a extend {query: q is { group_by: astr } }
        `
      ).toLog(warningMessage('Use view: inside of a source instead of query:'));
    });
    test('refined explore-query', () => {
      expect(`
        source: abNew is ab extend {
          view: for1 is aturtle + { where: ai = 1 }
        }
      `).toTranslate();
    });
    test('refined explore-query m4warning', () => {
      expect(`
        ##! m4warnings=warn
        source: abNew is ab extend {
          view: for1 is aturtle + {? ai = 1 }
        }
      `).toLog(
        warningMessage(
          'Filter shortcut `{? condition }` is deprecated; use `{ where: condition } instead'
        )
      );
    });
    test('chained explore-query', () => {
      expect(`
        source: c is a extend {
          view: chain is {
            group_by: astr
          } -> {
            top: 10; order_by: astr
            select: *
          }
        }
      `).toTranslate();
    });
    test('chained explore-query with refinement two steps', () => {
      expect(`
        source: c is a extend {
          view: base is {
            group_by: astr
          } + {
            group_by: ai
          }
          view: chain2 is base -> {
            top: 10; order_by: astr
            select: *
          }
        }
      `).toTranslate();
    });
    test('pipelined explore-query with refinement', () => {
      expect(`
        source: c is a extend {
          view: base is {
            group_by: astr
          }
          view: chain is base + {
            group_by: ai
          } -> {
            top: 10; order_by: astr
            select: *
          }
        }
      `).toTranslate();
    });
    test('pipelined explore-query with view chain', () => {
      expect(`
        source: c is a extend {
          view: chain is {
            group_by: astr
          } + {
            group_by: ai
          } -> {
            top: 10; order_by: astr
            select: *
          }
        }
      `).toTranslate();
    });
    test('multiple explore-query', () => {
      expect(`
        source: abNew is ab extend {
          view:
            q1 is { group_by: astr },
            q2 is { group_by: ai }
        }
      `).toTranslate();
    });
  });
});
