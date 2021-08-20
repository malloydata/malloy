/*
 * Copyright 2021 Google LLC
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

import { Range } from "./source-reference";

export type ZoneData<TValue> = Record<string, TValue>;

type EntryStatus = "present" | "reference";
type ZoneStatus = EntryStatus | "error" | "none";

interface AllEntries {
  status: string;
  firstReference?: Range;
}

interface EntryPresent<T> extends AllEntries {
  status: "present";
  value: T;
}

interface ReferenceEntry {
  status: "reference";
  firstReference: Range;
}

interface EntryErrored extends AllEntries {
  status: "error";
  message: string;
}

type ZoneEntry<T> = EntryPresent<T> | ReferenceEntry | EntryErrored;

/**
 * A Zone is a symbol table which may contain references to symbols
 * which are not yet defined.
 */
export class Zone<TValue> {
  zone: Map<string, ZoneEntry<TValue>>;
  location: Record<string, Range> = {};
  constructor() {
    this.zone = new Map<string, ZoneEntry<TValue>>();
  }

  status(str: string): ZoneStatus {
    const zst = this.zone.get(str);
    return zst?.status || "none";
  }

  get(str: string): TValue | undefined {
    const zst = this.zone.get(str);
    if (zst?.status === "present") {
      return zst.value;
    }
  }

  getEntry(str: string): ZoneEntry<TValue> {
    const zst = this.zone.get(str);
    if (zst) {
      if (zst.firstReference || !this.location[str]) {
        return zst;
      }
      return { ...zst, firstReference: this.location[str] };
    }
    return { status: "error", message: "import reference failure" };
  }

  define(str: string, val: TValue): void {
    this.zone.set(str, { status: "present", value: val });
  }

  reference(str: string, loc: Range): void {
    if (this.status(str) === "none") {
      this.zone.set(str, { status: "reference", firstReference: loc });
      this.location[str] = loc;
    }
  }

  getUndefined(): string[] | undefined {
    const allUndefined = [];
    for (const [name, val] of this.zone) {
      if (val.status === "reference") {
        allUndefined.push(name);
      }
    }
    return allUndefined.length > 0 ? allUndefined : undefined;
  }

  updateFrom(
    updateData: ZoneData<TValue> | undefined,
    errorData: Record<string, string> | undefined
  ): void {
    if (updateData) {
      for (const [updateKey, updateVal] of Object.entries(updateData)) {
        if (updateVal !== undefined) {
          this.define(updateKey, updateVal);
        }
      }
    }
    if (errorData) {
      for (const [errorKey, errorMessage] of Object.entries(errorData)) {
        this.zone.set(errorKey, { status: "error", message: errorMessage });
      }
    }
  }
}
