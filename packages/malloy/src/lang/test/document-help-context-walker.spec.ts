/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MarkedSource} from './test-translator';
import {TestTranslator, markSource} from './test-translator';

function testHelpContext(
  source: MarkedSource,
  position: {line: number; character: number},
  type: 'explore_property' | 'query_property' | 'model_property',
  token: string
) {
  const doc = new TestTranslator(source.code);
  expect(doc.logger.getLog().map(m => m.message)).toEqual([]);
  const helpContext = doc.helpContext(position).helpContext;
  expect(helpContext).toEqual({type, token});
}

const source = `source: foo is DB.table('bar') extend {
  where: bazz ~ 'biff'
  view: foo is {
    group_by: bazz
    where: bop ~ 'blat'
  }
}

query: bar {
  group_by: bazz
}`;

test('Supports model properties', () => {
  testHelpContext(
    markSource`${source}`,
    {line: 0, character: 1},
    'model_property',
    'source:'
  );

  testHelpContext(
    markSource`${source}`,
    {line: 8, character: 1},
    'model_property',
    'query:'
  );
});

test('Supports source properties', () => {
  testHelpContext(
    markSource`${source}`,
    {line: 1, character: 3},
    'explore_property',
    'where:'
  );

  testHelpContext(
    markSource`${source}`,
    {line: 2, character: 3},
    'explore_property',
    'view:'
  );
});

test('Supports query properties', () => {
  testHelpContext(
    markSource`${source}`,
    {line: 3, character: 5},
    'query_property',
    'group_by:'
  );

  testHelpContext(
    markSource`${source}`,
    {line: 4, character: 5},
    'query_property',
    'where:'
  );
});
