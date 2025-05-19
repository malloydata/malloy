/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {MessageCode} from '../../parse-log';
import type {Scope} from './namespace';
import type {Binding} from './bindings';

export interface NamespaceLookupFound {
  found: Binding;
  scope: Scope;
  error: undefined;
}
export interface NamespaceLookupError {
  error: {message: string; code: MessageCode};
  found: undefined;
}

export type NamespaceLookupResult = NamespaceLookupFound | NamespaceLookupError;
