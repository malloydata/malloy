/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {smoke} from './consumer';

// Run under jest.config.ts here (a plain ts-jest config, no babel transform), so
// loading the consumer fails if any published @malloydata runtime dep is ESM-only.
describe('consumer-contract canary', () => {
  it('loads @malloydata/malloy + all connectors and runs a DuckDB query', async () => {
    await expect(smoke()).resolves.toBe(1);
  }, 60000);
});
