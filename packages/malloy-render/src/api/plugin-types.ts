/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {JSXElement} from 'solid-js';
import type {Tag} from '@malloydata/malloy-tag';
import type {Field, NestField, NestCell, FieldType, Cell} from '../data_tree';
import type {
  RenderMetadata,
  GetResultMetadataOptions,
} from '@/component/render-result-metadata';
import type {JSONSchemaObject} from './json-schema-types';

export interface RenderProps {
  dataColumn: Cell;
  field: Field;
  customProps?: Record<string, unknown>;
}

export interface RendererValidationSpec {
  readonly renderer: string;
  readonly ownedPaths?: string[][];
  readonly childOwnedPaths?: string[][];
}

interface BaseRenderPluginInstance<TMetadata = unknown> {
  readonly name: string;
  readonly field: Field;
  readonly sizingStrategy: 'fixed' | 'fill';

  getMetadata(): TMetadata;
  processData?(field: NestField, cell: NestCell): void;
  beforeRender?(
    metadata: RenderMetadata,
    options: GetResultMetadataOptions
  ): void;
  getStyleOverrides?(): Record<string, string>;

  /**
   * Legacy compatibility for plugins that still declare self-owned paths
   * from the instance. New code should use factory.getValidationSpec().
   * @deprecated Use RenderPluginFactory.getValidationSpec() instead.
   */
  getDeclaredTagPaths?(): string[][];
}

export interface SolidJSRenderPluginInstance<TMetadata = unknown>
  extends BaseRenderPluginInstance<TMetadata> {
  readonly renderMode: 'solidjs';
  renderComponent(props: RenderProps): JSXElement;
}

export interface DOMRenderPluginInstance<TMetadata = unknown>
  extends BaseRenderPluginInstance<TMetadata> {
  readonly renderMode: 'dom';
  renderToDOM(container: HTMLElement, props: RenderProps): void;
  cleanup?(container: HTMLElement): void;
}

export type RenderPluginInstance<TMetadata = unknown> =
  | SolidJSRenderPluginInstance<TMetadata>
  | DOMRenderPluginInstance<TMetadata>;

export interface CoreVizPluginMethods {
  getSchema(): JSONSchemaObject;
  getSettings(): Record<string, unknown>;
  getDefaultSettings(): Record<string, unknown>;
  settingsToTag(settings: Record<string, unknown>): Tag;
}

export type CoreVizPluginInstance<TMetadata = unknown> =
  SolidJSRenderPluginInstance<TMetadata> & CoreVizPluginMethods;

export interface RenderPluginFactory<
  TInstance extends RenderPluginInstance = RenderPluginInstance,
> {
  readonly name: string;

  /**
   * IMPORTANT: Declare the tags this renderer OWNS, not every tag it might
   * ever read.
   *
   * Own a tag here if this renderer is the authority for its meaning:
   * - the tag is only meaningful when this renderer is active
   * - this renderer is responsible for validating it
   * - this renderer should suppress "unknown render tag" warnings for it
   *
   * This applies to:
   * - tags on the renderer field itself
   * - context-sensitive tags on child fields
   *
   * Do NOT declare globally meaningful field tags just because this renderer
   * happens to read them during implementation. Examples: `label`, `hidden`,
   * `description`, `column`.
   *
   * Rule:
   * - if the tag would be meaningless without this renderer, declare it here
   * - if the tag is meaningful independently of this renderer, do not
   *
   * Think in terms of semantic ownership, not literal runtime reads.
   */
  getValidationSpec?(): RendererValidationSpec;
  matches(field: Field, fieldTag: Tag, fieldType: FieldType): boolean;
  create(field: Field, pluginOptions?: unknown, modelTag?: Tag): TInstance;
}

export function isCoreVizPluginInstance(
  plugin: RenderPluginInstance
): plugin is CoreVizPluginInstance {
  return (
    'getSchema' in plugin &&
    'getSettings' in plugin &&
    'getDefaultSettings' in plugin &&
    'settingsToTag' in plugin &&
    typeof plugin.getSchema === 'function' &&
    typeof plugin.getSettings === 'function' &&
    typeof plugin.getDefaultSettings === 'function' &&
    typeof plugin.settingsToTag === 'function'
  );
}
