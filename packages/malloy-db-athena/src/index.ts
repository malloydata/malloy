/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export type {
  AthenaCommandSender,
  AthenaConnectionConfiguration,
} from './athena_runner';
export {AthenaRunner, decodeCell} from './athena_runner';
export {AthenaConnection} from './athena_connection';
export {AthenaExecutor} from './athena_executor';

import {registerConnectionType} from '@malloydata/malloy';
import type {
  ConnectionConfig,
  ConnectionPropertyDefinition,
} from '@malloydata/malloy';
import {AthenaConnection} from './athena_connection';
import type {AthenaConnectionConfiguration} from './athena_runner';

function configToAthenaConfig(
  config: ConnectionConfig
): AthenaConnectionConfiguration {
  const str = (key: string) =>
    typeof config[key] === 'string' ? (config[key] as string) : undefined;
  return {
    region: str('region'),
    workGroup: str('workGroup'),
    catalog: str('catalog'),
    database: str('database'),
    outputLocation: str('outputLocation'),
    resultReuseMaxAgeMinutes:
      typeof config['resultReuseMaxAgeMinutes'] === 'number'
        ? config['resultReuseMaxAgeMinutes']
        : undefined,
    accessKeyId: str('accessKeyId'),
    secretAccessKey: str('secretAccessKey'),
    sessionToken: str('sessionToken'),
  };
}

const athenaProperties: ConnectionPropertyDefinition[] = [
  {
    name: 'region',
    displayName: 'Region',
    type: 'string',
    optional: true,
    description:
      'AWS region of the workgroup; the SDK default applies when unset',
  },
  {
    name: 'workGroup',
    displayName: 'Workgroup',
    type: 'string',
    optional: true,
    description: 'Athena workgroup, which must run engine version 3',
  },
  {
    name: 'catalog',
    displayName: 'Catalog',
    type: 'string',
    optional: true,
    description: 'Data catalog; AwsDataCatalog when unset',
  },
  {
    name: 'database',
    displayName: 'Database',
    type: 'string',
    optional: true,
    description: 'Default database for unqualified table names',
  },
  {
    name: 'outputLocation',
    displayName: 'Output Location',
    type: 'string',
    optional: true,
    description:
      'S3 location for query results; leave unset for a workgroup that enforces its own',
  },
  {
    name: 'resultReuseMaxAgeMinutes',
    displayName: 'Result Reuse (minutes)',
    type: 'number',
    optional: true,
    advanced: true,
    description:
      'Serve a repeated statement from a result no older than this instead of running it again',
  },
  {
    name: 'accessKeyId',
    displayName: 'Access Key ID',
    type: 'string',
    optional: true,
    advanced: true,
    description:
      'Static credentials; when unset the AWS default credential chain applies',
  },
  {
    name: 'secretAccessKey',
    displayName: 'Secret Access Key',
    type: 'password',
    optional: true,
    advanced: true,
  },
  {
    name: 'sessionToken',
    displayName: 'Session Token',
    type: 'password',
    optional: true,
    advanced: true,
  },
];

registerConnectionType('athena', {
  displayName: 'Amazon Athena',
  factory: async (config: ConnectionConfig) => {
    return new AthenaConnection(config.name, configToAthenaConfig(config));
  },
  properties: athenaProperties,
});
