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

import type {FilterableType} from '@malloydata/malloy-filter';
import type {Parameter, ParameterType} from '../../../model/malloy_types';
import {isCastType, isParameterType} from '../../../model/malloy_types';

import type {ConstantExpression} from '../expressions/constant-expression';
import {MalloyElement} from '../types/malloy-element';
import {checkFilterExpression} from '../types/expression-def';

interface HasInit {
  name: string;
  type?: ParameterType;
  filterType?: FilterableType;
  default?: ConstantExpression;
}

export class HasParameter extends MalloyElement {
  elementType = 'hasParameter';
  readonly name: string;
  readonly type?: ParameterType;
  readonly default?: ConstantExpression;
  readonly filterType?: FilterableType;

  constructor(init: HasInit) {
    super();
    this.name = init.name;
    if (init.type && isParameterType(init.type)) {
      this.type = init.type;
    }
    if (init.default) {
      this.default = init.default;
      this.has({default: this.default});
    }
    if (init.filterType) this.filterType = init.filterType;
  }

  parameter(): Parameter {
    let paramReturn: Parameter;
    if (this.default !== undefined) {
      const constant = this.default.constantValue();
      if (
        this.type &&
        this.type !== constant.type &&
        constant.type !== 'null' &&
        constant.type !== 'error'
      ) {
        this.default.logError(
          'parameter-default-does-not-match-declared-type',
          `Default value for parameter does not match declared type \`${this.type}\``
        );
      }
      if (constant.type === 'null') {
        if (this.type) {
          return {
            type: this.type,
            value: constant.value,
            name: this.name,
          };
        } else {
          this.default.logError(
            'parameter-null-default-without-declared-type',
            'Default value cannot have type `null` unless parameter type is also specified'
          );
          return {
            value: constant.value,
            name: this.name,
            type: 'error',
          };
        }
      }
      if (constant.type === 'filter expression') {
        if (this.type !== 'filter expression') {
          this.logError(
            'parameter-missing-default-or-type',
            `Filter expression parameters must have expicit filter type, for example '${this.name}::filter<string>'`
          );
        }
        if (this.filterType) {
          checkFilterExpression(this, this.filterType, constant.value);
        }
        return {
          value: constant.value,
          name: this.name,
          type: constant.type,
        };
      }
      if (!isCastType(constant.type) && constant.type !== 'error') {
        this.default.logError(
          'parameter-illegal-default-type',
          `Default value cannot have type \`${constant.type}\``
        );
        return {
          value: constant.value,
          name: this.name,
          type: 'error',
        };
      }

      paramReturn = {
        value: constant.value,
        name: this.name,
        type: constant.type,
      };
    } else {
      if (this.type === undefined) {
        this.logError(
          'parameter-missing-default-or-type',
          'Parameter must have default value or declared type'
        );
      }
      paramReturn = {value: null, name: this.name, type: this.type ?? 'error'};
    }
    if (paramReturn.type === 'filter expression' && this.filterType) {
      paramReturn.filterType = this.filterType;
    }
    return paramReturn;
  }
}
