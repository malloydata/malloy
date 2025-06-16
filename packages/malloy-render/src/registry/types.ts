/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Field} from '../data_tree';
import type {RenderPluginInstance} from '../api/plugin-types';

export type RenderFieldProps<T = unknown> = {
  field: Field;
  renderAs: string;
  sizingStrategy: string;
  properties: T;
  errors: Error[];
};

export type RenderFieldRegistryEntry = {
  field: Field;
  renderProperties: RenderFieldProps;
  plugins: RenderPluginInstance[];
};

export type RenderFieldRegistry = Map<string, RenderFieldRegistryEntry>;
