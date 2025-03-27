/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {inspect} from 'util';

import {Segment} from '../../model/malloy_query';
import type {
  FieldDef,
  PipeSegment,
  SourceDef,
  StructDef,
} from '../../model/malloy_types';
import {
  isPartialSegment,
  isSourceDef,
  segmentHasErrors,
  structHasErrors,
} from '../../model/malloy_types';

import {ErrorFactory} from './error-factory';
import type {MalloyElement} from './types/malloy-element';

export function opOutputStruct(
  logTo: MalloyElement,
  inputStruct: SourceDef,
  opDesc: PipeSegment
): SourceDef {
  const badModel =
    ErrorFactory.didCreate(inputStruct) || structHasErrors(inputStruct);
  // We don't want to expose partial segments to the compiler
  if (isPartialSegment(opDesc)) {
    opDesc = {...opDesc, type: 'reduce'};
  }
  const badOpDesc = segmentHasErrors(opDesc);
  // Don't call into the model code with a broken model
  if (!badModel && !badOpDesc) {
    try {
      const pipeOutputStruct = Segment.nextStructDef(inputStruct, opDesc);
      if (isSourceDef(pipeOutputStruct)) {
        return pipeOutputStruct;
      }
      // Inconcievable, a pipe deosnt output a record or an array
      logTo.logError(
        'failed-to-compute-output-schema',
        'INTERNAL ERROR model/Segment.nextStructDef: RETURNED A NON SOURCE\n' +
          `STRUCTDEF: ${inspect(pipeOutputStruct, {
            breakLength: 72,
            depth: Infinity,
          })}`
      );
    } catch (e) {
      logTo.logError(
        'failed-to-compute-output-schema',
        `INTERNAL ERROR model/Segment.nextStructDef: ${e.message}\n` +
          `QUERY: ${inspect(opDesc, {breakLength: 72, depth: Infinity})}`
      );
    }
  }
  return ErrorFactory.structDef;
}

export function getFinalStruct(
  logTo: MalloyElement,
  walkStruct: SourceDef,
  pipeline: PipeSegment[]
): SourceDef {
  for (const modelQop of pipeline) {
    walkStruct = opOutputStruct(logTo, walkStruct, modelQop);
  }
  return walkStruct;
}

export function getStructFieldDef(
  s: StructDef,
  fn: string
): FieldDef | undefined {
  return s.fields.find(fld => (fld.as || fld.name) === fn);
}
