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
  getSelectOneStruct,
  errorMessage,
  error,
  warningMessage,
} from './test-translator';
import './parse-expects';

describe('model statements', () => {
  describe('table method', () => {
    test('table method works', () => {
      expect("source: testA is _db_.table('aTable')").toTranslate();
    });
    test('table method works with quoted connection name', () => {
      expect("source: testA is `_db_`.table('aTable')").toTranslate();
    });
    test('table method fails when connection name is wrong', () => {
      expect("source: testA is bad_conn.table('aTable')").not.toTranslate();
    });
    test('table method fails when connection is not a connection', () => {
      const m = model`source: a1 is a; source: testA is a1.table('aTable')`;
      // This is a somewhat weird behavior from the translator. During the
      // first phase of translation, we fetch "external references" (tables and
      // imports). At that point we don't know that there will be an error
      // "a1 is not a connection," so we attempt to fetch `aTable` from connection
      // `a1` even though a1 is not a connection. The response from the application
      // is basically ignored in the end, as we still eventually get the error
      // that a1 is not a connection (it's a source).
      m.translator.update({
        errors: {tables: {'a1:aTable': 'invalid connection'}},
      });
      expect(m).toLog(errorMessage('a1 is not a connection'));
    });
    test('cannot refine table', () => {
      expect(markSource`run: \`_db_\`.table('aTable') + { limit: 10 }`).toLog(
        errorMessage('Cannot add view refinements to a source')
      );
    });
    test('table function is deprecated', () => {
      expect(`##! m4warnings=warn
      source: testA is table('_db_:aTable')
    `).toLog(
        warningMessage(
          "`table('connection_name:table_path')` is deprecated; use `connection_name.table('table_path')`"
        )
      );
    });
    test('cannot run table', () => {
      expect(markSource`run: \`_db_\`.table('aTable')`).toLog(
        errorMessage('This source cannot be used as a query')
      );
    });
  });

  test('errors on redefinition of query', () => {
    expect('query: q1 is a -> { select: * }, q1 is a -> { select: * }').toLog(
      errorMessage("'q1' is already defined, cannot redefine")
    );
  });

  test('##! experimental enables all experiments', () => {
    expect('##! experimental\n;;[ "x" ]').toTranslate();
  });

  test('experimental explicit enable', () => {
    expect(
      '##! experimental { compilerTestExperimentParse compilerTestExperimentTranslate }\n;;[ "x" ]'
    ).toTranslate();
  });

  test('experiments do not bleed into one another', () => {
    expect(
      '##! experimental { this_experiment_does_not_exist }\n;;[ "x" ]'
    ).toLog(
      error('experiment-not-enabled', {
        experimentId: 'compilerTestExperimentParse',
      })
    );
  });

  test('experiment failures in parse are flagged', () => {
    expect(';;[ "x" ]').toLog(
      error('experiment-not-enabled', {
        experimentId: 'compilerTestExperimentParse',
      })
    );
  });

  test('experiment failures in second pass are flagged', () => {
    expect('##! experimental.compilerTestExperimentParse\n;;[ "x" ]').toLog(
      error('experiment-not-enabled', {
        experimentId: 'compilerTestExperimentTranslate',
      })
    );
  });
});

describe('error handling', () => {
  test('field and query with same name does not overflow', () => {
    expect(`
      source: flights is _db_.table('malloytest.flights') extend {
        view: carrier is { group_by: carrier }
      }
    `).toLog(errorMessage("Cannot redefine 'carrier'"));
  });
  test('redefine source', () => {
    expect(markSource`
      source: airports is _db_.table('malloytest.airports') extend {
        primary_key: code
      }
      source: airports is _db_.table('malloytest.airports') extend {
        primary_key: code
      }
    `).toLog(errorMessage("Cannot redefine 'airports'"));
  });
  test('query from undefined source', () => {
    expect(markSource`run: ${'x'}->{ select: y }`).toLog(
      errorMessage("Reference to undefined object 'x'")
    );
  });
  test('query with expression from undefined source', () => {
    // Regression check: Once upon a time this died with an exception even
    // when "query: x->{ group_by: y}" (above) generated the correct error.
    expect(markSource`run: ${'x'}->{ select: y is z / 2 }`).toLog(
      errorMessage("Reference to undefined object 'x'")
    );
  });
  test('join reference before definition', () => {
    expect(
      markSource`
        source: newAB is a extend { join_one: newB is ${'bb'} on astring }
        source: newB is b
      `
    ).toLog(errorMessage("Reference to undefined object 'bb'"));
  });
  test('non-rename rename', () => {
    expect('source: na is a extend { rename: astr is astr }').toLog(
      errorMessage("Can't rename field to itself")
    );
  });
  test('reference to field in its definition', () => {
    expect('source: na is a extend { dimension: ustr is upper(ustr) } ').toLog(
      errorMessage("Circular reference to 'ustr' in definition")
    );
  });
  test('empty model', () => {
    expect('').toTranslate();
  });
  test('one line model ', () => {
    expect('\n').toTranslate();
  });
  test('query without fields', () => {
    expect('run: a -> { top: 5 }').toLog(error('ambiguous-view-type'));
  });
  test('refine cannot change query type', () => {
    expect('run: ab -> aturtle + { select: astr }').toLog(
      errorMessage(/Not legal in grouping query/)
    );
  });
  test('undefined field ref in query', () => {
    expect('run: ab -> { aggregate: xyzzy }').toLog(
      errorMessage("'xyzzy' is not defined")
    );
  });
  test('query on source with errors', () => {
    expect(markSource`
        source: na is a extend { join_one: ${'n'} on astr }
      `).toLog(errorMessage("Reference to undefined object 'n'"));
  });
  test('detect duplicate output field names', () => {
    expect(markSource`run: ab -> { group_by: astr, ${'astr'} }`).toLog(
      errorMessage("Output already has a field named 'astr'")
    );
  });
  test('detect join tail overlap existing ref', () => {
    expect(markSource`run: ab -> { group_by: astr, ${'b.astr'} }`).toLog(
      errorMessage("Output already has a field named 'astr'")
    );
  });
  test('undefined in expression with regex compare', () => {
    expect(
      `
        source: c is a extend {
          dimension: d is meaning_of_life ~ r'(forty two|fifty four)'
        }
      `
    ).toLog(errorMessage("'meaning_of_life' is not defined"));
  });
  test('detect output collision on join references', () => {
    expect(`
      run: ab -> {
        group_by: astr, b.astr
      }
    `).toLog(errorMessage("Output already has a field named 'astr'"));
  });
  test('rejoin a query is renamed', () => {
    expect(`
      source: querySrc is _db_.table('malloytest.flights')->{
        group_by: origin
        nest: nested is { group_by: destination }
      }

    source: refineQuerySrc is querySrc extend {
      join_one: rejoin is querySrc on 7=8
      view: broken is {
        group_by: rejoin.nested.destination
      }
    }
    `).toTranslate();
  });
  test('popping out of embedding when not embedded', () => {
    expect('}%').toLog(errorMessage(/extraneous input '}%' expecting/));
  });

  test('bad sql in sql block', () => {
    const badSelect = model`source: someName is _db_.sql(")")`;
    const badTrans = badSelect.translator;
    expect(badSelect).toParse();
    const needSchema = badTrans.translate();
    expect(needSchema.compileSQL).toBeDefined();
    if (needSchema.compileSQL) {
      badTrans.update({
        errors: {
          compileSQL: {
            [needSchema.compileSQL.name]: 'Nobody ZZZZ',
          },
        },
      });
    }
    expect(badTrans).toLog(errorMessage('Invalid SQL, Nobody ZZZZ'));
  });
});

describe('translate imports', () => {
  test('import at', () => {
    const source = markSource`import ${'"myfile.malloy"'}`;
    const m = new TestTranslator(source.code);
    const resp1 = m.translate();
    expect(resp1.final).toBeUndefined();
    m.update({
      urls: {
        'internal://test/langtests/myfile.malloy': 'query: ab -> { select: * }',
      },
    });
    const resp2 = m.translate();
    expect(resp2.final).toBeDefined();
    const im = m.importAt({line: 0, character: 10});
    expect(im?.importURL).toEqual('internal://test/langtests/myfile.malloy');
    expect(im?.location.url).toEqual('internal://test/langtests/root.malloy');
    expect(im?.location).toMatchObject(source.locations[0]);
  });
});

describe('translation need error locations', () => {
  test('import error location', () => {
    const source = model`import ${'"badfile"'}`;
    const m = source.translator;
    const result = m.translate();
    m.update({
      errors: {urls: {[(result.urls || [])[0]]: 'Bad file!'}},
    });
    expect(source).toLog(errorMessage(/Bad file!/));
  });

  test('sql struct error location', () => {
    const source = markSource`
      source: bad_sql is _db_.sql(${'"""BAD_SQL"""'})
      run: bad_sql -> { select: * }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toParse();
    const req = m.translate().compileSQL;
    expect(req).toBeDefined();
    if (req) {
      m.update({errors: {compileSQL: {[req.name]: 'Bad SQL!'}}});
    }
    expect(m).not.toTranslate();
    const errList = m.problems();
    expect(errList[0].at).isLocationIn(source.locations[0], source.code);
  });

  test('table struct error location', () => {
    const source = model`
      source: bad_explore is ${"_db_.table('malloydata-org.bad.table')"}
    `;
    const m = source.translator;
    const result = m.translate();
    m.update({
      errors: {
        tables: {[Object.keys(result.tables || {})[0]]: 'Bad table!'},
      },
    });
    expect(m).toLog(errorMessage(/Bad table!/));
  });
});

describe('error cascading', () => {
  test('errors can appear in multiple top level objects', () => {
    expect(
      markSource`
        source: a1 is a extend { dimension: ${'x is count()'} }
        source: a2 is a extend { dimension: ${'x is count()'} }
      `
    ).toLog(
      errorMessage(
        'Cannot use an aggregate field in a dimension declaration, did you mean to use a measure declaration instead?'
      ),
      errorMessage(
        'Cannot use an aggregate field in a dimension declaration, did you mean to use a measure declaration instead?'
      )
    );
  });

  const typedScalars = {
    'err': 'error',
    '@2003 ~ @2003 for err hours': 'boolean',
    'err.hour': 'timestamp',
    'err.month': 'date',
    'day_of_week(err)': 'number',
    'err::string': 'string',
    '-err': 'number',
    'err * 1': 'number',
    '1 * err': 'number',
    'err / 1': 'number',
    '1 / err': 'number',
    'err % 1': 'number',
    '1 % err': 'number',
    'err + 1': 'number',
    '1 + err': 'number',
    'err - 1': 'number',
    '1 - err': 'number',
    '@2003 ? err for 1 minute': 'boolean',
    '@2003 ? @2003 for err minutes': 'boolean',
    '3 ? > err & > 3': 'boolean',
    '3 ? > 3 & > err': 'boolean',
    '3 ? > err | > 3': 'boolean',
    '3 ? > 3 | > err': 'boolean',
    'err ? > 3': 'boolean',
    '3 ? > err': 'boolean',
    '1 > err': 'boolean',
    'err > 1': 'boolean',
    '1 >= err': 'boolean',
    'err >= 1': 'boolean',
    '1 < err': 'boolean',
    'err < 1': 'boolean',
    '1 <= err': 'boolean',
    'err <= 1': 'boolean',
    '1 = err': 'boolean',
    'err = 1': 'boolean',
    '1 != err': 'boolean',
    'err != 1': 'boolean',
    '1 ~ err': 'boolean',
    'err ~ 1': 'boolean',
    '1 !~ err': 'boolean',
    'err !~ 1': 'boolean',
    'not err': 'boolean',
    'err and true': 'boolean',
    'true and err': 'boolean',
    'err or true': 'boolean',
    'true or err': 'boolean',
    'err ?? 1': 'number',
    '1 ?? err': 'number',
    'cast(err as number)': 'number',
    '(err)': 'error',
    'length(err)': 'number',
    'pick err when true else false': 'boolean',
    'pick true when err else false': 'boolean',
    'pick true when true else err': 'boolean',
    'days(err to @2003)': 'number',
    'days(@2003 to err)': 'number',
  };
  const scalars = Object.keys(typedScalars);
  const aggregates = ['measure_err { where: true }'];
  const ungroupedAggregates = ['all(measure_err)'];

  test('dependent errors do not cascade', () => {
    expect(
      `
        source: a1 is a extend {
          join_one: b with astr
          dimension:
            ${'err is nothing'}
            ${scalars.map((d, i) => `e${i} is ${d}`).join('\n            ')}
          measure:
            measure_err is count(foo),
            ${[...aggregates, ...ungroupedAggregates]
              .map((m, i) => `e${i + scalars.length} is ${m}`)
              .join('\n            ')}
        }
      `
    ).toLog(
      errorMessage("'nothing' is not defined"),
      errorMessage("'foo' is not defined")
    );
  });

  test('error type inference is good', () => {
    for (const scalar of scalars) {
      const source = `
          source: a1 is a extend {
            dimension:
              ${'err is nothing'}
              dim is length(${scalar}, 1)
          }
        `;
      expect(source).toLog(
        errorMessage("'nothing' is not defined"),
        errorMessage(
          `No matching overload for function length(${typedScalars[scalar]}, number)`
        )
      );
    }
  });

  test('eval space of errors is preserved', () => {
    expect(
      `
        source: a1 is a extend {
          join_one: b with astr
        }
        run: a1 -> {
          group_by:
            ${'err is nothing'}
          aggregate:
            measure_err is count(foo)
          calculate:
            ${scalars
              .map((d, i) => `e${i} is lag(${d})`)
              .join('\n            ')}
            ${aggregates
              .map((m, i) => `e${i + scalars.length} is lag(${m})`)
              .join('\n            ')}
        }
      `
    ).toLog(
      errorMessage("'nothing' is not defined"),
      errorMessage("'foo' is not defined")
    );
  });
});

describe('pipeline comprehension', () => {
  test('second query gets namespace from first', () => {
    expect(`
      source: aq is a extend {
        view: t1 is {
          group_by: t1int is ai, t1str is astr
        } -> {
          select: t1str, t1int
        }
      }
    `).toTranslate();
  });
  test("second query doesn't have access to original fields", () => {
    expect(
      model`
        source: aq is a extend {
          view: t1 is {
            group_by: t1int is ai, t1str is astr
          } -> {
            select: ${'ai'}
          }
        }
      `
    ).toLog(errorMessage("'ai' is not defined"));
  });
  test('new query can append ops to existing query', () => {
    expect(`
      source: aq is a extend {
        view: t0 is {
          group_by: t1int is ai, t1str is astr
        }
        view: t1 is t0 -> {
          select: t1str, t1int
        }
      }
    `).toTranslate();
  });
  test('new query can refine and append to exisiting query', () => {
    expect(`
      source: aq is _db_.table('aTable') extend {
        view: by_region is { group_by: astr }
        view: by_region2 is by_region + {
          nest: dateNest is { group_by: ad }
        } -> {
          select: astr, dateNest.ad
        }
      }
    `).toTranslate();
  });
  test('reference to a query can include a refinement', () => {
    expect(`
      run: ab -> {
        group_by: ai
        nest: aturtle + { limit: 1 }
      }
    `).toTranslate();
  });
  test('Querying an sourcebased on a query', () => {
    expect(`
      query: q is a -> { group_by: astr; aggregate: strsum is ai.sum() }
      source: aq is a extend {
        join_one: aq is q on astr = aq.astr
      }
      run: aq -> { select: * }
    `).toTranslate();
  });
  test('new query appends to existing query', () => {
    const src = `
      query: s1 is _db_.table('malloytest.flights') -> {
        group_by: origin, destination
      }
      query: s2 is s1 -> {
        select: *, extra is 'extra'
      }
    `;
    const m = new TestTranslator(src);
    expect(m).toTranslate();
    const s2 = m.getQuery('s2');
    expect(s2?.pipeline.length).toBe(2);
  });
});

describe('raw function call with type specified', () => {
  test('timestamp_seconds', () => {
    expect('timestamp_seconds!timestamp(0)').toReturnType('timestamp');
  });
});

describe('sql expressions', () => {
  test('reference to sql expression in unextended source', () => {
    const m = model`
      source: na is bigquery.sql("""SELECT 1 as one""")
    `;
    expect(m).toParse();
    const compileSql = m.translator.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.translator.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
    }
  });

  test('sql expression legal with single quote', () => {
    const m = model`
      source: na is bigquery.sql('SELECT 1 as one')
    `;
    expect(m).toParse();
    const compileSql = m.translator.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.translator.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
    }
  });

  test('sql expression legal with double quote', () => {
    const m = model`
      source: na is bigquery.sql("SELECT 1 as one")
    `;
    expect(m).toParse();
    const compileSql = m.translator.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.translator.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
    }
  });

  test('reference to sql expression in extended source', () => {
    const m = model`
      source: na is bigquery.sql("""SELECT 1 as one""") extend {
        dimension: two is one + one
      }
    `;
    const compileSql = m.translator.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.translator.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
    }
  });

  test('reference to sql expression in named query', () => {
    const m = new TestTranslator(`
      query: nq is bigquery.sql("""SELECT 1 as one""") -> { select: * }
    `);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
    }
  });

  test('reference to sql expression in unnamed query', () => {
    const m = new TestTranslator(`
      run: bigquery.sql("""SELECT 1 as one""") -> { select: * }
    `);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
    }
  });

  test('cannot refine sql query', () => {
    const m = new TestTranslator(`
    run: duckdb.sql("SELECT 1 as one") + { limit: 10 }
    `);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toLog(errorMessage('Cannot add view refinements to a source'));
    }
  });

  test('reference to sql expression in join', () => {
    const m = model`
      source: quux is a extend {
        join_one: xyzzy is
          duckdb.sql("""SELECT 1 as one""")
          on ai = xyzzy.one
      }
    `;
    const compileSql = m.translator.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.translator.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
    }
  });

  test('reference to sql expression in run', () => {
    const m = new TestTranslator(`
      run: bigquery.sql("""select 1 as one""")
    `);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
    }
  });

  test('reference to sql expression in query def', () => {
    const m = new TestTranslator(`
      query: q is bigquery.sql("""select 1 as one""")
    `);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
    }
  });

  test('reference to sql expression in anonymous query', () => {
    const m = new TestTranslator(`
      run: bigquery.sql("""select 1 as one""")
    `);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
    }
  });

  test('cannot refine a SQL query saved as a query', () => {
    const m = new TestTranslator(`
      query: q1 is bigquery.sql("""select 1 as one""")
      run: q1 + { where: 1 = 1 }
    `);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toLog(errorMessage('A raw query cannot be refined'));
    }
  });

  test('cannot refine a SQL query directly', () => {
    const m = new TestTranslator(`
      run: bigquery.sql("""select 1 as one""") + { where: 1 = 1 }
    `);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toLog(errorMessage('Cannot add view refinements to a source'));
    }
  });
});

describe('extend and refine', () => {
  describe('extend and refine, new syntax', () => {
    test('query name with query refinements', () => {
      expect(
        `
        query: q is a -> { group_by: ai }
        run: q + { group_by: ai2 is ai }
        `
      ).toTranslate();
    });

    test('query name with source refinements', () => {
      expect(
        `
        query: q is a -> { group_by: ai }
        source: s is q extend { dimension: ai_2 is ai + ai }
        `
      ).toTranslate();
    });

    test('source name with query refinements', () => {
      expect('run: a + { group_by: ai }').toLog(
        errorMessage(
          "Cannot add view refinements to 'a' because it is a source"
        )
      );
    });

    test('source name with source refinements', () => {
      expect(
        'source: s is a extend { dimension: ai_2 is ai + ai }'
      ).toTranslate();
    });

    test('query with source refinements', () => {
      expect(
        'source: s is a -> { group_by: ai } extend { dimension: ai_2 is ai + ai }'
      ).toTranslate();
    });

    test('query with extension then new stage', () => {
      expect(
        'run: a extend { dimension: x is 1 } -> { group_by: x }'
      ).toTranslate();
    });
  });

  describe('extend and refine, old syntax', () => {
    test('query name with query refinements', () => {
      expect(
        `
        query: q is a -> { group_by: ai }
        run: q + { group_by: ai2 is ai }
        `
      ).toTranslate();
    });

    test('query name with source refinements', () => {
      expect(
        `
        query: q is a -> { group_by: ai }
        source: s is q extend { dimension: ai_2 is ai + ai }
        `
      ).toTranslate();
    });

    test('source name with query refinements', () => {
      expect('run: a + { group_by: one }').toLog(
        errorMessage(
          "Cannot add view refinements to 'a' because it is a source"
        )
      );
    });

    test('source name with source refinements', () => {
      expect(
        'source: s is a extend { dimension: ai_2 is ai + ai }'
      ).toTranslate();
    });

    describe('query name with ambiguous refinements', () => {
      test('adding segment to ambuguously refined query', () => {
        expect(`
          ##! -m4warnings
          query: q is a -> { group_by: ai }
          run: q + { join_one: b on 1 = 1 } -> { select: b.* }
        `).toLog(errorMessage("No such field as 'b'"));
        expect(`
          ##! -m4warnings
          query: q is a -> { group_by: ai }
          run: q + { where: 1 = 1 } -> { select: * }
        `).toTranslate();
        expect(`
          ##! -m4warnings
          query: q is a -> { group_by: ai }
          run: q + { declare: three is 3 } -> { select: * }
        `).toTranslate();
      });
      test('automatically recognize this as a query refinement without new stage', () => {
        expect(`
          ##! -m4warnings
          query: q is a -> { group_by: ai }
          run: q + { join_one: b on 1 = 1 }
        `).toTranslate();
        expect(`
          ##! -m4warnings
          query: q is a -> { group_by: ai }
          run: q + { where: 1 = 1 }
        `).toTranslate();
        expect(`
          ##! -m4warnings
          query: q is a -> { group_by: ai }
          run: q + { declare: three is 3 }
        `).toTranslate();
      });
      test('can extend a query into a source', () => {
        expect(`
          query: q is a -> { group_by: ai }
          source: s is q extend { join_one: b on b.ai = ai }
        `).toTranslate();
      });
      test('can also add an arrow to clarify that it is a query', () => {
        // Of course, number 1 and 3 are actually useless because you're defining
        // something and then not using it...
        expect(`
          ##! -m4warnings
          query: q is a -> { group_by: ai }
          run: q + { join_one: b on b.ai = ai } -> { select: * }
        `).toTranslate();
        expect(`
          ##! -m4warnings
          query: q is a -> { group_by: ai }
          run: q + { where: 1 = 1 } -> { select: * }
        `).toTranslate();
        expect(`
          ##! -m4warnings
          query: q is a -> { group_by: ai }
          run: q + { declare: three is 3 } -> { select: * }
        `).toTranslate();
        // Alternatively, fix 1 and 3 by actually using the declared thing
        expect(`
          ##! -m4warnings
          query: q is a -> { group_by: ai }
          run: q + { join_one: b on b.ai = ai; group_by: ai2 is b.ai }
        `).toTranslate();
        expect(`
          ##! -m4warnings
          query: q is a -> { group_by: ai }
          run: q + { extend: {dimension: three is 3} group_by: three }
        `).toTranslate();
      });
    });
  });

  describe('extend and refine fallout', () => {
    test('syntactically valid to run a source, but still illegal', () => {
      expect('run: a').toLog(
        errorMessage("Illegal reference to 'a', query expected")
      );
    });

    test('syntactically valid to refine a source, but illegal', () => {
      expect('run: a + { group_by: ai } ').toLog(
        errorMessage(
          "Cannot add view refinements to 'a' because it is a source"
        )
      );
    });
  });

  describe('turtles', () => {
    test('explicit refine in turtle works', () => {
      expect(`source: c is a extend {
        view: x is { select: * }
        view: y is x + { limit: 1 }
      }`).toTranslate();
    });

    test('implicit refine in turtle works', () => {
      expect(`source: c is a extend {
        view: x is { select: * }
        view: y is x + { limit: 1 }
      }`).toTranslate();
    });
  });

  describe('nests', () => {
    test('explicit refine in nest', () => {
      expect(`source: c is a extend {
        view: x is { select: * }
      }

      run: c -> {
        nest: x + { limit: 1 }
      }`).toTranslate();
    });

    test('refine in nest', () => {
      expect(`source: c is a extend {
        view: x is { select: * }
      }

      run: c -> {
        nest: x + { limit: 1 }
      }`).toTranslate();
    });
  });
});

describe('miscellaneous m4 warnings', () => {
  test('project is deprecated', () => {
    expect(`
      ##! m4warnings=warn
      query: q is a -> { project: * }
    `).toLog(warningMessage('project: keyword is deprecated, use select:'));
  });
  test('query leading arrow', () => {
    expect(`
      ##! m4warnings=warn
      query: x is a -> { select: * }
      run: x
    `).toTranslate();
    expect(`
      ##! m4warnings=warn
      query: x is a -> { select: * }
      run: x -> { select: * }
    `).toTranslate();
  });
});

describe('m3/m4 source query sentences', () => {
  const srcExtend = '{accept:ai}';
  const qryRefine = '{limit:1}';
  const query = '{select:*}';
  // todo MTOY write test to make sure arrow has correct precedence vs +
  // also maybe arrow vs extend
  test('M4 should error on these sq expressions', () => {
    expect(`source: s is a + ${qryRefine}`).toLog(
      errorMessage("Cannot add view refinements to 'a' because it is a source")
    );
    expect(`query: q_m4_err is a + ${qryRefine}`).toLog(
      errorMessage("Cannot add view refinements to 'a' because it is a source")
    );
  });
  test('legal sqexpressions', () => {
    // some things that are m4 warnings are commented out
    expect(`
      source: s is a
      query: q is s -> ${query}

      source: s0 is a;
      // source: s0_extbare is s ${srcExtend};
      // source: s0_extplus is s + ${srcExtend};
      source: s0_ext is s extend ${srcExtend};
      source: qs is q;
      source: qs0 is q extend ${srcExtend};
      source: qs1 is q + ${qryRefine};
      source: s1_m4 is q + ${qryRefine};
      source: s2_m4 is q + ${qryRefine} -> ${query} extend ${srcExtend};
      source: s3 is s extend ${srcExtend};
      source: s4 is q extend ${srcExtend};
      // source: s5 is from(s -> ${query})

      query: q0 is q;
      // query: q0_refbare is q ${qryRefine};
      query: q0_refplus is q + ${qryRefine};
      // query: q1_bare is ab -> aturtle ${qryRefine};
      query: q1_plus is ab -> aturtle + ${qryRefine};
      query: q2 is s -> ${query} extend ${srcExtend} -> ${query};

    `).toTranslate();
  });
});

describe('sql_functions', () => {
  test('can aggregate sql function', () => {
    expect(markSource`
      ##! experimental { sql_functions }
      source: s is a extend {
        measure: c is count()
        dimension: sql_expr is sql_number("LENGTH(\${TABLE}.astr)")
      }
      run: s -> {
        aggregate: v is sql_expr.sum()
      }
    `).toTranslate();
  });
});

test('non breaking space in source', () =>
  expect('source:\u00a0z\u00a0is\u00a0a').toParse());
