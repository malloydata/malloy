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

import { Explore } from "@malloydata/malloy";
import { DataStyles, StyleDefaults } from "../data_styles";
import { DrillFunction } from "../drill";
import { ChildRenderers, RendererOptions, RenderTree } from "../renderer";

export abstract class ContainerRenderer extends RenderTree {
  childRenderers: ChildRenderers = {};
  protected abstract childrenStyleDefaults: StyleDefaults;

  get defaultStylesForChildren(): StyleDefaults {
    return this.childrenStyleDefaults;
  }

  // We can't use a normal constructor here because we need
  //  we need to be fully constructed before we construct
  //  our children.
  static make<Type extends ContainerRenderer>(
    c: new (document: Document, options: RendererOptions) => Type,
    document: Document,
    exploreField: Explore,
    options: RendererOptions
  ): Type {
    const n = new c(document, options);
    return n;
  }
}
