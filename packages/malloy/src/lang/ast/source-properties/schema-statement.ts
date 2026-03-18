/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AtomicFieldDef} from '../../../model/malloy_types';
import {ListOf, MalloyElement} from '../types/malloy-element';

export class SchemaElement extends MalloyElement {
  elementType = 'schemaElement';
  constructor(readonly elementDef: AtomicFieldDef) {
    super();
  }
}

export class SchemaStatement extends ListOf<SchemaElement> {
  elementType = 'schemaStatement';
  declaredFields: Map<string, SchemaElement>;
  constructor(fields: SchemaElement[]) {
    super(fields);
    this.declaredFields = new Map<string, SchemaElement>();
    for (const fel of this.list) {
      const f = fel.elementDef;
      const name = f.as ?? f.name;
      this.declaredFields.set(name, fel);
    }
  }
}
