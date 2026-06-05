/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {activeName} from '../../../model/malloy_types';
import type {
  InvokedStructRef,
  SourceDef,
  SQLSourceDef,
} from '../../../model/malloy_types';
import {mkSQLSourceDef} from '../../../model/source_def_utils';
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
    if (this.isRestricted()) {
      this.logError(
        'restricted-construct-forbidden',
        `\`${this.connectionName.refString}.sql(...)\` cannot be used in a restricted query — raw SQL is not permitted.`
      );
      return ErrorFactory.structDef;
    }
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
      // Means we couldn't make a source request or there was
      // a problem with the source request, both will have logged
      // errors already.
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
      // Create a base struct with updated fields (adding location and refSummary)
      const baseStruct: SourceDef = {
        ...lookup.value,
        fields: lookup.value.fields.map(f => ({
          ...f,
          location,
          refSummary: {fieldUsage: [{path: [activeName(f)], at: location}]},
        })),
        location: this.location,
      };
      // Use factory to create SQLSourceDef without propagating sourceID/extends
      const [_valid, phrases] = this.select.sqlPhrases();
      const selectSegments = this.select.containsQueries ? phrases : undefined;
      const locStruct: SQLSourceDef = mkSQLSourceDef(
        baseStruct,
        lookup.value.selectStr,
        selectSegments
      );
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
