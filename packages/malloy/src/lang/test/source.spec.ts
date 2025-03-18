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
  getFieldDef,
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
    describe('access modifiers and include', () => {
      test('private not accessible in query', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include { *; private: ai }
          run: c -> { select: ${'ai'} }
        `).toLog(errorMessage("'ai' is private"));
      });
      test('internal not accessible in query', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include { *; internal: ai }
          run: c -> { select: ${'ai'} }
        `).toLog(errorMessage("'ai' is internal"));
      });
      test('internal is accessible in source extension', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include { *; internal: ai }
          source: d is c extend {
            dimension: ai2 is ai
          }
        `).toTranslate();
      });
      test('private is inaccessible in source extension', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: *
            private: ai
          }
          source: d is c extend {
            dimension: ai2 is ai
          }
        `).toLog(errorMessage("'ai' is private"));
      });
      test('internal is inaccessible in joining source on', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: *
            internal: ai
          }
          source: d is a extend {
            join_one: c on ai = ${'c.ai'}
          }
        `).toLog(errorMessage("'ai' is internal"));
      });
      test('internal at definition time', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a extend {
            internal dimension: x is 1
          }
          run: c -> x
        `).toLog(errorMessage("'x' is internal"));
      });
      test('internal is inaccessible in joining source field', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: *
            internal: ai
          }
          source: d is a extend {
            join_one: c on true
            dimension: cai is ${'c.ai'}
          }
        `).toLog(errorMessage("'ai' is internal"));
      });
      test('internal is inaccessible in view reference', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a extend {
            view: v is { group_by: ai }
          } include { *; internal: v }
          run: c -> ${'v'}
        `).toLog(errorMessage("'v' is internal"));
      });
      test('private field used in view is accessible outside via view', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a extend {
            view: v is { group_by: ai }
          } include { *; private: ai }
          run: c -> v
        `).toTranslate();
      });
      test('use internal field in query in extension', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            internal: ai
          }
          source: d is c extend {
            view: v is { group_by: ai }
          }
        `).toTranslate();
      });
      test('cannot expand access from private', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: *
            private: ai
          }
          source: d is c include {
            internal: ${'ai'}
          }
        `).toLog(
          errorMessage('Cannot expand access of `ai` from private to internal')
        );
      });
      test('can expand access from internal explicitly', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            internal: *
          }
          source: d is c include {
            public: ai
          }
          run: d -> { group_by: ai }
        `).toTranslate();
      });
      test('can expand access from internal with star', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            internal: *
          }
          source: d is c include {
            public: *
          }
          run: d -> { group_by: ai }
        `).toTranslate();
      });
      test('star does not expand access', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a extend {
            private dimension: x is 1
          }
          source: d is c include {
            public: *
          }
          source: e is d extend {
            dimension: y is ${'x'}
          }
        `).toLog(errorMessage("'x' is private"));
      });
      test('access modifier *', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            private: *
          }
          run: c -> { group_by: ai }
        `).toLog(errorMessage("'ai' is private"));
      });
      test('private things can be used in immediate extension', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            private: *
          } extend {
            dimension: ai2 is ai
          }
        `).toTranslate();
      });
      test('private things cannot be used in later extension', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is (a include {
            private: *
          }) extend {
            dimension: ai2 is ai
          }
        `).toLog(errorMessage("'ai' is private"));
      });
      test('access modifier * except', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            ai;
            private: *
          }
          run: c -> { group_by: ai, abool }
        `).toLog(errorMessage("'abool' is private"));
      });
      test('access modifier * nonconflicting use', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            internal: ai
            private: *
          }
          run: c -> { group_by: ai }
          source: d is c extend {
            dimension: x is abool
          }
        `).toLog(
          errorMessage("'ai' is internal"),
          errorMessage("'abool' is private")
        );
      });
      test('cannot override in same source', () => {
        return expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: ai
            private: ${'ai'}
          }
        `).toLog(errorMessage('Field `ai` already referenced in include list'));
      });
      test('rename in include', () => {
        return expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: ai2 is ai
          }
          run: c -> { group_by: ai2 }
          run: c -> { group_by: ${'ai'} }
        `).toLog(errorMessage("'ai' is not defined"));
      });
      test('commas optional in include', () => {
        return expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            ai
            astr
            abool
            private:
              af
              aweird
          }
          run: c -> { group_by: astr }
          run: c -> { group_by: ${'af'} }
        `).toLog(errorMessage("'af' is private"));
      });
      test('include and except quoted', () => {
        return expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            *
            except: \`astr\`
          }
          run: c -> { group_by: astr }
        `).toLog(errorMessage("'astr' is not defined"));
      });
      test('include and private quoted', () => {
        return expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            private: \`astr\`
          }
          run: c -> { group_by: astr }
        `).toLog(errorMessage("'astr' is private"));
      });
      test('include with except', () => {
        return expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            except: astr
          }
        `).toLog(
          errorMessage(
            'Cannot exclude specific fields if specific fields are already included'
          )
        );
      });
      test('except and include list', () => {
        return expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            except: astr
            public: ai
          }
        `).toLog(
          errorMessage(
            'Cannot include specific fields if specific fields are already excluded'
          )
        );
      });
      // TODO test conflict with `rename:` and `except:` and `accept:`
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
    test('except quoted', () => {
      const noAstr = new TestTranslator(
        'source: c is a extend { except: `astr` }'
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
  test('dates do not become timestamps', () => {
    const dateThing = model`source: hasDate is a -> { select: ad }`;
    expect(dateThing).toTranslate();
    const hasDate = dateThing.translator.getSourceDef('hasDate');
    expect(hasDate).toBeDefined();
    const ad = getFieldDef(hasDate!, 'ad');
    expect(ad).toMatchObject({name: 'ad', type: 'date'});
  });
  describe('composite sources', () => {
    test('basic composite source', () => {
      expect(`
        ##! experimental.composite_sources
        source: x is compose(a, a extend { dimension: foo is 1 })
        run: x -> { select: foo }
      `).toTranslate();
    });
  });
});
