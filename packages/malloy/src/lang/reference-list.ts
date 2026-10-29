/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {DocumentPosition, DocumentReference} from '../model';
import {locationContainsPosition} from './utils';

export class ReferenceList {
  constructor(
    private readonly sourceURL: string,
    // These should always be sorted by their end positions
    private readonly references: DocumentReference[] = []
  ) {}

  private findIndexBefore(position: DocumentPosition): number {
    let low = 0;
    let high = this.references.length;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const compare = this.references[middle].location.range.end;
      if (
        compare.line < position.line ||
        (compare.line === position.line &&
          compare.character < position.character)
      ) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    return low;
  }

  public add(reference: DocumentReference): void {
    // Ignore any reference in another file
    if (reference.location.url !== this.sourceURL) {
      return;
    }
    const insertIndex = this.findIndexBefore(reference.location.range.end);
    // Ignore duplicate references
    if (
      insertIndex < this.references.length &&
      this.isPositionEqual(reference, this.references[insertIndex])
    ) {
      return;
    }
    this.references.splice(insertIndex, 0, reference);
  }

  private isPositionEqual(
    referenceA: DocumentReference,
    referenceB: DocumentReference
  ) {
    const rangeA = referenceA.location.range;
    const rangeB = referenceB.location.range;
    return (
      rangeA.start.line === rangeB.start.line &&
      rangeA.start.character === rangeB.start.character &&
      rangeA.end.line === rangeB.end.line &&
      rangeA.end.character === rangeB.end.character
    );
  }

  public find(position: DocumentPosition): DocumentReference | undefined {
    // Here we assume that references DO NOT overlap. And then we do a binary
    // search to find the one we're looking for.
    const index = this.findIndexBefore(position);
    if (index === this.references.length) {
      return undefined;
    }
    const reference = this.references[index];
    if (locationContainsPosition(reference.location, position)) {
      return reference;
    }
    return undefined;
  }

  public toArray() {
    return [...this.references];
  }
}
