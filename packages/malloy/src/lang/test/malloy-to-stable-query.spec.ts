/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {malloyToQuery} from '../malloy-to-stable-query';
import * as Malloy from '@malloydata/malloy-interfaces';

type QueryAndLogs = {query: Malloy.Query; logs: Malloy.LogMessage[]};

describe('Malloy to Stable Query', () => {
  test('basic', () => {
    const result = malloyToQuery('run: flights -> { group_by: carrier }');
    const expected: QueryAndLogs = {
      query: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'group_by',
                field: {
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
                },
              },
            ],
          },
        },
      },
      logs: [],
    };
    expect(result).toMatchObject(expected);
  });
});
