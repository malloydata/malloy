/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {StyleDefaults} from './data_styles';
import type {ChildRenderers} from './renderer';
import {RenderTree} from './renderer';
import type {RendererOptions} from './renderer_types';
import type {NestField} from '../data_tree';

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
    c: new (document: Document, options: RendererOptions, tags: Tag) => Type,
    document: Document,
    exploreField: NestField,
    options: RendererOptions,
    tagged: Tag
  ): Type {
    const n = new c(document, options, tagged);
    return n;
  }
}
