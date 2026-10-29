/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Options as PoolOptions} from 'generic-pool';

/** Assemble generic-pool options from the registry's pool fields; undefined when none supplied. */
export function buildPoolOptions(config: {
  poolMin?: unknown;
  poolMax?: unknown;
  poolTestOnBorrow?: unknown;
}): PoolOptions | undefined {
  const opts: PoolOptions = {};
  if (typeof config.poolMin === 'number') opts.min = config.poolMin;
  if (typeof config.poolMax === 'number') opts.max = config.poolMax;
  if (typeof config.poolTestOnBorrow === 'boolean') {
    opts.testOnBorrow = config.poolTestOnBorrow;
  }
  return Object.keys(opts).length > 0 ? opts : undefined;
}
