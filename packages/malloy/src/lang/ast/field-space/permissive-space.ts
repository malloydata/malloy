/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
