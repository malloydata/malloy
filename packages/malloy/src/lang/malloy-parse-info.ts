/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ParseInfo} from './utils';

export interface MalloyParseInfo extends ParseInfo {
  importBaseURL: string;
}
