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
  factory: async (config: ConnectionConfig, rawConfigData) => {
    // rawConfigData rides in the options bag so `getDigest` can tell which
    // auth client this connection was given; the constructor keeps it out of
    // the retained config.
    return new BigQueryConnection({...config, rawConfigData});
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
    // The string-typed twin of `serviceAccountKey`. A `json` slot holds its
    // value literally — an `{env: "..."}` reference is never resolved in one —
    // so a deployment holding its key in an environment variable has no way to
    // use the slot above. This is a `secret` string, where references do
    // resolve, and the connection parses what arrives.
    {
      name: 'serviceAccountKeyJson',
      displayName: 'Service Account Key (JSON)',
      type: 'secret',
      optional: true,
      description:
        'The entire service account key file, as JSON or base64-encoded ' +
        'JSON (detected automatically), for supplying the key from an ' +
        'environment variable or secret manager rather than from disk.',
    },
    // A google-auth-library AuthClient, for credentials Malloy cannot build
    // from config text: impersonation, workload identity federation, a proxied
    // or test credential. The config file names an overlay, the host registers
    // it, and the value never appears in the file — which is what `opaque` plus
    // `source: 'overlay'` say. `mustHaveValue` is the safety half: an overlay
    // that isn't registered would otherwise drop the property and quietly fall
    // back to ambient credentials.
    //
    // When one is supplied, the SDK resolves the project id through it rather
    // than through ambient credentials, so set billingProjectId alongside.
    {
      name: 'authClient',
      displayName: 'Auth Client',
      type: 'opaque',
      source: 'overlay',
      mustHaveValue: true,
      optional: true,
      description: 'Not settable from the UI; supplied by the host.',
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
