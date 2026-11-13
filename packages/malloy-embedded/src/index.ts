/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Order matters: the globals must exist before the modules that read them
// load. ES module evaluation follows import order.
import './globals';
import './url';
import {API} from '@malloydata/malloy';
import type * as Malloy from '@malloydata/malloy-interfaces';

declare const __MALLOY_VERSION__: string;

/**
 * What the bundle installs as `globalThis.malloyEmbedded`.
 *
 * Every function takes a request as a JSON string and returns the response
 * as a JSON string, so a host only has to move strings across the engine
 * boundary. Requests and responses are the stable types from
 * `@malloydata/malloy-interfaces`, exactly as for `API.stateless`; see
 * CONTEXT.md for the needs loop a host runs around them.
 *
 * None of these throw. An exception inside the compiler comes back as a
 * response whose `logs` holds one error.
 */
export interface MalloyEmbedded {
  version: string;
  compileModel(requestJSON: string): string;
  compileSource(requestJSON: string): string;
  compileQuery(requestJSON: string): string;
}

function wrap<Req extends {model_url: string}, Res>(
  fn: (request: Req) => Res
): (requestJSON: string) => string {
  return (requestJSON: string) => {
    let url = 'internal://malloy-embedded';
    try {
      const request = JSON.parse(requestJSON) as Req;
      if (typeof request?.model_url === 'string') {
        url = request.model_url;
      }
      return JSON.stringify(fn(request));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const failure: {logs: Malloy.LogMessage[]} = {
        logs: [
          {
            url,
            severity: 'error',
            message,
            range: {
              start: {line: 0, character: 0},
              end: {line: 0, character: 0},
            },
          },
        ],
      };
      return JSON.stringify(failure);
    }
  };
}

const malloyEmbedded: MalloyEmbedded = {
  version: __MALLOY_VERSION__,
  compileModel: wrap(API.stateless.compileModel),
  compileSource: wrap(API.stateless.compileSource),
  compileQuery: wrap(API.stateless.compileQuery),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).malloyEmbedded = malloyEmbedded;
