/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export {PublisherConnection} from './publisher_connection';

import {
  queryOptionsFromConnectionConfig,
  registerConnectionType,
  ROW_LIMIT_CONNECTION_PROPERTY,
} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {PublisherConnection} from './publisher_connection';

// Publisher forwards to a remotely configured connection. Accept a local
// override, but do not inject the local default over the remote connection's
// own configured rowLimit.
const {default: _defaultRowLimit, ...publisherRowLimitProperty} =
  ROW_LIMIT_CONNECTION_PROPERTY;

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
      queryOptions:
        config['rowLimit'] === undefined
          ? undefined
          : queryOptionsFromConnectionConfig(config),
    });
  },
  properties: [
    publisherRowLimitProperty,
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
