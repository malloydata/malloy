/*
 * Copyright 2023 Google LLC
 * Copyright (c) Meta Platforms, Inc. and affiliates.
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

import {
  Argument,
  InvokedStructRef,
  isCastType,
  isSQLBlockStruct,
  Parameter,
  paramHasValue,
  StructDef,
} from '../../../model/malloy_types';

import {Source} from './source';
import {ErrorFactory} from '../error-factory';
import {castTo} from '../time-utils';
import {ModelEntryReference} from '../types/malloy-element';
import {Argument as HasArgument} from '../parameters/argument';
import {LogSeverity} from '../../parse-log';
import {ExprIdReference} from '../expressions/expr-id-reference';
import {ParameterSpace} from '../field-space/parameter-space';
import {HasParameter} from '../parameters/has-parameter';

export class NamedSource extends Source {
  elementType = 'namedSource';

  constructor(
    readonly ref: ModelEntryReference | string,
    readonly sourceArguments: Record<string, Argument> | undefined,
    readonly args: HasArgument[] | undefined
  ) {
    super();
    if (args) {
      this.has({args});
    }
    if (ref instanceof ModelEntryReference) {
      this.has({ref: ref});
    }
  }

  get refName(): string {
    return this.ref instanceof ModelEntryReference ? this.ref.name : this.ref;
  }

  structRef(parameterSpace: ParameterSpace | undefined): InvokedStructRef {
    const modelEnt = this.modelEntry(this.ref);
    // If we are not exporting the referenced structdef, don't use the reference
    if (modelEnt && !modelEnt.exported) {
      return {
        structRef: this.structDef(parameterSpace),
      };
    }
    return {
      structRef: this.refName,
      sourceArguments: this.evaluateArgumentsForRef(parameterSpace),
    };
  }

  refLog(message: string, severity?: LogSeverity) {
    if (typeof this.ref === 'string') {
      this.log(message, severity);
    } else {
      this.ref.log(message, severity);
    }
  }

  modelStruct(): StructDef | undefined {
    const modelEnt = this.modelEntry(this.ref);
    const entry = modelEnt?.entry;
    if (!entry) {
      const undefMsg = `Undefined source '${this.refName}'`;
      (this.ref instanceof ModelEntryReference ? this.ref : this).log(undefMsg);
      return;
    }
    if (entry.type === 'query') {
      this.log(`Cannot construct a source from a query '${this.refName}'`);
      return;
    } else if (entry.type === 'function') {
      this.log(`Cannot construct a source from a function '${this.refName}'`);
      return;
    } else if (entry.type === 'connection') {
      this.log(`Cannot construct a source from a connection '${this.refName}'`);
      return;
    } else if (isSQLBlockStruct(entry) && entry.declaredSQLBlock) {
      this.log(`Must use 'from_sql()' for sql source '${this.refName}'`);
      return;
    } else {
      this.document()?.checkExperimentalDialect(this, entry.dialect);
    }
    return {...entry};
  }

  private evaluateArgumentsForRef(
    parameterSpace: ParameterSpace | undefined
  ): Record<string, Parameter> {
    const base = this.modelStruct();
    if (base === undefined) {
      return {};
    }

    return this.evaluateArguments(parameterSpace, base.parameters, []);
  }

  private evaluateArguments(
    parameterSpace: ParameterSpace | undefined,
    parametersIn: Record<string, Parameter> | undefined,
    parametersOut: HasParameter[] | undefined
  ): Record<string, Parameter> {
    const outArguments = {...this.sourceArguments};
    const passedNames = new Set();
    for (const argument of this.args ?? []) {
      const id =
        argument.id ??
        (argument.value instanceof ExprIdReference
          ? argument.value.fieldReference
          : undefined);
      if (id === undefined) {
        argument.value.log(
          'Parameterized source arguments must be named with `parameter_name is`'
        );
        continue;
      }
      const name = id.outputName;
      if (passedNames.has(name)) {
        argument.log(`Cannot pass argument for \`${name}\` more than once`);
        continue;
      }
      passedNames.add(name);
      const parameter = (parametersIn ?? {})[name];
      if (!parameter) {
        id.log(
          `\`${this.refName}\` has no declared parameter named \`${id.refString}\``
        );
      } else {
        const paramSpace =
          parameterSpace ?? new ParameterSpace(parametersOut ?? []);
        const pVal = argument.value.getExpression(paramSpace);
        let value = pVal.value;
        if (pVal.dataType !== parameter.type && isCastType(parameter.type)) {
          value = castTo(parameter.type, pVal.value, pVal.dataType, true);
        }
        outArguments[name] = {
          ...parameter,
          value,
        };
      }
    }

    for (const paramName in parametersIn) {
      if (!(paramName in outArguments)) {
        if (!paramHasValue(parametersIn[paramName])) {
          this.refLog(
            `Argument not provided for required parameter \`${paramName}\``
          );
        }
      }
    }

    return outArguments;
  }

  structDef(parameterSpace: ParameterSpace | undefined): StructDef {
    return this.withParameters(parameterSpace, []);
  }

  withParameters(
    parameterSpace: ParameterSpace | undefined,
    pList: HasParameter[] | undefined
  ): StructDef {
    /*
      Can't really generate the callback list until after all the
      things before me are translated, and that kinda screws up
      the translation process, so that might be a better place
      to start the next step, because how that gets done might
      make any code I write which ignores the translation problem
      kind of meaningless.

      Maybe the output of a translation is something which describes
      all the missing data, and then there is a "link" step where you
      can do other translations and link them into a partial translation
      which might result in a full translation.
    */

    const base = this.modelStruct();
    if (!base) {
      const notFound = ErrorFactory.structDef;
      const err = `${this.refName}-undefined`;
      notFound.name = notFound.name + err;
      notFound.dialect = notFound.dialect + err;
      return notFound;
    }

    const outParameters = {};
    for (const parameter of pList ?? []) {
      const compiled = parameter.parameter();
      outParameters[compiled.name] = compiled;
    }

    const outArguments = this.evaluateArguments(
      parameterSpace,
      base.parameters,
      pList,
    );

    const ret = {...base, parameters: outParameters, arguments: outArguments};
    this.document()?.rememberToAddModelAnnotations(ret);
    return ret;
  }
}
