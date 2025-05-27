/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {AccessModifierLabel} from '../../../model';
import type {AtomicFieldDeclaration} from '../query-items/field-declaration';
import type {FieldName, FieldSpace} from '../types/field-space';
import type {LookupResult} from '../types/lookup-result';
import {PassthroughSpace} from './passthrough-space';

/**
 * Used to detect references to fields in the statement which defines them
 */
export class DefSpace extends PassthroughSpace {
  foundCircle = false;
  constructor(
    readonly realFS: FieldSpace,
    readonly circular: AtomicFieldDeclaration
  ) {
    super(realFS);
  }

  lookup(symbol: FieldName[]): LookupResult {
    if (symbol[0] && symbol[0].refString === this.circular.defineName) {
      this.foundCircle = true;
      return {
        error: {
          message: `Circular reference to '${this.circular.defineName}' in definition`,
          code: 'circular-reference-in-field-definition',
        },
        found: undefined,
      };
    }
    return this.realFS.lookup(symbol);
  }

  accessProtectionLevel(): AccessModifierLabel {
    return 'public';
  }
}
