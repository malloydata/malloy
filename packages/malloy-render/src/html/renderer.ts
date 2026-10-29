/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {RendererOptions} from './renderer_types';
export type ChildRenderers = {[fieldName: string]: Renderer};
import type {Cell} from '../data_tree';

export interface Renderer {
  render(value: Cell): Promise<HTMLElement>;
}

export abstract class RenderTree implements Renderer {
  constructor(
    protected readonly document: Document,
    protected readonly options: RendererOptions,
    protected readonly tagged: Tag
  ) {}

  protected abstract get childRenderers(): ChildRenderers;

  abstract render(value: Cell): Promise<HTMLElement>;
}
