/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {PipeSegment} from '../../../model';
import {isQuerySegment} from '../../../model';
import {ReduceBuilder} from './reduce-builder';

export class PartialBuilder extends ReduceBuilder {
  finalize(fromSeg: PipeSegment | undefined): PipeSegment {
    const seg = super.finalize(fromSeg);
    if (isQuerySegment(seg)) {
      return {...seg, type: 'partial'};
    }
    // TODO index, raw, ??
    throw new Error(`Partial Builder cannot finalize from ${seg.type}`);
  }
}
