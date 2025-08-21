/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {model} from './test-translator';
import './parse-expects';

describe('Query expandedGrouping', () => {
  test('ungroupings at top level', () => {
    const q = model`
      run: ab -> {
        group_by: astr
        aggregate:
          all_c is all(acount)
          exclude_astr is exclude(acount, astr)
    }`;
    expect(q).toTranslate();
    const qSeg = q.translator.getQuery(0)?.pipeline[0];
    expect(qSeg).toBeDefined();
    if (qSeg && qSeg.type === 'reduce') {
      expect(qSeg.expandedUngroupings).toMatchObject([
        {
          exclude: false,
          path: [],
          refFields: undefined,
        },
        {
          exclude: true,
          refFields: ['astr'],
          path: [],
        },
      ]);
    }
  });

  test('ungroupings inside a nest', () => {
    const q = model`
    run: ab -> {
      group_by: astr
      aggregate: acount
      nest: nested_view is {
        group_by: ai
        aggregate:
          nested_c is acount
          nested_all is all(acount)
          nested_exclude is exclude(acount, ai)
      }
    }`;
    expect(q).toTranslate();
    const qSeg = q.translator.getQuery(0)?.pipeline[0];
    expect(qSeg).toBeDefined();
    if (qSeg && qSeg.type === 'reduce') {
      expect(qSeg.expandedUngroupings).toMatchObject([
        {
          exclude: false,
          path: ['nested_view'],
        },
        {
          exclude: true,
          refFields: ['ai'],
          path: ['nested_view'],
        },
      ]);
    }
  });
});
