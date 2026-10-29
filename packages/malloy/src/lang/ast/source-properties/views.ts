/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ViewFieldDeclaration} from './view-field-declaration';
import {DefinitionList} from '../types/definition-list';
import type {AccessModifierLabel} from '../../../model';

export class Views extends DefinitionList<ViewFieldDeclaration> {
  elementType = 'turtleDefList';

  constructor(
    views: ViewFieldDeclaration[],
    readonly accessModifier: AccessModifierLabel | undefined
  ) {
    super(views);
  }

  get delarationNames(): string[] {
    return this.list.map(el => el.name);
  }
}
