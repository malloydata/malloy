/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {markSource} from './test-translator';
import './parse-expects';

describe('error recovery', () => {
  test('missing extend recovery', () => {
    expect(markSource`
      source: foo is a ${'{'}
        where: 1 = 1
      }
    `).translationToFailWith(
      'Missing `extend` between source expression and source extension'
    );
  });
  test.skip('missing name recovery', () => {
    expect(markSource`
      run: flights -> {
        group_by: 1
      }
    `).translationToFailWith(
      'Enable experiment `aggregate_order_by` to use `order_by` with an aggregate function'
    );
  });
});
