/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export {PublisherConnection} from './publisher_connection';

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {PublisherConnection} from './publisher_connection';

registerConnectionType('publisher', {
  displayName: 'Malloy Publisher',
  factory: async (config: ConnectionConfig) => {
    const connectionUri = config['connectionUri'];
    if (typeof connectionUri !== 'string') {
      throw new Error(
        `Publisher connection "${config.name}" requires a connectionUri`
      );
    }
    return PublisherConnection.create(config.name, {
      connectionUri,
      accessToken:
        typeof config['accessToken'] === 'string'
          ? config['accessToken']
          : undefined,
    });
  },
  properties: [
    {
      name: 'connectionUri',
      displayName: 'Connection URI',
      type: 'string',
    },
    {
      name: 'accessToken',
      displayName: 'Access Token',
      type: 'secret',
      optional: true,
    },
  ],
});
