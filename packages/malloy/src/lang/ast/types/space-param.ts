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

import {Parameter, TypeDesc} from '../../../model/malloy_types';

import {SpaceEntry} from './space-entry';
import {HasParameter} from '../parameters/has-parameter';

export abstract class SpaceParam extends SpaceEntry {
  abstract parameter(): Parameter;
  readonly refType = 'parameter';
}

export class AbstractParameter extends SpaceParam {
  constructor(readonly astParam: HasParameter) {
    super();
  }

  parameter(): Parameter {
    return this.astParam.parameter();
  }

  typeDesc(): TypeDesc {
    const type = this.astParam.type || 'unknown';
    // TODO Not sure whether params are considered "input space". It seems like they
    // could be input or constant, depending on usage.
    return {dataType: type, expressionType: 'scalar', evalSpace: 'input'};
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
    return {
      dataType: this.paramDef.type,
      expressionType: 'scalar',
      // TODO Not sure whether params are considered "input space". It seems like they
      // could be input or constant, depending on usage (same as above).
      evalSpace: 'input',
    };
  }
}
