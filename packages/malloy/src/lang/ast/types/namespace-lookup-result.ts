/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {JoinElementType, JoinType} from '../../../model';
import type {MessageCode} from '../../parse-log';
import {Namespace} from './field-space';
import type {SpaceEntry} from './space-entry';

export interface NamespaceLookupFound {
  found: NamespaceEntry;
  namespace: Namespace;
  error: undefined;
}
export interface NamespaceLookupError {
  error: {message: string; code: MessageCode};
  found: undefined;
}

export type NamespaceLookupResult = NamespaceLookupFound | NamespaceLookupError;
