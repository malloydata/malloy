/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Query, SourceDef} from '../../../model/malloy_types';

export interface QueryComp {
  outputStruct: SourceDef;
  query: Query;
  inputStruct: SourceDef;
}
