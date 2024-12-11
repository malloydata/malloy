/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {MalloyElement} from '../types/malloy-element';
import {
  AccessModifierFieldReference,
  FieldReference,
} from '../query-items/field-references';
import {DocumentLocation} from '../../../model';

type RenameSpec = {
  as: string;
  name: FieldReference;
  location: DocumentLocation;
};

export abstract class IncludeItem extends MalloyElement {
  abstract kind: 'private' | 'public' | 'internal' | 'except' | undefined;
  constructor(readonly isStar: boolean) {
    super();
  }

  abstract getFields(): FieldReference[];

  getRenames(): RenameSpec[] {
    return [];
  }
}

export class IncludeAccessItem extends IncludeItem {
  elementType = 'include-access-item';
  constructor(
    readonly kind: 'private' | 'public' | 'internal' | undefined,
    readonly fields: IncludeListItem[] | '*'
  ) {
    super(fields === '*');
    if (fields !== '*') {
      this.has({fields});
    }
  }

  getFields(): FieldReference[] {
    if (this.fields === '*') return [];
    return this.fields.map(f => f.name);
  }

  getRenames(): RenameSpec[] {
    const renames: RenameSpec[] = [];
    if (this.fields === '*') return renames;
    for (const item of this.fields) {
      if (item.as) {
        renames.push({as: item.as, name: item.name, location: item.location});
      }
    }
    return renames;
  }
}

export class IncludeExceptItem extends IncludeItem {
  elementType = 'include-except-item';
  kind = 'except' as const;
  constructor(readonly fields: FieldReference[] | '*') {
    super(fields === '*');
    if (fields !== '*') {
      this.has({fields});
    }
  }

  getFields(): FieldReference[] {
    if (this.fields === '*') return [];
    return this.fields;
  }
}

export class IncludeListItem extends MalloyElement {
  elementType = 'include-list-item';

  constructor(
    readonly name: AccessModifierFieldReference,
    readonly as: string | undefined
  ) {
    super({name});
  }
}
