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

import {Dialect} from '../../../dialect/dialect';
import {StructDef} from '../../../model/malloy_types';

import {LookupResult} from './lookup-result';
import {MalloyElement} from './malloy-element';
import {SpaceEntry} from './space-entry';

/**
 * A FieldSpace is a hierarchy of namespaces, where the leaf nodes
 * are fields. A FieldSpace can lookup fields, and generate a StructDef
 */
export interface FieldSpace {
  type: 'fieldSpace';
  structDef(): StructDef;
  emptyStructDef(): StructDef;
  lookup(symbol: FieldName[]): LookupResult;
  entry(symbol: string): SpaceEntry | undefined;
  entries(): [string, SpaceEntry][];
  dialectObj(): Dialect | undefined;
  whenComplete: (step: () => void) => void;
  isQueryFieldSpace(): this is QueryFieldSpace;
}

export interface QueryFieldSpace extends FieldSpace {
  outputSpace(): FieldSpace;
  inputSpace(): FieldSpace;
}

export class FieldName extends MalloyElement {
  elementType = 'fieldName';

  constructor(readonly name: string) {
    super();
  }

  get refString(): string {
    return this.name;
  }

  override toString(): string {
    return this.refString;
  }

  getField(fs: FieldSpace): LookupResult {
    return fs.lookup([this]);
  }
}
