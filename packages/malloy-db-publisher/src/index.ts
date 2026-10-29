/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
