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

export interface RenderProps {
  dataColumn: Cell;
  field: Field;
  customProps?: Record<string, unknown>;
}

// Make `TName` a generic parameter that extends string, allowing it to be a literal.
interface BaseRenderPluginInstance<TName extends string, TMetadata = unknown> {
  readonly name: TName; // <-- Changed to TName
  readonly field: Field;
  readonly sizingStrategy: 'fixed' | 'fill';

  getMetadata(): TMetadata;
  processData?(field: NestField, cell: NestCell): void;
  beforeRender?(
    metadata: RenderMetadata,
    options: GetResultMetadataOptions
  ): void;
}

// Pass TName through to BaseRenderPluginInstance
export interface SolidJSRenderPluginInstance<
  TName extends string = string, // Default to string if not specified
  TMetadata = unknown,
> extends BaseRenderPluginInstance<TName, TMetadata> {
  readonly renderMode: 'solidjs';
  renderComponent(props: RenderProps): JSXElement;
}

// Pass TName through to BaseRenderPluginInstance
export interface DOMRenderPluginInstance<
  TName extends string = string, // Default to string if not specified
  TMetadata = unknown,
> extends BaseRenderPluginInstance<TName, TMetadata> {
  readonly renderMode: 'dom';
  renderToDOM(container: HTMLElement, props: RenderProps): void;
  cleanup?(container: HTMLElement): void;
}

// Union type now also takes TName and TMetadata
export type RenderPluginInstance<
  TName extends string = string, // Default to string if not specified
  TMetadata = unknown,
> =
  | SolidJSRenderPluginInstance<TName, TMetadata>
  | DOMRenderPluginInstance<TName, TMetadata>;

// The Factory's TInstance must now also include the TName generic
export interface RenderPluginFactory<
  TInstance extends RenderPluginInstance<any> = RenderPluginInstance<
    string,
    any
  >,
> {
  // The name property of the factory should match the name of the instance it creates
  readonly name: TInstance['name']; // <-- Ensures the factory name is the literal name of the instance

  matches(field: Field, fieldTag: Tag, fieldType: FieldType): boolean;
  create(field: Field): TInstance;
}
