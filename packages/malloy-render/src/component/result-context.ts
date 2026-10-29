/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {createContext, useContext} from 'solid-js';
import type {Accessor} from 'solid-js';
import type {RenderMetadata} from './render-result-metadata';

export const ResultContext = createContext<Accessor<RenderMetadata>>();
export const useResultContext = () => {
  const ctx = useContext(ResultContext);
  if (!ctx)
    throw Error(
      'useResultContext must be used within a ResultContext.Provider'
    );
  return ctx();
};
