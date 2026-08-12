/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export {BigQueryConnection} from './bigquery_connection';

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {BigQueryConnection} from './bigquery_connection';

registerConnectionType('bigquery', {
  displayName: 'BigQuery',
  factory: async (config: ConnectionConfig) => {
    return new BigQueryConnection(config);
  },
  properties: [
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
    // The two string-typed twins of `serviceAccountKey`. A `json` slot holds
    // its value literally — an `{env: "..."}` reference is never resolved in
    // one — so a deployment holding its key in an environment variable has no
    // way to use the slot above. These are `secret` strings, where references
    // do resolve, and the connection parses what arrives.
    {
      name: 'serviceAccountKeyJson',
      displayName: 'Service Account Key (JSON)',
      type: 'secret',
      optional: true,
      description:
        'The entire service account key file as a JSON string, for supplying ' +
        'it from an environment variable or secret manager rather than from ' +
        'disk. Takes precedence over serviceAccountKeyJsonBase64.',
    },
    {
      name: 'serviceAccountKeyJsonBase64',
      displayName: 'Service Account Key (base64 JSON)',
      type: 'secret',
      optional: true,
      description:
        'The entire service account key file, base64-encoded — the same as ' +
        'serviceAccountKeyJson, for transports that mangle the quoting and ' +
        'newlines of raw JSON.',
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
