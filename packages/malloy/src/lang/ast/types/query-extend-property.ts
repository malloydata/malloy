/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Dimensions} from '../source-properties/dimensions';
import {JoinStatement} from '../source-properties/join';
import {Measures} from '../source-properties/measures';
import type {MalloyElement} from './malloy-element';

export type QueryExtendProperty = Dimensions | Measures;
export function isQueryExtendProperty(
  q: MalloyElement
): q is QueryExtendProperty {
  return (
    q instanceof Dimensions ||
    q instanceof Measures ||
    q instanceof JoinStatement
  );
}
