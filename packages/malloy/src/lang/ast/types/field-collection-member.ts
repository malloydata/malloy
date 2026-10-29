/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {AtomicFieldDeclaration} from '../query-items/field-declaration';
import type {FieldReferenceElement} from '../query-items/field-references';
import {
  FieldReference,
  WildcardFieldReference,
} from '../query-items/field-references';
import type {MalloyElement} from './malloy-element';

export type FieldCollectionMember =
  FieldReferenceElement | AtomicFieldDeclaration;
export function isFieldCollectionMember(
  el: MalloyElement
): el is FieldCollectionMember {
  return (
    el instanceof FieldReference ||
    el instanceof WildcardFieldReference ||
    el instanceof AtomicFieldDeclaration
  );
}
