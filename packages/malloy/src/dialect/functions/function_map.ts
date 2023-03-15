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
    return new FunctionMap(this.getters);
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
