/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {CompositeSource} from '../source-elements/composite-source';
import {SourceQueryElement} from './source-query-element';

/**
 * e.g. `compose(source_a, source_b)`
 */
export class SQCompose extends SourceQueryElement {
  elementType = 'sq-compose';
  asSource?: CompositeSource;

  constructor(readonly sources: SourceQueryElement[]) {
    super({sources});
  }

  getSource() {
    if (this.asSource) {
      return this.asSource;
    }
    const sources = this.sources.map(s => s.getSource());
    if (sources.length === 0) {
      this.sqLog(
        'empty-composite-source',
        'Composite source must have at least one input source'
      );
      return undefined;
    } else if (sources.length === 1) {
      this.sqLog(
        'unnecessary-composite-source',
        'A composite source with one input is equivalent to that input',
        {severity: 'warn'}
      );
    }
    if (hasNoUndefined(sources)) {
      this.asSource = new CompositeSource(sources);
      this.has({asSource: this.asSource});
      return this.asSource;
    }
    this.sqLog(
      'invalid-composite-source-input',
      'All composite source inputs must be valid sources'
    );
  }

  isSource() {
    return true;
  }
}

function hasNoUndefined<T>(arr: (T | undefined)[]): arr is T[] {
  return arr.every(s => s !== undefined);
}
