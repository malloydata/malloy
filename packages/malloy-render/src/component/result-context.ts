/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createContext, useContext} from 'solid-js';
import type {Accessor} from 'solid-js';
import type {RenderMetadata} from './render-result-metadata';
import type {RenderFieldMetadata} from '../render-field-metadata';

export const ResultContext = createContext<Accessor<RenderMetadata>>();
export const useResultContext = () => {
  const ctx = useContext(ResultContext);
  if (!ctx)
    throw Error(
      'useResultContext must be used within a ResultContext.Provider'
    );
  return ctx();
};

export const PluginMetadataContext = createContext<
  RenderFieldMetadata | undefined
>();
export const usePluginMetadata = (): RenderFieldMetadata | undefined => {
  return useContext(PluginMetadataContext);
};
