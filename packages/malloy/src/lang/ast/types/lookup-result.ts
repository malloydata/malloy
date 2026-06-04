/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {JoinElementType, JoinType} from '../../../model';
import type {MessageCode} from '../../parse-log';
import type {SpaceEntry} from './space-entry';

export interface JoinPathElement {
  name: string;
  joinElementType: JoinElementType;
  joinType: JoinType;
}
export type JoinPath = JoinPathElement[];

export interface LookupFound {
  found: SpaceEntry;
  joinPath: JoinPath;
  error: undefined;
  isOutputField: boolean;
}
export interface LookupError {
  error: {message: string; code: MessageCode};
  found: undefined;
}

export type LookupResult = LookupFound | LookupError;
