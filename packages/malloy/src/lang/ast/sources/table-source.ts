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

import {StructDef} from '../../../model/malloy_types';
import {
  constructTableKey,
  deprecatedParseTableURI,
} from '../../parse-tree-walkers/find-external-references';
import {Source} from '../elements/source';
import {ErrorFactory} from '../error-factory';
import {ModelEntryReference} from '../types/malloy-element';

type TableInfo = {tablePath: string; connectionName?: string | undefined};
export abstract class TableSource extends Source {
  abstract getTableInfo(): TableInfo | undefined;

  structDef(): StructDef {
    const info = this.getTableInfo();
    if (info === undefined) {
      return ErrorFactory.structDef;
    }
    const {tablePath, connectionName} = info;
    const key = constructTableKey(connectionName, tablePath);
    const tableDefEntry = this.translator()?.root.schemaZone.getEntry(key);
    let msg = `Schema read failure for table '${tablePath}' for connection '${connectionName}'`;
    if (tableDefEntry) {
      if (tableDefEntry.status === 'present') {
        tableDefEntry.value.location = this.location;
        tableDefEntry.value.fields.forEach(field => {
          field.location = this.location;
        });
        const ret = {
          ...tableDefEntry.value,
          fields: tableDefEntry.value.fields.map(field => ({
            ...field,
            location: this.location,
          })),
          location: this.location,
        };
        this.document()?.rememberToAddModelAnnotations(ret);
        return ret;
      }
      if (tableDefEntry.status === 'error') {
        msg = tableDefEntry.message;
      }
    }
    this.log(msg);
    return ErrorFactory.structDef;
  }
}

export class TableMethodSource extends TableSource {
  elementType = 'tableMethodSource';
  constructor(
    readonly connectionName: ModelEntryReference,
    readonly tablePath: string
  ) {
    super();
    this.has({connectionName});
  }

  getTableInfo(): TableInfo | undefined {
    const connection = this.modelEntry(this.connectionName);
    const name = this.connectionName.refString;
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
      return undefined;
    }
    return {
      tablePath: this.tablePath,
      connectionName: this.connectionName.refString,
    };
  }
}

export class TableFunctionSource extends TableSource {
  elementType = 'tableFunctionSource';
  constructor(readonly tableURI: string) {
    super();
  }

  getTableInfo(): TableInfo | undefined {
    // This use of `deprecatedParseTableURI` is ok because it is for handling the
    // old, soon-to-be-deprecated table syntax.
    return deprecatedParseTableURI(this.tableURI);
  }
}
