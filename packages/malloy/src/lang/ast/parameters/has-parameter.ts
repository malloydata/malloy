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
  Parameter,
  ParameterType,
  ParameterTypeDef,
} from '../../../model/malloy_types';
import {isParameterType} from '../../../model/malloy_types';

import type {ConstantExpression} from '../expressions/constant-expression';
import {MalloyElement} from '../types/malloy-element';
import {checkFilterExpression} from '../types/expression-def';

interface HasInit {
  name: string;
  typeDef?: ParameterTypeDef;
  default?: ConstantExpression;
}

export class HasParameter extends MalloyElement {
  elementType = 'hasParameter';
  readonly name: string;
  readonly typeDef?: ParameterTypeDef;
  readonly default?: ConstantExpression;

  constructor(init: HasInit) {
    super();
    this.name = init.name;
    if (init.typeDef) {
      this.typeDef = init.typeDef;
    }
    if (init.default) {
      this.default = init.default;
      this.has({default: this.default});
    }
  }

  private get type(): ParameterType | undefined {
    return this.typeDef?.type;
  }

  parameter(): Parameter {
    const paramReturn: Parameter = {
      ...(this.typeDef || {type: 'error'}),
      value: null,
      name: this.name,
    };
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
            ...paramReturn,
            value: constant.value,
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
        if (this.typeDef?.type !== 'filter expression') {
          this.logError(
            'parameter-missing-default-or-type',
            `Filter expression parameters must have expicit filter type, for example '${this.name}::filter<string>'`
          );
          return {...paramReturn, type: 'error'};
        }
        checkFilterExpression(this, this.typeDef.filterType, constant.value);
        return {
          type: 'filter expression',
          filterType: this.typeDef.filterType,
          name: this.name,
          value: constant.value,
        };
      }
      if (!isParameterType(constant.type)) {
        this.default.logError(
          'parameter-illegal-default-type',
          `Default value cannot have type \`${constant.type}\``
        );
        return {
          ...paramReturn,
          type: 'error',
        };
      }
      paramReturn.type = constant.type;
      paramReturn.value = constant.value;
    } else {
      if (this.type === undefined) {
        this.logError(
          'parameter-missing-default-or-type',
          'Parameter must have default value or declared type'
        );
        paramReturn.type = 'error';
      }
    }
    return paramReturn;
  }
}
