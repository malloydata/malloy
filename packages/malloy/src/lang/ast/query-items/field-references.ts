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

import { FieldDef } from "../../../model/malloy_types";

import { FieldName, FieldSpace } from "../types/field-space";
import { LookupResult } from "../types/lookup-result";
import { ListOf, MalloyElement } from "../types/malloy-element";

export class FieldReference extends ListOf<FieldName> {
  elementType = "fieldReference";

  constructor(names: FieldName[]) {
    super("fieldReference", names);
  }

  get refString(): string {
    return this.list.map((n) => n.refString).join(".");
  }

  get outputName(): string {
    const last = this.list[this.list.length - 1];
    return last.refString;
  }

  get sourceString(): string | undefined {
    if (this.list.length > 1) {
      return this.list
        .slice(0, -1)
        .map((n) => n.refString)
        .join(".");
    }
    return undefined;
  }

  get nameString(): string {
    return this.list[this.list.length - 1].refString;
  }

  getField(fs: FieldSpace): LookupResult {
    return fs.lookup(this.list);
  }
}

export class WildcardFieldReference extends MalloyElement {
  elementType = "wildcardFieldReference";
  constructor(
    readonly joinPath: FieldReference | undefined,
    readonly star: "*" | "**"
  ) {
    super();
    this.has({ "joinPath": joinPath });
  }

  getFieldDef(): FieldDef {
    throw this.internalError("fielddef request from wildcard reference");
  }

  get refString(): string {
    return this.joinPath
      ? `${this.joinPath.refString}.${this.star}`
      : this.star;
  }
}

export type FieldReferenceElement = FieldReference | WildcardFieldReference;

export class FieldReferences extends ListOf<FieldReferenceElement> {
  constructor(members: FieldReferenceElement[]) {
    super("fieldReferenceList", members);
  }
}
