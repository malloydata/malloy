/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {SourceProperty} from './source-property';
import {ListOf} from './malloy-element';

export class SourceDesc extends ListOf<SourceProperty> {
  elementType = 'sourceDescription';
}
