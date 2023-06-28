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

import {
  StructDef,
  StructRef,
  SQLBlockSource,
} from '../../../model/malloy_types';
import {makeSQLBlock} from '../../../model/sql_block';
import {NeedCompileSQL} from '../../translate-response';
import {Source} from '../elements/source';
import {ErrorFactory} from '../error-factory';
import {SQLString} from '../sql-elements/sql-string';
import {ModelEntryReference, Document} from '../types/malloy-element';

export class SQLSource extends Source {
  elementType = 'sqlSource';
  requestBlock?: SQLBlockSource;
  private connectionNameInvalid = false;
  constructor(
    readonly connectionName: ModelEntryReference,
    readonly select: SQLString
  ) {
    super();
    this.has({connectionName, select});
  }

  sqlBlock(): SQLBlockSource {
    if (!this.requestBlock) {
      this.requestBlock = makeSQLBlock(
        this.select.sqlPhrases(),
        this.connectionName.refString
      );
    }
    return this.requestBlock;
  }

  structRef(): StructRef {
    return this.structDef();
  }

  validateConnectionName(): boolean {
    const connection = this.modelEntry(this.connectionName);
    const name = this.connectionName.refString;
    if (this.connectionNameInvalid) return false;
    if (connection === undefined) {
      this.namespace()?.setEntry(
        name,
        {entry: {type: 'connection', name}, exported: true},
        true
      );
    } else if (connection.entry.type !== 'connection') {
      this.connectionName.log(
        `${this.connectionName.refString} is not a connection`
      );
      this.connectionNameInvalid = true;
      return false;
    }
    return true;
  }

  needs(doc: Document): NeedCompileSQL | undefined {
    if (!this.validateConnectionName()) {
      return undefined;
    }
    const sql = this.sqlBlock();
    const sqlDefEntry = this.translator()?.root.sqlQueryZone;
    if (!sqlDefEntry) {
      this.log("Cant't look up schema for sql block");
      return;
    }
    sqlDefEntry.reference(sql.name, this.location);
    const lookup = sqlDefEntry.getEntry(sql.name);
    if (lookup.status === 'reference') {
      return {
        compileSQL: sql,
        partialModel: this.select.containsQueries ? doc.modelDef() : undefined,
      };
    }
  }

  structDef(): StructDef {
    if (!this.validateConnectionName()) {
      return ErrorFactory.structDef;
    }
    const sqlDefEntry = this.translator()?.root.sqlQueryZone;
    if (!sqlDefEntry) {
      this.log("Cant't look up schema for sql block");
      return ErrorFactory.structDef;
    }
    const sql = this.sqlBlock();
    sqlDefEntry.reference(sql.name, this.location);
    const lookup = sqlDefEntry.getEntry(sql.name);
    if (lookup.status === 'error') {
      const msgLines = lookup.message.split(/\r?\n/);
      this.select.log('Invalid SQL, ' + msgLines.join('\n    '));
      return ErrorFactory.structDef;
    } else if (lookup.status === 'present') {
      const location = this.select.location;
      const locStruct = {
        ...lookup.value,
        fields: lookup.value.fields.map(f => ({...f, location})),
        location: this.location,
      };
      return locStruct;
    } else {
      this.log(
        'sql can currently only be used in a top level source/query definitions'
      );
      return ErrorFactory.structDef;
    }
  }
}
