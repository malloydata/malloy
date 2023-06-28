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

import {Annotation, StructDef} from '../../../model/malloy_types';
import {ModelDataRequest} from '../../translate-response';

import {ErrorFactory} from '../error-factory';
import {HasParameter} from '../parameters/has-parameter';
import {SQLSource} from '../sources/sql-source';
import {
  DocStatement,
  Document,
  MalloyElement,
  RunList,
} from '../types/malloy-element';
import {Noteable, extendNoteMethod} from '../types/noteable';

import {Source} from './source';

export class DefineSource
  extends MalloyElement
  implements DocStatement, Noteable
{
  elementType = 'defineSource';
  readonly parameters?: HasParameter[];
  constructor(
    readonly name: string,
    readonly theSource: Source,
    readonly exported: boolean,
    params?: MalloyElement[]
  ) {
    super({explore: theSource});
    if (params) {
      this.parameters = [];
      for (const el of params) {
        if (el instanceof HasParameter) {
          this.parameters.push(el);
        } else {
          this.log(
            `Unexpected element type in define statement: ${el.elementType}`
          );
        }
      }
      this.has({parameters: this.parameters});
    }
  }
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;

  execute(doc: Document): ModelDataRequest {
    if (doc.modelEntry(this.name)) {
      this.log(`Cannot redefine '${this.name}'`);
    } else {
      // TODO this whole if statement should be removed eventually. This
      // is a special case to compile SQL queries when they are written
      // `source: my_sql is conn.sql("""SELECT * FROM table""")`. Once
      // we implement some solution that allows for runtime needs to be
      // known ahead of time, we can remove this.
      if (this.theSource instanceof SQLSource) {
        const needs = this.theSource.needs(doc);
        if (needs) return needs;
      }
      const structDef = this.theSource.withParameters(this.parameters);
      if (ErrorFactory.isErrorStructDef(structDef)) {
        return;
      }
      const entry: StructDef = {
        ...structDef,
        as: this.name,
        location: this.location,
      };
      if (this.note) {
        entry.annotation = structDef.annotation
          ? {...this.note, inherits: structDef.annotation}
          : this.note;
      }
      doc.setEntry(this.name, {entry, exported: this.exported});
    }
  }
}

export class DefineSourceList extends RunList implements DocStatement {
  elementType = 'defineSources';
  constructor(sourceList: DefineSource[]) {
    super(sourceList);
  }

  execute(doc: Document): ModelDataRequest {
    return this.executeList(doc);
  }
}
