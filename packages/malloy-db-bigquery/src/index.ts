/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export {BigQueryConnection} from './bigquery_connection';

import {
  queryOptionsFromConnectionConfig,
  registerConnectionType,
  ROW_LIMIT_CONNECTION_PROPERTY,
} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {BigQueryConnection} from './bigquery_connection';

registerConnectionType('bigquery', {
  displayName: 'BigQuery',
  factory: async (config: ConnectionConfig) => {
    return new BigQueryConnection(
      config,
      queryOptionsFromConnectionConfig(config)
    );
  },
  properties: [
    ROW_LIMIT_CONNECTION_PROPERTY,
    {
      name: 'projectId',
      displayName: 'Project ID',
      type: 'string',
      optional: true,
    },
    {
      name: 'serviceAccountKeyPath',
      displayName: 'Service Account Key Path',
      type: 'file',
      optional: true,
      fileFilters: {JSON: ['json']},
    },
    {
      name: 'serviceAccountKey',
      displayName: 'Service Account Key',
      type: 'json',
      optional: true,
    },
    {
      name: 'location',
      displayName: 'Location',
      type: 'string',
      optional: true,
    },
    {
      name: 'maximumBytesBilled',
      displayName: 'Maximum Bytes Billed',
      type: 'string',
      optional: true,
      advanced: true,
    },
    {
      name: 'timeoutMs',
      displayName: 'Timeout (ms)',
      type: 'string',
      optional: true,
      advanced: true,
    },
    {
      name: 'billingProjectId',
      displayName: 'Billing Project ID',
      type: 'string',
      optional: true,
      advanced: true,
    },
    {
      name: 'setupSQL',
      displayName: 'Setup SQL',
      type: 'text',
      optional: true,
      advanced: true,
      description: 'SQL statements to run when the connection is established',
    },
  ],
});
