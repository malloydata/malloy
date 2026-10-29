/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
