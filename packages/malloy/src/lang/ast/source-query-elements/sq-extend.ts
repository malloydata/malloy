/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RefinedSource} from '../source-elements/refined-source';
import {SourceQueryElement} from './source-query-element';
import type {SourceDesc} from '../types/source-desc';
import type {IncludeItem} from './include-item';

/**
 * An element which represents adding source extensions to a
 * query or source using the `extend` operator. This element
 * cannot be treated as a query.
 *
 * e.g. `flights extend { rename: carrier2 is carrier }`
 */
export class SQExtend extends SourceQueryElement {
  elementType = 'sq-extend';
  asSource?: RefinedSource;

  constructor(
    readonly sqSrc: SourceQueryElement,
    readonly extend: SourceDesc,
    readonly includeList: IncludeItem[] | undefined
  ) {
    super({sqSrc, extend});
  }

  getSource() {
    if (this.asSource) {
      return this.asSource;
    }
    const src = this.sqSrc.getSource();
    if (src) {
      this.asSource = new RefinedSource(src, this.extend, this.includeList);
      this.has({asSource: this.asSource});
      return this.asSource;
    }
    this.sqLog(
      'failed-to-compute-source-to-extend',
      'Could not compute source to extend'
    );
  }

  isSource() {
    return true;
  }
}
