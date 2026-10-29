/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {Renderer} from './renderer';
import type {DataRenderOptions, RenderDef, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Field} from '../data_tree';

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

  activates(_field: Field): boolean {
    // Does not activate by default.
    return false;
  }

  isValidMatch(_field: Field): boolean {
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
    field: Field,
    renderOptions: T,
    timezone?: string
  ): Renderer;
}
