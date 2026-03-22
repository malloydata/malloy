/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {SourceDef, VirtualSourceDef} from '../../../model/malloy_types';
import {Source} from './source';
import {ErrorFactory} from '../error-factory';
import type {ModelEntryReference} from '../types/malloy-element';

export class VirtualTableSource extends Source {
  elementType = 'virtualTableSource';

  constructor(
    readonly connectionName: ModelEntryReference,
    readonly virtualName: string
  ) {
    super();
    this.has({connectionName});
  }

  getSourceDef(): SourceDef {
    const connection = this.modelEntry(this.connectionName);
    const name = this.connectionName.refString;
    if (connection === undefined) {
      this.namespace()?.setEntry(
        name,
        {entry: {type: 'connection', name}, exported: true},
        true
      );
    } else if (connection.entry.type !== 'connection') {
      this.connectionName.logError(
        'invalid-connection-for-table-source',
        `${this.connectionName.refString} is not a connection`
      );
      return ErrorFactory.structDef;
    }

    const dialect = this.translator()?.root.connectionDialectZone.get(name);
    if (dialect === undefined) {
      this.logError(
        'virtual-source-unknown-dialect',
        `Cannot determine dialect for connection '${name}'`
      );
      return ErrorFactory.structDef;
    }

    const sourceDef: VirtualSourceDef = {
      type: 'virtual',
      name: this.virtualName,
      dialect,
      connection: name,
      fields: [],
      location: this.location,
    };
    this.document()?.rememberToAddModelAnnotations(sourceDef);
    return sourceDef;
  }
}
