/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TypeDesc} from '../../../model';
import type {DynamicSpace} from '../field-space/dynamic-space';
import type {MalloyElement} from './malloy-element';

export abstract class SpaceEntry {
  abstract typeDesc(): TypeDesc;
  abstract refType: 'field' | 'parameter';
}

export interface MakeEntry extends MalloyElement {
  makeEntry: (fs: DynamicSpace) => void;
  getName(): string;
}

export function canMakeEntry<T extends MalloyElement>(
  me: T
): me is T & MakeEntry {
  return 'makeEntry' in me;
}
