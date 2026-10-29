/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ModelEntry} from './model-entry';

export interface NameSpace {
  getEntry(name: string): ModelEntry | undefined;
  setEntry(name: string, value: ModelEntry, exported: boolean): void;
}
