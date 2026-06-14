/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AtomicFieldDeclaration} from '../query-items/field-declaration';
import type {FieldReference} from '../query-items/field-references';

import type {NestFieldDeclaration} from '../query-properties/nest';

export type QueryItem =
  | AtomicFieldDeclaration
  | FieldReference
  | NestFieldDeclaration;
