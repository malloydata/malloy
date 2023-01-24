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

import { ModelDataRequest } from "../parse-malloy";
import {
  DocStatement,
  Document,
  MalloyElement,
  RunList,
} from "./malloy-element";
import { HasParameter } from "./ast-main";
import { ErrorFactory } from "./error-factory";
import { Mallobj } from "./mallobj";

export class DefineExplore extends MalloyElement implements DocStatement {
  elementType = "defineExplore";
  readonly parameters?: HasParameter[];
  constructor(
    readonly name: string,
    readonly mallobj: Mallobj,
    readonly exported: boolean,
    params?: MalloyElement[]
  ) {
    super({ explore: mallobj });
    if (params) {
      this.parameters = [];
      for (const el of params) {
        if (el instanceof HasParameter) {
          this.parameters.push(el);
        } else {
          this.log(
            `Unexpected element type in define statement: ${el.elementType}`
          );
        }
      }
      this.has({ parameters: this.parameters });
    }
  }

  execute(doc: Document): ModelDataRequest {
    if (doc.modelEntry(this.name)) {
      this.log(`Cannot redefine '${this.name}'`);
    } else {
      const structDef = this.mallobj.withParameters(this.parameters);
      if (ErrorFactory.isErrorStructDef(structDef)) {
        return;
      }
      doc.setEntry(this.name, {
        entry: {
          ...structDef,
          as: this.name,
          location: this.location,
        },
        exported: this.exported,
      });
    }
  }
}

export class DefineSourceList extends RunList implements DocStatement {
  constructor(sourceList: DefineExplore[]) {
    super("defineSources", sourceList);
  }

  execute(doc: Document): ModelDataRequest {
    return this.executeList(doc);
  }
}
