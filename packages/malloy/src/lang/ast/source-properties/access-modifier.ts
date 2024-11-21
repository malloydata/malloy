/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {AccessModifierLabel} from '../../../model';
import {FieldReferences} from '../query-items/field-references';
import {MalloyElement} from '../types/malloy-element';

export class AccessModifier extends MalloyElement {
  elementType = 'access_modifier';
  constructor(
    readonly access: AccessModifierLabel,
    readonly refs: FieldReferences | undefined,
    readonly except: FieldReferences[] | undefined
  ) {
    super({});
    if (refs) {
      this.has({refs});
    }
    if (except) {
      this.has({except});
    }
  }
}

export type AccessModifierSpec =
  | {
      access: AccessModifierLabel;
      logTo: MalloyElement;
      fieldName: string;
    }
  | {
      access: AccessModifierLabel;
      logTo: MalloyElement;
      except: string[];
    };
