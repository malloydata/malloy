/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {PipeSegment} from '../../../model/malloy_types';
import type {SourceFieldSpace} from './field-space';

export interface OpDesc {
  segment: PipeSegment;
  outputSpace: SourceFieldSpace;
}
