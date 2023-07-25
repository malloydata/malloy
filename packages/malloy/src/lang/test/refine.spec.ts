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

import './parse-expects';
import {markSource, model} from './test-translator';

describe('refinement location rules', () => {
  test('where clauses go into the first segment', () => {
    const doc = model`
        query: refineme is a -> { project: stage is "stage1" } -> { project: stage is "stage2" }
        query: checkme is refineme refine { where: astr = 'a' }`;
    expect(doc).toTranslate();
    const checkme = doc.translator.getQuery('checkme');
    expect(checkme).toBeDefined();
    if (checkme) {
      const whereClause = checkme.pipeline[0].filterList;
      expect(whereClause).toBeDefined();
      if (whereClause) {
        expect(whereClause.length).toBe(1);
      }
    }
  });
  test('having clauses go into the last segment', () => {
    const doc = model`
      query: refineme is a -> { group_by: ai,astr  } -> { group_by: ai, aggregate: ac is count() }
      query: checkme is refineme refine { having: ac > 0 }`;
    expect(doc).toTranslate();
    const checkme = doc.translator.getQuery('checkme');
    expect(checkme).toBeDefined();
    if (checkme) {
      const havingClause = checkme.pipeline[1].filterList;
      expect(havingClause).toBeDefined();
      if (havingClause) {
        expect(havingClause.length).toBe(1);
      }
    }
  });
  test('limit goes into the last segment', () => {
    const doc = model`
      query: refineme is a -> { group_by: ai,astr  } -> { group_by: ai, aggregate: ac is count() }
      query: checkme is refineme refine { limit: 1 }`;
    expect(doc).toTranslate();
    const checkme = doc.translator.getQuery('checkme');
    expect(checkme).toBeDefined();
    if (checkme) {
      expect(checkme.pipeline[1]).toMatchObject({limit: 1});
    }
  });
  test('order_by goes into the last segment', () => {
    const doc = model`
      query: refineme is a -> { group_by: ai,astr  } -> { group_by: ai, aggregate: ac is count() }
      query: checkme is refineme refine { order_by: 2 }`;
    expect(doc).toTranslate();
    const checkme = doc.translator.getQuery('checkme');
    expect(checkme).toBeDefined();
    if (checkme) {
      expect(checkme.pipeline[1]).toHaveProperty('orderBy');
    }
  });

  const stageErr = 'Illegal in refinement of a query with more than one stage';
  test('group_by illegal in long pipes', () => {
    expect(
      markSource`query: refineme is a -> { project: stage is "stage1" } -> { project: stage is "stage2" }
       query: checkme is refineme refine { ${'group_by: stage'} }`
    ).translationToFailWith(stageErr);
  });
  test('aggregate illegal in long pipes', () => {
    expect(
      markSource`query: refineme is a -> { project: stage is "stage1" } -> { project: stage is "stage2" }
       query: checkme is refineme refine { ${'aggregate: c is count()'} }`
    ).translationToFailWith(stageErr);
  });
  test('calcluate illegal in long pipes', () => {
    expect(
      markSource`query: refineme is a -> { project: stage is "stage1" } -> { project: stage is "stage2" }
       query: checkme is refineme refine { ${'calculate: c is count()'} }`
    ).translationToFailWith(stageErr);
  });
  test('extend illegal in long pipes', () => {
    expect(
      markSource`query: refineme is a -> { project: stage is "stage1" } -> { project: stage is "stage2" }
       query: checkme is refineme refine { ${'extend: {measure: c is count()}'} }`
    ).translationToFailWith(stageErr);
  });
  test('nest illegal in long pipes', () => {
    expect(
      markSource`query: refineme is a -> { project: stage is "stage1" } -> { project: stage is "stage2" }
       query: checkme is refineme refine { ${'nest: b is {group_by: stage}'} }`
    ).translationToFailWith(stageErr);
  });
  test('all single stage refinements are accepted', () => {
    expect(
      markSource`query: refineme is a -> { group_by: stage is "stage1" }
       query: checkme is refineme refine {
         extend: { dimension: red is 'red' }
         nest: nestRed is { group_by: red }
         group_by: ai
         aggregate: counted is count()
         calculate: l is lag(ai)
       }`
    ).toTranslate();
  });
});

// MTOY TODO delete this when you fix generateSQLJoins in malloy-query
test('and now this', () => {
  const docOK = model`
  source: airports is a extend {
    query: by_region is
      { group_by: faa_region is astr }
    query: by_region2 is by_region
      refine {
        nest: add_state is
          { group_by: state is astr }
      }
      ->
      { project: faa_region, add_state.state }
  }`;
  expect(docOK).toTranslate();

  const docOldBad = model`
  source: airports is a extend {
    query: by_region is
      { group_by: faa_region is astr }
    query: by_region2 is by_region
      refine {
        nest: add_state is
          { group_by: state is astr }
          ->
          { project: faa_region, add_state.state }
      }
  }`;
  expect(docOldBad).translationToFailWith(
    "'faa_region' is not defined",
    "'add_state' is not defined"
  );

  const docNewBad = model`
  source: airports is a extend {
    query: by_region is
      { group_by: faa_region is astr }
    query: by_region2 is by_region
      refine (
        nest add_state is
          ( group_by: state is astr
          ->
          select faa_region, add_state.state)
      )
  }`;
  expect(docNewBad).translationToFailWith(
    "'faa_region' is not defined",
    "'add_state' is not defined"
  );
});
