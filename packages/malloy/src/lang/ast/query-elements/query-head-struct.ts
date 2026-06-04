/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
