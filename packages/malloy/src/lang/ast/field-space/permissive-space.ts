/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {AccessModifierLabel} from '../../../model';
import type {FieldName} from '../types/field-space';
import type {LookupResult} from '../types/lookup-result';
import {PassthroughSpace} from './passthrough-space';

/**
 * Used to detect references to fields in the statement which defines them
 */
export class PermissiveSpace extends PassthroughSpace {
  lookup(symbol: FieldName[]): LookupResult {
    return this.realFS.lookup(symbol, 'private');
  }

  accessProtectionLevel(): AccessModifierLabel {
    return 'private';
  }
}
