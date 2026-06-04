/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {type Parameter, type TypeDesc} from '../../../model/malloy_types';

import {SpaceEntry} from './space-entry';
import type {HasParameter} from '../parameters/has-parameter';
import * as TDU from '../typedesc-utils';

export abstract class SpaceParam extends SpaceEntry {
  abstract parameter(): Parameter;
  readonly refType = 'parameter';
}

export class AbstractParameter extends SpaceParam {
  constructor(readonly astParam: HasParameter) {
    super();
  }

  _parameter: Parameter | undefined = undefined;
  parameter(): Parameter {
    if (this._parameter !== undefined) return this._parameter;
    this._parameter = this.astParam.parameter();
    return this._parameter;
  }

  typeDesc(): TypeDesc {
    return TDU.parameterTypeDesc(this.parameter(), 'constant');
  }
}

export class DefinedParameter extends SpaceParam {
  constructor(readonly paramDef: Parameter) {
    super();
  }

  parameter(): Parameter {
    return this.paramDef;
  }

  typeDesc(): TypeDesc {
    // TODO Not sure whether params are considered "input space". It seems like they
    // could be input or constant, depending on usage (same as above).
    return TDU.parameterTypeDesc(this.parameter(), 'input');
  }
}
