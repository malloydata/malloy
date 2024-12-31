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

import {Explore, Field, Tag} from '@malloydata/malloy';
import {Renderer} from './renderer';
import {DataRenderOptions, RenderDef, StyleDefaults} from './data_styles';
import {RendererOptions} from './renderer_types';

type TagPropertyExtractor<T extends DataRenderOptions> = (
  options: T,
  tagObj: Tag | undefined
) => void;

export abstract class RendererFactory<T extends DataRenderOptions> {
  readonly tagOptionExtractors: Record<string, TagPropertyExtractor<T>> = {};

  protected addExtractor(
    extractor: TagPropertyExtractor<T>,
    ...tags: string[]
  ) {
    for (const index in tags) {
      this.tagOptionExtractors[tags[index]] = extractor;
    }
  }

  activates(_field: Field | Explore): boolean {
    // Does not activate by default.
    return false;
  }

  isValidMatch(_field: Field | Explore): boolean {
    return true;
  }

  matches(renderDef: RenderDef): boolean {
    return renderDef.renderer === this.rendererName;
  }

  parseTagParameters(tags: Tag) {
    const options = {} as T;
    for (const tagName in this.tagOptionExtractors) {
      const tagValue = tags.tag(tagName);
      if (tagValue) {
        this.tagOptionExtractors[tagName](options, tagValue);
      }
    }

    return options;
  }

  abstract get rendererName(): string | undefined;
  abstract create(
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    field: Field | Explore,
    renderOptions: T,
    timezone?: string
  ): Renderer;
}
