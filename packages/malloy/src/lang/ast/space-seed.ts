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

import { StructDef } from "../../model/malloy_types";

import { FieldSpace, isFieldSpace, SourceSpec } from "./types/field-space";
import { StaticSpace } from "./field-space/static-space";

/**
 * Based on how things are constructed, the starting field space
 * can either be another field space or an existing structdef.
 * Using a SpaceSeed allows a class to accept either one
 * and use either version at some future time.
 */
export class SpaceSeed {
  private spaceSpec: SourceSpec;
  private asFS?: StaticSpace;
  private asStruct?: StructDef;

  constructor(readonly sourceSpec: SourceSpec) {
    this.spaceSpec = sourceSpec;
  }

  get structDef(): StructDef {
    if (isFieldSpace(this.spaceSpec)) {
      if (!this.asStruct) {
        this.asStruct = this.spaceSpec.structDef();
      }
      return this.asStruct;
    }
    return this.spaceSpec;
  }

  get fieldSpace(): FieldSpace {
    if (isFieldSpace(this.spaceSpec)) {
      return this.spaceSpec;
    }
    if (!this.asFS) {
      this.asFS = new StaticSpace(this.spaceSpec);
    }
    return this.asFS;
  }
}
