/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {NamedModelObject} from '../../../model/malloy_types';

export interface ModelEntry {
  entry: NamedModelObject;
  exported?: boolean;
}
