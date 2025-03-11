/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {nestUnions} from './nest_unions';
import * as Malloy from './types';

describe('unnest unions', () => {
  test('works', () => {
    const query: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
            {
              kind: 'limit',
              limit: 10,
            },
          ],
        },
      },
    };
    expect(nestUnions(query)).toMatchObject({
      definition: {
        arrow: {
          source: {
            source_reference: {
              name: 'flights',
            },
          },
          view: {
            segment: {
              operations: [
                {
                  group_by: {
                    field: {
                      expression: {
                        field_reference: {name: 'carrier'},
                      },
                    },
                  },
                },
                {
                  limit: {limit: 10},
                },
              ],
            },
          },
        },
      },
    });
  });
});
