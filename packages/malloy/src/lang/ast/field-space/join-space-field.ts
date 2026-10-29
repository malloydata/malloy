/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Join} from '../source-properties/join';
import type {ParameterSpace} from './parameter-space';
import {StructSpaceField} from './static-space';

export class JoinSpaceField extends StructSpaceField {
  constructor(
    readonly parameterSpace: ParameterSpace,
    readonly join: Join,
    forDialect: string,
    forConnection: string
  ) {
    super(join.getStructDef(parameterSpace), forDialect, forConnection);
  }
}
