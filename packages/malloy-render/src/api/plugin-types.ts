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
