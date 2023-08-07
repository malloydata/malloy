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

import {SQLBlockSource, SQLBlockStructDef} from '../../../model/malloy_types';
import {makeSQLBlock} from '../../../model/sql_block';

import {ModelDataRequest} from '../../translate-response';
import {ZoneEntry} from '../../zone';
import {DocStatement, Document, MalloyElement} from '../types/malloy-element';
import {SQLString} from './sql-string';

export class SQLStatement extends MalloyElement implements DocStatement {
  elementType = 'sqlStatement';
  is?: string;
  connection?: string;
  requestBlock?: SQLBlockSource;

  constructor(readonly select: SQLString) {
    super();
    this.has({select: select});
  }

  sqlBlock(): SQLBlockSource {
    if (!this.requestBlock) {
      this.requestBlock = makeSQLBlock(
        this.select.sqlPhrases(),
        this.connection
      );
    }
    return this.requestBlock;
  }

  private lookupCompiledSQL(
    sql: SQLBlockSource
  ): ZoneEntry<SQLBlockStructDef> | undefined {
    const sqlDefEntry = this.translator()?.root.sqlQueryZone;
    if (!sqlDefEntry) return;
    sqlDefEntry.reference(sql.name, this.location);
    return sqlDefEntry.getEntry(sql.name);
  }

  needs(doc: Document): ModelDataRequest {
    const sql = this.sqlBlock();
    const lookup = this.lookupCompiledSQL(sql);
    if (lookup?.status === 'reference') {
      return {
        compileSQL: sql,
        partialModel: this.select.containsQueries ? doc.modelDef() : undefined,
      };
    }
  }

  /**
   * This is the one statement which pauses execution. First time through
   * it will generate a schema request, next time through it will either
   * record the error or record the schema.
   */
  execute(doc: Document): void {
    const sql = this.sqlBlock();
    const lookup = this.lookupCompiledSQL(sql);
    if (!lookup) {
      this.log("Cant't look up schema for sql block");
      return;
    }
    if (lookup.status === 'error') {
      const msgLines = lookup.message.split(/\r?\n/);
      this.select.log(
        `Invalid SQL, ${JSON.stringify(sql)}` + msgLines.join('\n    ')
      );
      return undefined;
    }
    if (lookup.status === 'present') {
      const location = this.select.location;
      const locStruct = {
        ...lookup.value,
        fields: lookup.value.fields.map(f => ({...f, location})),
        location: this.location,
      };
      if (this.is && !doc.defineSQL(locStruct, this.is)) {
        this.log(`'${this.is}' already defined`);
      }
      return undefined;
    }
  }
}
