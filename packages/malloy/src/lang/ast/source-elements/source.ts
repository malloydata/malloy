/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  InvokedStructRef,
  Parameter,
  SourceDef,
} from '../../../model/malloy_types';
import {mkSafeRecord} from '../../../model/malloy_types';
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
    const parameters = mkSafeRecord<Parameter>();
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
