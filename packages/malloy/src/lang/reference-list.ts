/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { DocumentReference, DocumentPosition } from "../model";

export class ReferenceList {
  constructor(private readonly sourceURL: string) {}

  // These should always be sorted by their end positions
  private readonly references: DocumentReference[] = [];

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
    if (
      reference.location.range.start.line <= position.line &&
      reference.location.range.end.line >= position.line &&
      (position.line !== reference.location.range.start.line ||
        position.character >= reference.location.range.start.character) &&
      (position.line !== reference.location.range.end.line ||
        position.character <= reference.location.range.end.character)
    ) {
      return reference;
    }
    return undefined;
  }
}
