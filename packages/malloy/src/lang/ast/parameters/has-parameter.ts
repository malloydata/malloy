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

import {Parameter, CastType, isCastType} from '../../../model/malloy_types';

import {ConstantExpression} from '../expressions/constant-expression';
import {MalloyElement} from '../types/malloy-element';

interface HasInit {
  name: string;
  isCondition: boolean;
  type?: string;
  default?: ConstantExpression;
}

export class HasParameter extends MalloyElement {
  elementType = 'hasParameter';
  readonly name: string;
  readonly isCondition: boolean;
  readonly type?: CastType;
  readonly default?: ConstantExpression;

  constructor(init: HasInit) {
    super();
    this.name = init.name;
    this.isCondition = init.isCondition;
    if (init.type && isCastType(init.type)) {
      this.type = init.type;
    }
    if (init.default) {
      this.default = init.default;
      this.has({default: this.default});
    }
  }

  parameter(): Parameter {
    if (this.default !== undefined) {
      const constant = this.default.constantValue();
      if (this.type && this.type !== constant.dataType && constant.dataType !== 'error') {
        this.default.log(`Default value for parameter does not match declared type \`${this.type}\``);
      }
      if (!isCastType(constant.dataType) && constant.dataType !== 'error') {
        this.default.log(`Default value cannot have type \`${constant.dataType}\``);
        return {
          value: constant.value,
          name: this.name,
          type: 'error',
          constant: true, // TODO remove condition parameter type
        }
      }
      return {
        value: constant.value,
        name: this.name,
        type: constant.dataType,
        constant: true,
      }
    }
    if (this.type === undefined) {
      this.log("Parameter must have default value or declared type");
    }
    return {
      value: null,
      name: this.name,
      type: this.type ?? 'error',
      constant: true
    }
  }
}
