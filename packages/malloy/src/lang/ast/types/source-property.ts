/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Filter} from '../query-properties/filters';
import {DeclareFields} from '../query-properties/declare-fields';
import {FieldListEdit} from '../source-properties/field-list-edit';
import {Renames} from '../source-properties/renames';
import {PrimaryKey} from '../source-properties/primary-key';
import {Views} from '../source-properties/views';
import type {MalloyElement} from './malloy-element';
import {TimezoneStatement} from '../source-properties/timezone-statement';
import {ObjectAnnotation} from './annotation-elements';
import {JoinStatement} from '../source-properties/join';

export type SourceProperty =
  | Filter
  | JoinStatement
  | DeclareFields
  | FieldListEdit
  | Renames
  | PrimaryKey
  | ObjectAnnotation
  | Views
  | TimezoneStatement;
export function isSourceProperty(p: MalloyElement): p is SourceProperty {
  return (
    p instanceof Filter ||
    p instanceof JoinStatement ||
    p instanceof DeclareFields ||
    p instanceof FieldListEdit ||
    p instanceof Renames ||
    p instanceof PrimaryKey ||
    p instanceof ObjectAnnotation ||
    p instanceof Views ||
    p instanceof TimezoneStatement
  );
}
