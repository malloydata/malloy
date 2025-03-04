/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import * as Core from './core';

export function compileModel(
  request: Malloy.CompileModelRequest
): Malloy.CompileModelResponse {
  return Core.compileModel(request);
}

export function compileSource(
  request: Malloy.CompileSourceRequest
): Malloy.CompileSourceResponse {
  return Core.compileSource(request);
}

export function compileQuery(
  request: Malloy.CompileQueryRequest
): Malloy.CompileQueryResponse {
  return Core.compileQuery(request);
}

export function extractSourceDependencies(
  request: Malloy.ExtractSourceDependenciesRequest
): Malloy.ExtractSourceDependenciesResponse {
  const resp = Core.extractSourceDependencies(request);

  resp.sql_sources = [
    {
      connection_name: 'connection',
      name: 'flights',
      schema: {
        fields: [
          {
            kind: 'dimension',
            name: 'carrier',
            type: {kind: 'string_type'},
          },
        ],
      },
    },
  ];

  return resp;
}
