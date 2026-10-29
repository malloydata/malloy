/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {JoinFieldDef, TypeDesc} from '../../../model/malloy_types';
import {activeName, isSourceDef} from '../../../model/malloy_types';
import * as TDU from '../typedesc-utils';
import type {FieldSpace} from '../types/field-space';
import type {JoinPathElement} from '../types/lookup-result';
import {SpaceField} from '../types/space-field';

export abstract class StructSpaceFieldBase extends SpaceField {
  constructor(protected structDef: JoinFieldDef) {
    super();
  }

  abstract get fieldSpace(): FieldSpace;

  fieldDef(): JoinFieldDef {
    return this.structDef;
  }

  get joinPathElement(): JoinPathElement {
    return {
      name: activeName(this.structDef),
      joinType: this.structDef.join,
      joinElementType: this.structDef.type,
    };
  }

  typeDesc(): TypeDesc {
    if (isSourceDef(this.structDef)) {
      return {
        type: this.structDef.type,
        evalSpace: 'input',
        expressionType: 'scalar',
        refSummary: this.structDef.refSummary,
      };
    }
    return {
      ...TDU.atomicDef(this.structDef),
      evalSpace: 'input',
      expressionType: 'scalar',
      refSummary: this.structDef.refSummary,
    };
  }
}
