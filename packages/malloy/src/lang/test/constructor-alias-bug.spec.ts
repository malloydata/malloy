/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import './parse-expects';

// Regression: Object.prototype property names used as field aliases
// must not collide with inherited JS prototype properties.
describe('Object.prototype field name collisions', () => {
  test('constructor as view group_by alias', () => {
    expect(`
      source: x is a extend {
        view: v is {
          group_by: constructor is astr
          aggregate: acount is count()
        }
      }
    `).toTranslate();
  });

  test('toString as dimension alias', () => {
    expect(`
      source: x is a extend {
        dimension: toString is astr
      }
    `).toTranslate();
  });
});
