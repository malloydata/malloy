/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {MalloyElement} from '../types/malloy-element';
import type {
  AccessModifierFieldReference,
  FieldReference,
  WildcardFieldReference,
} from '../query-items/field-references';
import type {Annotation} from '../../../model';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';

// type RenameSpec = {
//   as: string;
//   name: FieldReference;
//   location: DocumentLocation;
// };

export abstract class IncludeItem extends MalloyElement {
  abstract kind: 'private' | 'public' | 'internal' | 'except' | undefined;
}

export class IncludeAccessItem extends IncludeItem implements Noteable {
  elementType = 'include-access-item';
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;
  constructor(
    readonly kind: 'private' | 'public' | 'internal' | undefined,
    readonly fields: IncludeListItem[]
  ) {
    super();
    this.has({fields});
  }

  // getRenames(): RenameSpec[] {
  //   const renames: RenameSpec[] = [];
  //   if (this.fields === '*') return renames;
  //   for (const item of this.fields) {
  //     if (item.as) {
  //       renames.push({as: item.as, name: item.name, location: item.location});
  //     }
  //   }
  //   return renames;
  // }
}

export class IncludeExceptItem extends IncludeItem {
  elementType = 'include-except-item';
  kind = 'except' as const;
  constructor(readonly fields: (FieldReference | WildcardFieldReference)[]) {
    super();
    this.has({fields});
  }
}

export class IncludeListItem extends MalloyElement implements Noteable {
  elementType = 'include-list-item';
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;

  constructor(
    readonly name: AccessModifierFieldReference | WildcardFieldReference,
    readonly as: string | undefined
  ) {
    super({name});
  }
}
