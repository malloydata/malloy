/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

export {BigQueryConnection} from './bigquery_connection';

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {BigQueryConnection} from './bigquery_connection';

registerConnectionType('bigquery', {
  factory: (config: ConnectionConfig) => {
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
      displayName: 'Service Account Key',
      type: 'file',
      optional: true,
      fileFilters: {JSON: ['json']},
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
    },
    {
      name: 'timeoutMs',
      displayName: 'Timeout (ms)',
      type: 'string',
      optional: true,
    },
    {
      name: 'billingProjectId',
      displayName: 'Billing Project ID',
      type: 'string',
      optional: true,
    },
    {
      name: 'setupSQL',
      displayName: 'Setup SQL',
      type: 'text',
      optional: true,
      description: 'SQL statements to run when the connection is established',
    },
  ],
});
