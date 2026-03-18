/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AtomicFieldDef} from '../../../model/malloy_types';
import {MalloyElement} from '../types/malloy-element';

export class SchemaStatement extends MalloyElement {
  elementType = 'schemaStatement';
  constructor(readonly fields: AtomicFieldDef[]) {
    super();
  }

  get declaredFields(): Map<string, AtomicFieldDef> {
    const map = new Map<string, AtomicFieldDef>();
    for (const f of this.fields) {
      const name = f.as ?? f.name;
      map.set(name, f);
    }
    return map;
  }
}
