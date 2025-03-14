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
  Argument,
  InvokedStructRef,
  SourceDef,
  StructRef,
} from '../../../model/malloy_types';
import {refIsStructDef} from '../../../model/malloy_types';

import {Source} from '../source-elements/source';
import {NamedSource} from '../source-elements/named-source';
import type {ParameterSpace} from '../field-space/parameter-space';

export class QueryHeadStruct extends Source {
  elementType = 'internalOnlyQueryHead';
  constructor(
    readonly fromRef: StructRef,
    readonly sourceArguments: Record<string, Argument> | undefined
  ) {
    super();
  }

  structRef(): InvokedStructRef {
    return {structRef: this.fromRef};
  }

  getSourceDef(parameterSpace: ParameterSpace | undefined): SourceDef {
    if (refIsStructDef(this.fromRef)) {
      return this.fromRef;
    }
    const ns = new NamedSource(this.fromRef, this.sourceArguments, undefined);
    this.has({exploreReference: ns});
    return ns.getSourceDef(parameterSpace);
  }
}
