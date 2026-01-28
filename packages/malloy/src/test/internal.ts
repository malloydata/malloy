/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Internal exports for testing purposes only.
 *
 * This module exposes internal implementation details that are needed by
 * tests in the monorepo but should NOT be considered part of the public API.
 * These exports may change or be removed without notice.
 *
 * If you find yourself importing from this module outside of tests,
 * please file an issue to discuss adding a proper public API.
 */

export {buildInternalGraph} from '../model/persist_utils';
export type {
  InternalBuildGraph,
  InternalBuildNode,
} from '../model/persist_utils';
