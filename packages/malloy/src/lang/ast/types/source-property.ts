/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {Filter} from '../query-properties/filters';
import {DeclareFields} from '../query-properties/declare-fields';
import {FieldListEdit} from '../source-properties/field-list-edit';
import {Renames} from '../source-properties/renames';
import {PrimaryKey} from '../source-properties/primary-key';
import {Views} from '../source-properties/views';
import {MalloyElement} from './malloy-element';
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
