/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {TypedSource} from '../source-elements/typed-source';
import {SourceQueryElement} from './source-query-element';
import type {ModelEntryReference} from '../types/malloy-element';

/**
 * Applies user type constraints to a source using
 * the `::` operator.
 *
 * e.g. `conn.virtual('t')::MyType`
 * e.g. `flights::(Schema1, Schema2)`
 */
export class SQTypedSource extends SourceQueryElement {
  elementType = 'sq-typed-source';

  constructor(
    readonly sqSrc: SourceQueryElement,
    readonly userTypes: ModelEntryReference[]
  ) {
    super({sqSrc});
    this.has({userTypes});
  }

  getSource() {
    const src = this.sqSrc.getSource();
    if (src) {
      const typed = new TypedSource(src, this.userTypes);
      this.has({typed});
      return typed;
    }
    this.sqLog(
      'failed-to-compute-source-to-type',
      'Could not compute source to apply type constraints'
    );
  }

  isSource() {
    return true;
  }
}
