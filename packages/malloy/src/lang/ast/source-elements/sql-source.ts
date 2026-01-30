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
  isSegmentSource,
  type StructDef,
  type InvokedStructRef,
  type SourceDef,
} from '../../../model/malloy_types';
import {getSourceRequest, sqlKey} from '../../../model/sql_block';
import type {NeedCompileSQL, SQLSourceRequest} from '../../translate-response';
import {Source} from './source';
import {ErrorFactory} from '../error-factory';
import type {SQLString} from '../sql-elements/sql-string';
import type {ModelEntryReference, Document} from '../types/malloy-element';

export class SQLSource extends Source {
  elementType = 'sqlSource';
  requestBlock?: SQLSourceRequest;
  private connectionNameInvalid = false;
  constructor(
    readonly connectionName: ModelEntryReference,
    readonly select: SQLString
  ) {
    super({connectionName, select});
  }

  sqlSourceRequest(doc: Document): SQLSourceRequest | undefined {
    const partialModel = this.select.containsQueries
      ? doc.modelDef()
      : undefined;

    const [valid, phrases] = this.select.sqlPhrases();
    if (valid) {
      return getSourceRequest(
        phrases,
        this.connectionName.refString,
        partialModel
      );
    }
    return undefined;
  }

  structRef(): InvokedStructRef {
    return {
      structRef: this.getSourceDef(),
    };
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
      this.connectionName.logError(
        'invalid-connection-for-sql-source',
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
    const childNeeds = super.needs(doc);
    if (childNeeds) return childNeeds;
    if (this.requestBlock === undefined) {
      this.requestBlock = this.sqlSourceRequest(doc);
    }
    const sql = this.requestBlock;
    if (sql === undefined) {
      return undefined;
    }
    const sqlDefEntry = this.translator()?.root.sqlQueryZone;
    if (!sqlDefEntry) {
      this.logError(
        'failed-to-fetch-sql-source-schema',
        "Cant't look up schema for sql block"
      );
      return;
    }
    const key = sqlKey(sql.connection, sql.selectStr);
    sqlDefEntry.reference(key, this.location);
    const lookup = sqlDefEntry.getEntry(key);
    if (lookup.status === 'reference') {
      return {
        compileSQL: sql,
      };
    } else if (lookup.status === 'present') {
      doc.checkExperimentalDialect(this, lookup.value.dialect);
    }
  }

  getSourceDef(): SourceDef {
    if (!this.validateConnectionName()) {
      return ErrorFactory.structDef;
    }
    const sqlDefEntry = this.translator()?.root.sqlQueryZone;
    if (!sqlDefEntry) {
      this.logError(
        'failed-to-fetch-sql-source-schema',
        "Cant't look up schema for sql block"
      );
      return ErrorFactory.structDef;
    }
    if (this.requestBlock === undefined) {
      return ErrorFactory.structDef;
    }
    const sql = this.requestBlock;
    const key = sqlKey(sql.connection, sql.selectStr);
    sqlDefEntry.reference(key, this.location);
    const lookup = sqlDefEntry.getEntry(key);
    if (lookup.status === 'error') {
      const msgLines = lookup.message.split(/\r?\n/);
      this.select.logError(
        'invalid-sql-source',
        'Invalid SQL, ' + msgLines.join('\n    ')
      );
      return ErrorFactory.structDef;
    } else if (lookup.status === 'present') {
      const location = this.select.location;
      const locStruct: StructDef = {
        ...lookup.value,
        fields: lookup.value.fields.map(f => ({
          ...f,
          location,
          fieldUsage: [{path: [f.as ?? f.name], at: location}],
        })),
        location: this.location,
      };
      const fromDoc = this.document();
      const modelAnnotation = fromDoc?.currentModelAnnotation();
      if (modelAnnotation) {
        locStruct.modelAnnotation = modelAnnotation;
      }
      if (this.select.containsQueries) {
        const [_valid, phrases] = this.select.sqlPhrases();
        if (phrases.some(isSegmentSource)) {
          locStruct.selectSegments = phrases;
        }
      }
      return locStruct;
    } else {
      this.logError(
        'non-top-level-sql-source',
        '`connection_name.sql(...)` can currently only be used in top level source/query definitions'
      );
      return ErrorFactory.structDef;
    }
  }
}
