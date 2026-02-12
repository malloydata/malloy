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

import type {
  InvokedStructRef,
  Parameter,
  SourceDef,
} from '../../../model/malloy_types';
import {MalloyElement} from '../types/malloy-element';
import type {HasParameter} from '../parameters/has-parameter';
import type {ParameterSpace} from '../field-space/parameter-space';

/**
 * A "Source" is a thing which you can run queries against. The main
 * function of a source is to represent an eventual StructDef
 */
export abstract class Source extends MalloyElement {
  abstract getSourceDef(parameterSpace: ParameterSpace | undefined): SourceDef;

  structRef(parameterSpace: ParameterSpace | undefined): InvokedStructRef {
    return {
      structRef: this.getSourceDef(parameterSpace),
    };
  }

  protected packParameters(
    pList: HasParameter[] | undefined
  ): Record<string, Parameter> | undefined {
    if (pList === undefined) return undefined;
    const parameters: Record<string, Parameter> = Object.create(null);
    for (const hasP of pList) {
      const pVal = hasP.parameter();
      parameters[pVal.name] = pVal;
    }
    return parameters;
  }

  withParameters(
    parameterSpace: ParameterSpace | undefined,
    pList: HasParameter[] | undefined
  ): SourceDef {
    const before = this.getSourceDef(parameterSpace);
    return {
      ...before,
      parameters: this.packParameters(pList),
    };
  }
}
