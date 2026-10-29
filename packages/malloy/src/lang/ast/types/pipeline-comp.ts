/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AnnotationsDef,
  PipeSegment,
  SourceDef,
} from '../../../model/malloy_types';

export interface PipelineComp {
  outputStruct: SourceDef;
  pipeline: PipeSegment[];
  annotations?: AnnotationsDef;
  name?: string;
}
