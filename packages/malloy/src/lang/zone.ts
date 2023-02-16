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

import { DocumentLocation } from "../model/malloy_types";

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
      return { ...zst, "firstReference": this.location[str] };
    }
    return { "status": "error", "message": "import reference failure" };
  }

  /**
   * Add a symbol and it's definition to the symbol table.
   * @param str
   * @param val
   */
  define(str: string, val: TValue): void {
    this.zone.set(str, { "status": "present", "value": val });
  }

  /**
   * Add a symbol to the symbol table.
   * @param str The symbol
   * @param loc The location of the reference
   */
  reference(str: string, loc: DocumentLocation): void {
    const zst = this.zone.get(str);
    if (zst?.status == undefined) {
      this.zone.set(str, { "status": "reference", "firstReference": loc });
      this.location[str] = loc;
    }
  }

  /**
   * @returns A list of all symbols which have references but not definitions
   */
  getUndefined(): string[] | undefined {
    const allUndefined: string[] = [];
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
        this.zone.set(errorKey, { "status": "error", "message": errorMessage });
      }
    }
  }
}
