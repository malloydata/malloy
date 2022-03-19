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

import { DocumentLocation } from "../model/malloy-types";

export type ZoneData<TValue> = Record<string, TValue>;

type EntryStatus = "present" | "reference" | "error";

interface AllEntries {
  status: EntryStatus;
  firstReference?: DocumentLocation;
}

interface EntryPresent<T> extends AllEntries {
  status: "present";
  value: T;
}

interface ReferenceEntry {
  status: "reference";
  firstReference: DocumentLocation;
}

interface EntryErrored extends AllEntries {
  status: "error";
  message: string;
}

type ZoneEntry<T> = EntryPresent<T> | ReferenceEntry | EntryErrored;

/**
 * A Zone is a symbol table which may contain references to symbols
 * which are not yet defined. This is used by the parser to track
 * references to objects which it will have to request values from
 * before the translation can be complete. The API is struictured to
 * build the repsonse-style interfaces that the translator uses.
 */
export class Zone<TValue> {
  zone: Map<string, ZoneEntry<TValue>>;
  location: Record<string, DocumentLocation> = {};
  constructor() {
    this.zone = new Map<string, ZoneEntry<TValue>>();
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

  /**
   * Add a symbol and it's definition to the symbol table.
   * @param str
   * @param val
   */
  define(str: string, val: TValue): void {
    this.zone.set(str, { status: "present", value: val });
  }

  /**
   * Add a symbol to the symbol table.
   * @param str The symbol
   * @param loc The location of the reference
   */
  reference(str: string, loc: DocumentLocation): void {
    const zst = this.zone.get(str);
    if (zst?.status == undefined) {
      this.zone.set(str, { status: "reference", firstReference: loc });
      this.location[str] = loc;
    }
  }

  /**
   * @returns A list of all symbols which have references but not definitions
   */
  getUndefined(): string[] | undefined {
    const allUndefined = [];
    for (const [name, val] of this.zone) {
      if (val.status === "reference") {
        allUndefined.push(name);
      }
    }
    return allUndefined.length > 0 ? allUndefined : undefined;
  }

  /**
   * Provide values for symbols
   * @param updateData Symbols and their values
   * @param errorData Pass on errors encountered during fetch
   */
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
