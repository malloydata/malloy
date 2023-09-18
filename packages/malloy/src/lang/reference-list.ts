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

import {DocumentLocation, DocumentPosition} from '../model';
import {locationContainsPosition} from './utils';

export class ReferenceList<T> {
  constructor(private readonly sourceURL: string) {}

  // These should always be sorted by their end positions
  private readonly references: {location: DocumentLocation; value: T}[] = [];

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

  public add(location: DocumentLocation, reference: T): void {
    // Ignore any reference in another file
    if (location.url !== this.sourceURL) {
      return;
    }
    const insertIndex = this.findIndexBefore(location.range.end);
    // Ignore duplicate references
    if (
      insertIndex < this.references.length &&
      this.isPositionEqual(location, this.references[insertIndex].location)
    ) {
      return;
    }
    this.references.splice(insertIndex, 0, {
      location,
      value: reference,
    });
  }

  private isPositionEqual(
    referenceA: DocumentLocation,
    referenceB: DocumentLocation
  ) {
    const rangeA = referenceA.range;
    const rangeB = referenceB.range;
    return (
      rangeA.start.line === rangeB.start.line &&
      rangeA.start.character === rangeB.start.character &&
      rangeA.end.line === rangeB.end.line &&
      rangeA.end.character === rangeB.end.character
    );
  }

  public find(position: DocumentPosition): T | undefined {
    // Here we assume that references DO NOT overlap. And then we do a binary
    // search to find the one we're looking for.
    const index = this.findIndexBefore(position);
    if (index === this.references.length) {
      return undefined;
    }
    const reference = this.references[index];
    if (locationContainsPosition(reference.location, position)) {
      return reference.value;
    }
    return undefined;
  }
}
