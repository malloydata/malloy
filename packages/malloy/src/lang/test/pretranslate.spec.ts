/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import './parse-expects';
import {TestTranslator} from './test-translator';

describe('pretranslated models', () => {
  test('import of pretranslated', () => {
    const docParse = new TestTranslator('import "child"');
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toEqual({urls: ['internal://test/langtests/child']});
    docParse.update({
      translations: {
        'internal://test/langtests/child': {
          name: 'child',
          exports: ['foo'],
          queryList: [],
          contents: {
            foo: {
              type: 'table',
              tablePath: 'foo',
              connection: 'duckdb',
              dialect: 'duckdb',
              name: 'foo',
              fields: [],
            },
          },
        },
      },
    });
    expect(docParse).toTranslate();
    const foo = docParse.getSourceDef('foo');
    expect(foo).toBeDefined();
  });
});
