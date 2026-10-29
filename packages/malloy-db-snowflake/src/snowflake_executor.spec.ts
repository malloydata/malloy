/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {SnowflakeExecutor} from './snowflake_executor';

const SNOWFLAKE_VARS = [
  'SNOWFLAKE_ACCOUNT',
  'SNOWFLAKE_USER',
  'SNOWFLAKE_PASSWORD',
  'SNOWFLAKE_ROLE',
  'SNOWFLAKE_WAREHOUSE',
  'SNOWFLAKE_DATABASE',
  'SNOWFLAKE_SCHEMA',
  'SNOWFLAKE_AUTHENTICATOR',
  'SNOWFLAKE_PRIVATE_KEY_RAW',
  'SNOWFLAKE_PRIVATE_KEY_FILE',
  'SNOWFLAKE_PRIVATE_KEY_PASSPHRASE',
];

describe('getConnectionOptionsFromEnv', () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const name of SNOWFLAKE_VARS) {
      saved.set(name, process.env[name]);
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const [name, value] of saved) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    saved.clear();
  });

  it('returns undefined when SNOWFLAKE_ACCOUNT is unset', () => {
    process.env['SNOWFLAKE_USER'] = 'someone';
    expect(SnowflakeExecutor.getConnectionOptionsFromEnv()).toBeUndefined();
  });

  it('returns undefined when SNOWFLAKE_ACCOUNT is empty', () => {
    // A GitHub Actions secret that does not exist interpolates to '', not unset.
    process.env['SNOWFLAKE_ACCOUNT'] = '';
    expect(SnowflakeExecutor.getConnectionOptionsFromEnv()).toBeUndefined();
  });

  it('maps the key-pair variables onto the driver option names', () => {
    process.env['SNOWFLAKE_ACCOUNT'] = 'acct';
    process.env['SNOWFLAKE_AUTHENTICATOR'] = 'SNOWFLAKE_JWT';
    process.env['SNOWFLAKE_PRIVATE_KEY_RAW'] = '-----BEGIN PRIVATE KEY-----';
    process.env['SNOWFLAKE_PRIVATE_KEY_FILE'] = '/keys/malloy.p8';
    process.env['SNOWFLAKE_PRIVATE_KEY_PASSPHRASE'] = 'hunter2';

    expect(SnowflakeExecutor.getConnectionOptionsFromEnv()).toMatchObject({
      authenticator: 'SNOWFLAKE_JWT',
      privateKey: '-----BEGIN PRIVATE KEY-----',
      privateKeyPath: '/keys/malloy.p8',
      privateKeyPass: 'hunter2',
    });
  });

  it('maps the identity and namespace variables', () => {
    process.env['SNOWFLAKE_ACCOUNT'] = 'acct';
    process.env['SNOWFLAKE_USER'] = 'user';
    process.env['SNOWFLAKE_PASSWORD'] = 'pw';
    process.env['SNOWFLAKE_ROLE'] = 'role';
    process.env['SNOWFLAKE_WAREHOUSE'] = 'wh';
    process.env['SNOWFLAKE_DATABASE'] = 'db';
    process.env['SNOWFLAKE_SCHEMA'] = 'sch';

    expect(SnowflakeExecutor.getConnectionOptionsFromEnv()).toMatchObject({
      account: 'acct',
      username: 'user',
      password: 'pw',
      role: 'role',
      warehouse: 'wh',
      database: 'db',
      schema: 'sch',
    });
  });

  it('applies the shared connection defaults', () => {
    // jsTreatIntegerAsBigInt is load-bearing: without it, integer columns lose
    // precision. The env path must not diverge from the toml path here.
    process.env['SNOWFLAKE_ACCOUNT'] = 'acct';
    expect(SnowflakeExecutor.getConnectionOptionsFromEnv()).toMatchObject({
      jsTreatIntegerAsBigInt: true,
      clientSessionKeepAlive: true,
    });
  });
});
