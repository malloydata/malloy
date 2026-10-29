/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {generateHash} from './utils';

describe('model/utils', () => {
  it('should generate deterministic hashes', () => {
    const hash1 = generateHash('test-content');
    expect(hash1).toEqual('ab17568f-0362-503d-a9c6-76fb0b203636');
  });
  it('should generate unique hashes', () => {
    const hash1 = generateHash('test-content');
    const hash2 = generateHash('test-content-different');
    expect(hash1).not.toEqual(hash2);
  });
});
