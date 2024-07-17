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
  isCastType,
  isSQLBlockStruct,
  isValueParameter,
  paramHasValue,
  StructDef,
  StructRef,
} from '../../../model/malloy_types';

import {Source} from './source';
import {ErrorFactory} from '../error-factory';
import {castTo} from '../time-utils';
import {ModelEntryReference} from '../types/malloy-element';
import {Argument} from '../parameters/argument';
import {StaticSpace} from '../field-space/static-space';
import {LogSeverity} from '../../parse-log';


export class NamedSource extends Source {
  elementType = 'namedSource';

  constructor(
    readonly ref: ModelEntryReference | string,
    readonly args: Argument[] | undefined = undefined
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

  structRef(): StructRef {
    if (this.args !== undefined) {
      return this.structDef();
    }
    const modelEnt = this.modelEntry(this.ref);
    if (modelEnt && !modelEnt.exported) {
      // If we are not exporting the referenced structdef, don't
      // use the reference
      return this.structDef();
    }
    return this.refName;
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

  structDef(): StructDef {
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
    // Clone parameters to not mutate
    const parameters = {};
    for (const paramName in base.parameters) {
      parameters[paramName] = {...base.parameters[paramName]};
    }

    const passedNames = new Set();
    for (const argument of this.args ?? []) {
      if (argument.id === undefined) {
        argument.value.log(
          'Parameterized source arguments must be named with `parameter_name is`'
        );
        continue;
      }
      if (passedNames.has(argument.id.refString)) {
        argument.log(
          `Cannot pass argument for \`${argument.id.refString}\` more than once`
        );
        continue;
      }
      passedNames.add(argument.id.refString);
      const decl = parameters[argument.id.refString];
      if (!decl) {
        argument.id.log(
          `\`${this.refName}\` has no declared parameter named \`${argument.id.refString}\``
        );
      } else {
        if (isValueParameter(decl)) {
          // TODO probably make this constant for now, or use ConstantSubExpression here instead, or figure out a way to
          // correctly handle parameter/argument circularity??
          const fs = new StaticSpace(base);
          const pVal = argument.value.getExpression(fs);
          let value = pVal.value;
          if (pVal.dataType !== decl.type && isCastType(decl.type)) {
            value = castTo(decl.type, pVal.value, pVal.dataType, true);
          }
          decl.value = value;
        } else {
          throw new Error('UNIMPLEMENTED'); // TODO remove need for this branch?
        }
      }
    }
    for (const checkDef in parameters) {
      if (!paramHasValue(parameters[checkDef])) {
        this.refLog(
          `Argument not provided for required parameter \`${checkDef}\``
        );
      }
    }
    const ret = {...base, parameters};
    this.document()?.rememberToAddModelAnnotations(ret);
    return ret;
  }
}
