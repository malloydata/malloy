/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ModelEntryReference} from '../types/malloy-element';
import type {Source} from '../source-elements/source';
import {SourceQueryElement} from './source-query-element';
import type {QueryElement} from '../types/query-element';
import {QuerySource} from '../source-elements/query-source';
import {NamedSource} from '../source-elements/named-source';
import {QueryReference} from '../query-elements/query-reference';
import type {Argument} from '../parameters/argument';
import {activeName, isSourceDef} from '../../../model';

/**
 * A reference to either a source or a query.
 *
 * e.g. `flights`
 */
export class SQReference extends SourceQueryElement {
  elementType = 'sq-reference';
  asSource?: Source;

  constructor(
    readonly ref: ModelEntryReference,
    readonly args?: Argument[] | undefined
  ) {
    super({ref});
    if (args !== undefined) {
      this.has({args});
    }
  }

  getQuery(): QueryElement | undefined {
    const entry = this.ref.getNamed();
    if (entry) {
      if (entry.type === 'query') {
        const query = new QueryReference(this.ref);
        this.has({query});
        return query;
      } else {
        const label = entry.type === 'given' ? entry.name : activeName(entry);
        this.sqLog(
          'cannot-use-as-query',
          `Illegal reference to '${label}', query expected`
        );
      }
    } else {
      this.ref.logError(
        'source-or-query-not-found',
        `Reference to undefined object '${this.ref.refString}'`
      );
      this.errored = true;
    }
    return;
  }

  isSource() {
    const refTo = this.ref.getNamed();
    return refTo !== undefined && isSourceDef(refTo);
  }

  getSource(): Source | undefined {
    if (this.asSource) {
      return this.asSource;
    }
    const entry = this.ref.getNamed();
    if (!entry) {
      this.ref.logError(
        'source-not-found',
        `Reference to undefined object '${this.ref.refString}'`
      );
      this.errored = true;
      return;
    }
    if (entry.type === 'query') {
      if (this.args !== undefined) {
        this.ref.logError(
          'illegal-query-argument',
          'Arguments cannot be passed to queries'
        );
      }
      const existingQuery = new QueryReference(this.ref);
      this.asSource = new QuerySource(existingQuery);
    } else if (isSourceDef(entry)) {
      this.asSource = new NamedSource(this.ref, undefined, this.args);
    } else {
      this.sqLog(
        'cannot-use-user-type-as-source',
        `Expected '${this.ref.refString}' to be a query or source, not a user type`
      );
      return;
    }
    this.has({asSource: this.asSource});
    return this.asSource;
  }
}
