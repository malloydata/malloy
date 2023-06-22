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

import {DialectFunctionOverloadDef} from './util';

type Thunk<T> = () => T;

export class FunctionMap {
  private functions: Map<string, DialectFunctionOverloadDef[]> = new Map();
  private getters: Map<string, Thunk<DialectFunctionOverloadDef[]>>;
  private sealed = false;

  constructor(getters?: Map<string, Thunk<DialectFunctionOverloadDef[]>>) {
    this.getters = getters ?? new Map();
  }

  clone(): FunctionMap {
    return new FunctionMap(new Map(this.getters));
  }

  add(name: string, getter: Thunk<DialectFunctionOverloadDef[]>) {
    this.ensureNotSealed();
    this.getters.set(name, getter);
  }

  get(name: string): DialectFunctionOverloadDef[] | undefined {
    this.ensureSealed();
    const ready = this.functions.get(name);
    if (ready) return ready;
    const getter = this.getters.get(name);
    if (getter === undefined) {
      return undefined;
    }
    const func = getter();
    this.functions.set(name, func);
    return func;
  }

  delete(name: string): void {
    this.ensureNotSealed();
    this.functions.delete(name);
    this.getters.delete(name);
  }

  seal() {
    this.sealed = true;
  }

  private ensureNotSealed() {
    if (this.sealed) {
      throw new Error('Cannot update sealed FunctionMap');
    }
  }

  private ensureSealed() {
    if (!this.sealed) {
      throw new Error('Cannot get from unsealed FunctionMap');
    }
  }
}
