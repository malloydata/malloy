/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  model,
  TestTranslator,
  markSource,
  errorMessage,
  warningMessage,
  error,
  getFieldDef,
} from './test-translator';
import './parse-expects';
import {
  activeName,
  isSourceDef,
  QueryModel,
  sourceNamespaceReference,
} from '../../model';
import type {SourceDef, VirtualMap} from '../../model';

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
      const aFields = a.fields.map(f => activeName(f));
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
      test('list except, internal, and public: *', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            except: ai
            internal: af
            public: *
          }
          run: c -> { select: ${'ai'} }
          run: c -> { select: ${'af'} }
          run: c -> { select: abool }
        `).toLog(
          errorMessage("'ai' is not defined"),
          errorMessage("'af' is internal")
        );
      });
      test('fernando regression', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            private: ai
            public: *
          }
          run: c -> { select: ${'ai'} }
          run: c -> { select: abool }
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
      describe('joined paths', () => {
        test('can use join paths in include block', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              *
              internal: c.ai
            }
            run: d -> { group_by: c.ai }
          `).toLog(errorMessage("'ai' is internal"));
        });
        test('can use joined wildcard', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              *
              internal: c.*
            }
            run: d -> { group_by: c.ai }
          `).toLog(errorMessage("'ai' is internal"));
        });
        test('access label on join', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              internal: c
            }
            run: d -> { group_by: c.ai }
          `).toLog(errorMessage("'c' is internal"));
        });
        test('private field in view does not blow up', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true

              view: x is {
                group_by: c.ai
              }
            } include {
              private: *
              public: x
            }
            run: d -> x
            run: d -> {nest: x}
          `).toTranslate();
        });
        test('except join and include join fields', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              except: c
              public: c.*
            }
          `).toLog(
            errorMessage(
              'Cannot include fields from `c` when `c` is itself excepted'
            )
          );
        });
        test('except join and except join fields', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              except: c
              except: c.*
            }
          `).toLog(
            errorMessage(
              'Cannot exclude fields from `c` when `c` is itself excepted'
            )
          );
        });
        test('include join fields then except join', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              public: c.*
              except: c
            }
            run: d -> { group_by: c.ai }
          `).toLog(
            errorMessage(
              'Cannot except `c` when fields from `c` are already included'
            )
          );
        });
        test('except join fields then except join', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              except: c.*
              except: ${'c'}
            }
          `).toLog(
            errorMessage(
              'Cannot except `c` when fields from `c` are already excepted'
            )
          );
        });
        test('join gets most permissive access level of inner fields (public)', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              public: c.*
            }
            run: d -> { group_by: c.ai }
          `).toTranslate();
        });
        test('set fields public of previously private join', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include { private: * } include {
              public: ${'c.*'}
            }
            run: d -> { group_by: ${'c.ai'} }
          `).toLog(
            errorMessage('`c` is private'),
            errorMessage("'c' is private")
          );
        });
        test('set fields public of newly private join', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              private: c
              public: ${'c.*'}
            }
            run: d -> { group_by: ${'c.ai'} }
          `).toLog(
            errorMessage('`c` is private'),
            errorMessage("'c' is private")
          );
        });
        test('set join private of join with set fields public', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              public: c.*
              private: ${'c'}
            }
            run: d -> { group_by: c.ai }
          `).toLog(
            errorMessage(
              'Cannot make `c` and also make fields in `c` public or internal'
            )
          );
        });
        test('set fields public of internal join', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include { internal: * } include {
              public: c.*
            }
            run: d -> { group_by: c.ai }
          `).toTranslate();
        });
        test('set fields public of internal join', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include { internal: * } include {
              public: c.*
              internal: ${'c'}
            }
            run: d -> { group_by: c.ai }
          `).toLog(
            errorMessage('Field `c` already referenced in include list')
          );
        });
        test('mentioning a join field should count as mentioning the join', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              internal: *
              public:
                c.ai
            }
            run: d -> { group_by: c.ai }
          `).toTranslate();
        });
        test('can add note', () => {
          const t = new TestTranslator(`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              *
              # new_note
              c.ai
            }
          `);
          expect(t).toTranslate();
          const d = t.modelDef.contents['d'];
          expect(isSourceDef(d)).toBe(true);
          if (isSourceDef(d)) {
            const dC = d.fields.find(f => activeName(f) === 'c');
            expect(dC).toBeDefined();
            if (dC === undefined) throw new Error('Expected dC to be defined');
            expect(isSourceDef(dC)).toBe(true);
            expect(isSourceDef(d)).toBe(true);
            if (isSourceDef(dC)) {
              const dCAi = dC.fields.find(f => activeName(f) === 'ai');
              expect(dCAi?.annotations).toMatchObject({
                notes: [{text: '# new_note\n'}],
              });
            }
          }
        });
        test('cannot rename', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              *
              x is c.ai
            }
          `).toLog(
            errorMessage('Cannot rename a joined field in an `include` block')
          );
        });
        test('can exclude field in join', () => {
          expect(markSource`
            ##! experimental.access_modifiers
            source: c is a
            source: d is a extend {
              join_one: c on true
            } include {
              *
              except: c.ai
            }
            run: d -> { group_by: c.ai }
          `).toLog(errorMessage("'ai' is not defined"));
        });
      });
      test('internal is accessible in joining source on', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: *
            internal: ai
          }
          source: d is a extend {
            join_one: c on ai = ${'c.ai'}
          }
        `).toTranslate();
      });
      test('internal is accessible in joining source view', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: *
            internal: ai
          }
          source: d is a extend {
            join_one: c on true
            view: x is {
              group_by: c.ai
            }
          }
        `).toTranslate();
      });
      test('internal is accessible in joining source dimension', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: *
            internal: ai
          }
          source: d is a extend {
            join_one: c on true
            dimension: cai is c.ai
          }
          run: d -> { group_by: c.astr } // TODO just here for debugging
        `).toTranslate();
      });
      test('joined internal is inaccessible in query', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: *
            internal: ai
          }
          source: d is a extend {
            join_one: c on true
          }
          run: d -> { group_by: c.ai }
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
      test('rename with backticks', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: \`ai2\` is ai
          }
          run: c -> { group_by: ai2 }
          run: c -> { group_by: ${'ai'} }
        `).toLog(errorMessage("'ai' is not defined"));
      });
      test('reference with backticks', () => {
        expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            internal: \`ai\`
          }
          run: c -> { group_by: ${'ai'} }
        `).toLog(errorMessage("'ai' is internal"));
      });
      test('not-mentioned fields are private', () => {
        return expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include { ai }
          run: c -> { group_by: ${'astr'} }
        `).toLog(errorMessage("'astr' is private"));
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
      test('include and except list', () => {
        return expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            ai
            except: astr
          } extend {
            dimension: astr2 is ${'astr'}
          }
        `).toLog(errorMessage("'astr' is not defined"));
      });
      test('access modifier and except list', () => {
        return expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include {
            public: ai
            except: astr
          } extend {
            dimension: astr2 is ${'astr'}
          }
          run: c -> { group_by: ai }
          run: c -> { group_by: ${'abool'} }
        `).toLog(
          errorMessage("'astr' is not defined"),
          errorMessage("'abool' is private")
        );
      });
      test('inherit * and except', () => {
        return expect(markSource`
          ##! experimental.access_modifiers
          source: c is a include { *; internal: abool } include {
            *
            except: astr
          } extend {
            dimension: astr2 is ${'astr'}
          }
          run: c -> { group_by: ai }
          run: c -> { group_by: ${'abool'} }
        `).toLog(
          errorMessage("'astr' is not defined"),
          errorMessage("'abool' is internal")
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
    test('rename measure to existing field name causes error', () => {
      expect(
        markSource`
          ##! experimental.access_modifiers
          source: sales is a include {
            private: *
            public: astr, ad
          } extend {
            measure: af_sum is sum(af)
          } extend {
            rename: ${'af is af_sum'}
          }
        `
      ).toLog(errorMessage("Can't rename to 'af', field already exists"));
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
  test('next join dependency ordering', () => {
    const m = model`
      source: flights is _db_.table('malloytest.flights') extend {
        join_one: origin_airport is _db_.table('malloytest.airports') on origin = origin_airport.code
        join_one: dest_airport is _db_.table('malloytest.airports') on destination = dest_airport.code
        join_one: carrier_info is _db_.table('malloytest.carriers') on carrier = carrier_info.code
      }

      run: _db_.table("malloytest.carriers") extend {
        join_many: carrier_flights is flights on carrier_flights.carrier = code
      } -> {
        select:
          code,
          carrier_flights.origin_airport.city,
          carrier_flights.dest_airport.state
      }
    `;
    expect(m).toTranslate();
    const query = m.translator.getQuery(0)?.pipeline[0];
    expect(query).toBeDefined();
    if (query) {
      expect(query.type).toBe('project');
      if (query.type === 'project') {
        expect(query.activeJoins).toEqual([
          {path: ['carrier_flights']},
          {path: ['carrier_flights', 'origin_airport']},
          {path: ['carrier_flights', 'dest_airport']},
        ]);
      }
    }
  });
  describe('filterList mutation', () => {
    test('extending source with join filter does not mutate original filterList', () => {
      const m = new TestTranslator(`
        source: bb is b extend {
          primary_key: astr
        }
        source: aircraft is a extend {
          join_one: bb with astr
          where: ai > 0
        }
        source: aircraft_filtered is aircraft extend {
          where: bb.astr = 'test'
        }
      `);
      expect(m).toTranslate();

      const aircraft = m.getSourceDef('aircraft');
      expect(aircraft).toBeDefined();
      if (aircraft && isSourceDef(aircraft)) {
        const filterCountOriginal = aircraft.filterList?.length ?? 0;
        expect(filterCountOriginal).toBe(1);
      }

      const aircraftFiltered = m.getSourceDef('aircraft_filtered');
      expect(aircraftFiltered).toBeDefined();
      if (aircraftFiltered && isSourceDef(aircraftFiltered)) {
        const filterCountExtended = aircraftFiltered.filterList?.length ?? 0;
        expect(filterCountExtended).toBe(2);
      }
    });

    test('multiple extensions do not affect each other filterLists', () => {
      const m = new TestTranslator(`
        source: bb is b extend {
          primary_key: astr
        }
        source: base is a extend {
          join_one: bb with astr
        }
        source: ext1 is base extend {
          where: bb.astr = 'one'
        }
        source: ext2 is base extend {
          where: bb.astr = 'two'
        }
      `);
      expect(m).toTranslate();

      const base = m.getSourceDef('base');
      const ext1 = m.getSourceDef('ext1');
      const ext2 = m.getSourceDef('ext2');

      expect(base).toBeDefined();
      expect(ext1).toBeDefined();
      expect(ext2).toBeDefined();

      if (base && isSourceDef(base)) {
        expect(base.filterList?.length ?? 0).toBe(0);
      }
      if (ext1 && isSourceDef(ext1)) {
        expect(ext1.filterList?.length ?? 0).toBe(1);
      }
      if (ext2 && isSourceDef(ext2)) {
        expect(ext2.filterList?.length ?? 0).toBe(1);
      }
    });
  });

  describe('sourceRegistry', () => {
    test('query source with sourceID is added to sourceRegistry', () => {
      const m = new TestTranslator(`
        source: query_src is a -> {
          group_by: astr
          aggregate: acount is count()
        }
      `);
      expect(m).toTranslate();
      const modelDef = m.translate().modelDef;
      expect(modelDef).toBeDefined();
      if (modelDef) {
        const src = m.getSourceDef('query_src');
        expect(src).toBeDefined();
        expect(src?.type).toBe('query_source');
        if (src && src.sourceID) {
          const registryValue = modelDef.sourceRegistry[src.sourceID];
          expect(registryValue).toBeDefined();
          expect(registryValue?.entry).toMatchObject({
            type: 'source_registry_reference',
            name: 'query_src',
          });
        } else {
          fail('Expected query_src to have an sourceID');
        }
      }
    });

    test('extending query_source sets extends property to base sourceID', () => {
      const m = new TestTranslator(`
        source: base_src is a -> {
          group_by: astr
          aggregate: acount is count()
        }

        source: extended_src is base_src extend {
          dimension: extra is 'test'
        }
      `);
      expect(m).toTranslate();
      const modelDef = m.translate().modelDef;
      expect(modelDef).toBeDefined();
      if (modelDef) {
        const baseSrc = m.getSourceDef('base_src');
        const extSrc = m.getSourceDef('extended_src');
        expect(baseSrc).toBeDefined();
        expect(extSrc).toBeDefined();
        expect(baseSrc?.type).toBe('query_source');
        expect(extSrc?.type).toBe('query_source');

        // Base source should have sourceID
        if (baseSrc && baseSrc.sourceID) {
          const baseSourceID = baseSrc.sourceID;
          expect(baseSourceID).toContain('base_src@');

          // Extended source should have extends pointing to base sourceID
          if (extSrc && 'extends' in extSrc) {
            expect(extSrc.extends).toBe(baseSourceID);
          } else {
            fail('Expected extended_src to have extends property');
          }
        } else {
          fail('Expected base_src to have an sourceID');
        }
      }
    });

    test('defined source sets as property, preserves name from base', () => {
      // When defining a source, 'as' should be set to the new name
      // 'name' should be preserved from the base (it may contain important info like SQL)
      const m = new TestTranslator(`
        source: my_source is a -> {
          group_by: astr
        }
      `);
      expect(m).toTranslate();
      const src = m.getSourceDef('my_source');
      expect(src).toBeDefined();
      if (src) {
        expect(src.as).toBe('my_source');
        // name comes from the base - for query_source it will be something from 'a'
        // The key point is that 'as' is set correctly
      }
    });

    test('extended source sets as property, preserves name from base', () => {
      const m = new TestTranslator(`
        source: base_src is a -> {
          group_by: astr
        }

        source: extended_src is base_src extend {
          dimension: extra is 'test'
        }
      `);
      expect(m).toTranslate();
      const baseSrc = m.getSourceDef('base_src');
      const extSrc = m.getSourceDef('extended_src');
      expect(baseSrc).toBeDefined();
      expect(extSrc).toBeDefined();
      if (baseSrc && extSrc) {
        expect(baseSrc.as).toBe('base_src');
        expect(extSrc.as).toBe('extended_src');
        // Extended source preserves name from base
        expect(extSrc.name).toBe(baseSrc.name);
      }
    });
  });

  describe('referenceID', () => {
    // referenceID is set only when a source is created as an unmodified
    // reference to another source, and holds the sourceID of the immediately
    // referenced source. A source that defines its own shape (table/sql/query,
    // or a modified/extended source) has no referenceID.

    // Fetch a source def and assert it is present, so a missing source fails
    // the test loudly instead of letting the assertions below get skipped.
    function defOf(m: TestTranslator, name: string): SourceDef {
      const sd = m.getSourceDef(name);
      expect(sd).toBeDefined();
      if (!sd || !isSourceDef(sd)) {
        throw new Error(`expected a source named '${name}'`);
      }
      return sd;
    }

    function sources(src: string) {
      const m = new TestTranslator(src);
      expect(m).toTranslate();
      return m;
    }

    test('a source that defines its own shape has no referenceID', () => {
      const base = defOf(
        sources('source: base is a -> {group_by: astr}'),
        'base'
      );
      expect(base.sourceID).toBeDefined();
      expect(base.referenceID).toBeUndefined();
    });

    test('a table source has no referenceID', () => {
      const tbl = defOf(sources("source: tbl is _db_.table('aTable')"), 'tbl');
      expect(tbl.sourceID).toBeDefined();
      expect(tbl.referenceID).toBeUndefined();
    });

    test('an unmodified rename references the source it copies', () => {
      const m = sources(`
        source: base is a -> {group_by: astr}
        source: ref is base
      `);
      const base = defOf(m, 'base');
      const ref = defOf(m, 'ref');
      // ref defines no new shape: it points at base's identity.
      expect(ref.referenceID).toBe(base.sourceID);
      // and it is recognizably a reference, with its own distinct sourceID.
      expect(ref.referenceID).not.toBeUndefined();
      expect(ref.sourceID).not.toBe(base.sourceID);
    });

    test('a reference names the immediate source, not the ultimate origin', () => {
      const m = sources(`
        source: base is a -> {group_by: astr}
        source: ref is base
        source: ref2 is ref
      `);
      // ref2 references ref (what it was written against), not base.
      expect(defOf(m, 'ref2').referenceID).toBe(defOf(m, 'ref').sourceID);
      expect(defOf(m, 'ref2').referenceID).not.toBe(defOf(m, 'base').sourceID);
    });

    test('extending a source clears the reference', () => {
      const m = sources(`
        source: base is a -> {group_by: astr}
        source: ext is base extend {
          dimension: extra is 'x'
        }
      `);
      expect(defOf(m, 'ext').referenceID).toBeUndefined();
    });

    test('include clears the reference (it edits the namespace)', () => {
      const m = sources(`
        ##! experimental.access_modifiers
        source: base is a -> {group_by: astr, ai}
        source: inc is base include { except: ai }
      `);
      expect(defOf(m, 'inc').referenceID).toBeUndefined();
    });

    test('a reference to an extended source points at that extended source', () => {
      const m = sources(`
        source: base is a -> {group_by: astr}
        source: ext is base extend {
          dimension: extra is 'x'
        }
        source: refExt is ext
      `);
      expect(defOf(m, 'refExt').referenceID).toBe(defOf(m, 'ext').sourceID);
    });

    test('a join carries the referenceID of the joined source', () => {
      const m = sources(`
        source: base is a -> {group_by: astr, ai}
        source: host is a extend {
          join_one: jb is base on ai = jb.ai
        }
      `);
      const base = defOf(m, 'base');
      const host = defOf(m, 'host');
      const jb = host.fields.find(f => activeName(f) === 'jb');
      expect(jb && isSourceDef(jb)).toBeTruthy();
      if (jb && isSourceDef(jb)) {
        expect(jb.referenceID).toBe(base.sourceID);
      }
    });

    test('sourceNamespaceReference resolves a reference to its namespace name', () => {
      const m = sources(`
        source: base is a -> {group_by: astr}
        source: ref is base
      `);
      const modelDef = m.translate().modelDef;
      expect(modelDef).toBeDefined();
      // A reference resolves to the namespace entry it points at.
      const refInfo = sourceNamespaceReference(modelDef!, defOf(m, 'ref'));
      expect(refInfo?.name).toBe('base');
      expect(refInfo?.source).toBe(defOf(m, 'base'));
      // A source that defines its own shape resolves to nothing.
      expect(
        sourceNamespaceReference(modelDef!, defOf(m, 'base'))
      ).toBeUndefined();
    });

    test('a reference resolves to its namespace name across an import', () => {
      const docParse = new TestTranslator(`
        import "child"
        source: ref is base
      `);
      docParse.update({
        urls: {
          'internal://test/langtests/child':
            'source: base is a -> {group_by: astr}',
        },
      });
      expect(docParse).toTranslate();
      const modelDef = docParse.translate().modelDef;
      expect(modelDef).toBeDefined();
      // The reference made in the importing model resolves to the imported name.
      const refInfo = sourceNamespaceReference(
        modelDef!,
        defOf(docParse, 'ref')
      );
      expect(refInfo?.name).toBe('base');
    });

    test('a re-export whose target was not imported is a reference with no namespace entry', () => {
      // child: `top is base` is an unmodified rename; only `top` is imported.
      const docParse = new TestTranslator(`
        import { top } from "child"
        source: ref is top
      `);
      docParse.update({
        urls: {
          'internal://test/langtests/child': `
            source: base is a -> {group_by: astr}
            source: top is base
          `,
        },
      });
      expect(docParse).toTranslate();
      const modelDef = docParse.translate().modelDef;
      expect(modelDef).toBeDefined();
      // ref points at the immediate target `top`, which IS in the namespace...
      expect(
        sourceNamespaceReference(modelDef!, defOf(docParse, 'ref'))?.name
      ).toBe('top');
      // ...while `top` itself is a reference, but its target `base` was not
      // imported, so it has no namespace entry here (honest "no").
      const top = defOf(docParse, 'top');
      expect(top.referenceID).not.toBeUndefined();
      expect(sourceNamespaceReference(modelDef!, top)).toBeUndefined();
    });

    test('a join of an import-renamed source resolves to its local name', () => {
      const docParse = new TestTranslator(`
        import { local is orig } from "child"
        source: host is a extend {
          join_one: j is local on ai = j.ai
        }
      `);
      docParse.update({
        urls: {
          'internal://test/langtests/child':
            'source: orig is a -> {group_by: astr, ai}',
        },
      });
      expect(docParse).toTranslate();
      const modelDef = docParse.translate().modelDef;
      expect(modelDef).toBeDefined();
      const host = defOf(docParse, 'host');
      const j = host.fields.find(f => activeName(f) === 'j');
      expect(j && isSourceDef(j)).toBeTruthy();
      if (j && isSourceDef(j)) {
        // The join references the imported source, known here by the name it
        // was renamed to on import.
        expect(sourceNamespaceReference(modelDef!, j)?.name).toBe('local');
      }
    });
  });

  describe('Object.prototype field name collisions', () => {
    test('constructor as source name', () => {
      expect('source: constructor is a').toTranslate();
    });
    test('toString as dimension alias', () => {
      expect(`
        source: x is a extend {
          dimension: toString is astr
        }
      `).toTranslate();
    });
    test('constructor as dimension alias', () => {
      expect(`
        source: x is a extend {
          dimension: constructor is astr
        }
      `).toTranslate();
    });
    test('constructor as measure alias', () => {
      expect(`
        source: x is a extend {
          measure: constructor is count()
        }
      `).toTranslate();
    });
    test('constructor as join name', () => {
      expect(`
        source: x is a extend {
          join_one: constructor is a on astr = constructor.astr
        }
      `).toTranslate();
    });
    test('toString as source name', () => {
      expect('source: toString is a').toTranslate();
    });
  });
});

describe('virtual sources', () => {
  const experimental = '##! experimental.virtual_source\n';

  function vsModel(src: string) {
    return new TestTranslator(experimental + src);
  }

  test('basic virtual source', () => {
    const m = vsModel(`
      source: v is _db_.virtual('my_table')
    `);
    expect(m).toTranslate();
    const src = m.getSourceDef('v');
    expect(src).toBeDefined();
    expect(src!.type).toBe('virtual');
    expect(src!.name).toBe('my_table');
    expect(src!.connection).toBe('_db_');
    expect(src!.fields).toEqual([]);
  });

  test('virtual source with single user type shape', () => {
    const m = vsModel(`
      type: Schema is { name :: string, age :: number }
      source: v is _db_.virtual('t')::Schema
    `);
    expect(m).toTranslate();
    const src = m.getSourceDef('v');
    expect(src).toBeDefined();
    expect(src!.type).toBe('virtual');
    expect(src!.fields.map(f => f.name)).toEqual(['name', 'age']);
  });

  test('virtual source with multiple user type shapes', () => {
    const m = vsModel(`
      type: Names is { name :: string }
      type: Ages is { age :: number }
      source: v is _db_.virtual('t')::(Names, Ages)
    `);
    expect(m).toTranslate();
    const src = m.getSourceDef('v');
    expect(src).toBeDefined();
    expect(src!.fields.map(f => f.name)).toEqual(['name', 'age']);
  });

  test('virtual source gets fields from user type shapes', () => {
    const m = vsModel(`
      type: Schema is { name :: string, score :: number }
      source: v is _db_.virtual('t')::Schema
    `);
    expect(m).toTranslate();
    const src = m.getSourceDef('v');
    expect(src!.fields[0]).toEqual(
      expect.objectContaining({name: 'name', type: 'string'})
    );
    expect(src!.fields[1]).toEqual(
      expect.objectContaining({name: 'score', type: 'number'})
    );
  });

  test('virtual source with unknown dialect', () => {
    const m = vsModel(`
      source: v is unknown_conn.virtual('t')
    `);
    m.update({
      errors: {connectionDialects: {unknown_conn: 'connection not found'}},
    });
    expect(m).toLog(error('virtual-source-unknown-dialect'));
  });

  test('non-connection name for virtual source', () => {
    const m = vsModel(`
      source: v is a.virtual('t')
    `);
    m.update({
      errors: {connectionDialects: {a: 'a is not a connection'}},
    });
    expect(m).toLog(error('invalid-connection-for-table-source'));
  });

  // Regression for #2845: a query source built on a virtual source used to
  // fail model load, because loading eagerly generated SQL for the query
  // source before a virtualMap was available.
  test('query source built on a virtual source loads and compiles', () => {
    const m = vsModel(`
      type: ff is { category :: string, amount :: number }
      source: facts_raw is _db_.virtual('facts_raw')::ff
      source: facts_agg is facts_raw -> {
        group_by: category
        aggregate: total is sum(amount)
      }
      run: facts_agg -> { group_by: category }
    `);
    expect(m).toTranslate();
    const modelDef = m.translate().modelDef!;
    const virtualMap: VirtualMap = new Map([
      ['_db_', new Map([['facts_raw', 'facts_table']])],
    ]);
    const queryModel = new QueryModel(modelDef);
    const compiled = queryModel.compileQuery(modelDef.queryList[0], {
      virtualMap,
    });
    expect(compiled.sql).toContain('facts_table');
  });

  // A query source on a virtual source, reached through a join, exercises the
  // nested-query-source path that the old load-time field resolution walked.
  test('joined query source on a virtual source compiles', () => {
    const m = vsModel(`
      type: ff is { id :: number, category :: string, amount :: number }
      source: facts_raw is _db_.virtual('facts_raw')::ff
      source: cat_totals is facts_raw -> {
        group_by: category
        aggregate: total is sum(amount)
      }
      source: enriched is facts_raw extend {
        join_one: cat_totals on category = cat_totals.category
      }
      run: enriched -> { select: category, cat_totals.total }
    `);
    expect(m).toTranslate();
    const modelDef = m.translate().modelDef!;
    const virtualMap: VirtualMap = new Map([
      ['_db_', new Map([['facts_raw', 'facts_table']])],
    ]);
    const queryModel = new QueryModel(modelDef);
    const compiled = queryModel.compileQuery(modelDef.queryList[0], {
      virtualMap,
    });
    expect(compiled.sql).toContain('facts_table');
  });
});

describe('typed source (::)', () => {
  const experimental = '##! experimental.virtual_source\n';

  function tsModel(src: string) {
    return new TestTranslator(experimental + src);
  }

  test('source :: user type hides fields not in shape', () => {
    const m = tsModel(`
      type: Narrow is { astr :: string }
      source: typed is a::Narrow
    `);
    expect(m).toTranslate();
    const src = m.getSourceDef('typed')!;
    expect(getFieldDef(src, 'astr').accessModifier).toBeUndefined();
    expect(getFieldDef(src, 'ai').accessModifier).toBe('internal');
  });

  test('source :: user type with all fields present', () => {
    const m = tsModel(`
      type: HasStr is { astr :: string }
      source: typed is a::HasStr
    `);
    expect(m).toTranslate();
  });

  test('source :: with multiple compatible shapes', () => {
    const m = tsModel(`
      type: S1 is { astr :: string }
      type: S2 is { ai :: number }
      source: typed is a::(S1, S2)
    `);
    expect(m).toTranslate();
    const src = m.getSourceDef('typed')!;
    expect(getFieldDef(src, 'astr').accessModifier).toBeUndefined();
    expect(getFieldDef(src, 'ai').accessModifier).toBeUndefined();
    expect(getFieldDef(src, 'af').accessModifier).toBe('internal');
  });

  test('typed source used in a query', () => {
    const m = tsModel(`
      type: S is { astr :: string }
      run: a::S -> { select: astr }
    `);
    expect(m).toTranslate();
  });

  test(':: references undefined user type', () => {
    expect(
      tsModel(`
      source: typed is a::NoSuch
    `)
    ).toLog(error('user-type-not-found'));
  });

  test(':: references non-user-type name', () => {
    expect(
      tsModel(`
      source: typed is a::b
    `)
    ).toLog(error('not-a-user-type'));
  });

  test(':: on non-virtual source missing required field', () => {
    expect(
      tsModel(`
      type: S is { not_a_real_field :: string }
      source: typed is a::S
    `)
    ).toLog(error('user-type-field-missing'));
  });

  test(':: with conflicting field types across shapes', () => {
    expect(
      tsModel(`
      type: S1 is { astr :: string }
      type: S2 is { astr :: number }
      source: typed is a::(S1, S2)
    `)
    ).toLog(error('user-type-field-conflict'));
  });

  test(':: type mismatch is an error', () => {
    expect(
      tsModel(`
      type: S is { astr :: number }
      source: typed is a::S
    `)
    ).toLog(error('user-type-type-mismatch'));
  });

  test(':: does not validate types on virtual sources', () => {
    const m = tsModel(`
      type: S is { x :: string }
      source: v is _db_.virtual('t')::S
    `);
    expect(m).toTranslate();
  });

  test(':: does not hide non-intrinsic fields', () => {
    const m = tsModel(`
      type: S is { astr :: string }
      source: typed is ab::S
    `);
    expect(m).toTranslate();
    const src = m.getSourceDef('typed')!;
    // measure acount and view aturtle from ab should not be hidden
    expect(getFieldDef(src, 'acount').accessModifier).toBeUndefined();
  });
});
