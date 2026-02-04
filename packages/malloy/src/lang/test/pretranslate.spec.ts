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
    expect(xr).toMatchObject({urls: ['internal://test/langtests/child']});
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
          sourceRegistry: {},
          dependencies: {
            'internal://test/langtests/grandchild': {
              'internal://test/langtests/grandgrandchild1': {},
              'internal://test/langtests/grandgrandchild2': {},
            },
          },
        },
      },
    });
    expect(docParse).toTranslate();
    const foo = docParse.getSourceDef('foo');
    expect(foo).toBeDefined();
    const translated = docParse.translate();
    expect(translated.modelDef?.dependencies).toMatchObject({
      'internal://test/langtests/child': {
        'internal://test/langtests/grandchild': {
          'internal://test/langtests/grandgrandchild1': {},
          'internal://test/langtests/grandgrandchild2': {},
        },
      },
    });
    const newDependencies = docParse.newlyTranslatedDependencies();
    expect(newDependencies).toMatchObject([]);
    expect(translated.fromSources).toEqual([
      'internal://test/langtests/root.malloy',
      'internal://test/langtests/child',
      'internal://test/langtests/grandchild',
      'internal://test/langtests/grandgrandchild1',
      'internal://test/langtests/grandgrandchild2',
    ]);
    const child = docParse.translatorForDependency(
      'internal://test/langtests/child'
    );
    const childTranslated = child!.translate();
    expect(childTranslated.modelDef?.dependencies).toMatchObject({
      'internal://test/langtests/grandchild': {
        'internal://test/langtests/grandgrandchild1': {},
        'internal://test/langtests/grandgrandchild2': {},
      },
    });
    expect(childTranslated.fromSources).toEqual([
      'internal://test/langtests/child',
      'internal://test/langtests/grandchild',
      'internal://test/langtests/grandgrandchild1',
      'internal://test/langtests/grandgrandchild2',
    ]);
  });
});
