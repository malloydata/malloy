/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ModelDef} from '../../../model/malloy_types';

import type {ModelDataRequest} from '../../translate-response';

export interface DocumentCompileResult {
  modelDef: ModelDef;
  needs: ModelDataRequest;
  modelWasModified: boolean;
}
