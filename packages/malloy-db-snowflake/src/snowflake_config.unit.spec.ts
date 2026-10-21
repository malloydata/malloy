/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MalloyConfig} from '@malloydata/malloy';
import snowflake from 'snowflake-sdk';
import {
  SnowflakeConnection,
  withKeyPairAuthenticator,
} from './snowflake_connection';
// Registers the 'snowflake' connection type for the MalloyConfig tests.
import './index';

const PEM =
  '-----BEGIN PRIVATE KEY-----\nMIIBVQ==\n-----END PRIVATE KEY-----\n';

describe('withKeyPairAuthenticator', () => {
  it('selects SNOWFLAKE_JWT for a private key with no authenticator', () => {
    expect(
      withKeyPairAuthenticator({account: 'a', privateKey: PEM}).authenticator
    ).toBe('SNOWFLAKE_JWT');
  });

  it('selects SNOWFLAKE_JWT for a private key path with no authenticator', () => {
    expect(
      withKeyPairAuthenticator({account: 'a', privateKeyPath: '/k.p8'})
        .authenticator
    ).toBe('SNOWFLAKE_JWT');
  });

  it('leaves an explicit authenticator alone', () => {
    expect(
      withKeyPairAuthenticator({
        account: 'a',
        privateKey: PEM,
        authenticator: 'OAUTH',
      }).authenticator
    ).toBe('OAUTH');
  });

  it('leaves password auth alone', () => {
    expect(
      withKeyPairAuthenticator({account: 'a', password: 'p'}).authenticator
    ).toBeUndefined();
  });
});

describe('Snowflake key-pair auth from a Malloy config', () => {
  const KEY_ENV = 'TEST_SNOWFLAKE_PRIVATE_KEY';
  const PASS_ENV = 'TEST_SNOWFLAKE_KEY_PASSPHRASE';
  let createPool: jest.SpyInstance;
  let conn: SnowflakeConnection | undefined;

  beforeEach(() => {
    process.env[KEY_ENV] = PEM;
    process.env[PASS_ENV] = 'hunter2';
    createPool = jest.spyOn(snowflake, 'createPool');
  });

  afterEach(async () => {
    await conn?.close();
    conn = undefined;
    createPool.mockRestore();
    delete process.env[KEY_ENV];
    delete process.env[PASS_ENV];
  });

  async function connect(
    entry: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const config = new MalloyConfig({
      connections: {
        // poolMin 0 so the pool opens no connection to the fake account.
        sf: {is: 'snowflake', account: 'acme', poolMin: 0, ...entry},
      },
    });
    expect(config.log).toEqual([]);
    const found = await config.connections.lookupConnection('sf');
    expect(found).toBeInstanceOf(SnowflakeConnection);
    if (found instanceof SnowflakeConnection) conn = found;
    expect(createPool).toHaveBeenCalledTimes(1);
    return createPool.mock.calls[0][0];
  }

  it('reaches the driver as key-pair auth with no authenticator written', async () => {
    const opts = await connect({
      username: 'malloy',
      privateKey: {env: KEY_ENV},
      privateKeyPass: {env: PASS_ENV},
    });
    expect(opts).toMatchObject({
      authenticator: 'SNOWFLAKE_JWT',
      privateKey: PEM,
      privateKeyPass: 'hunter2',
    });
  });

  it('passes a written authenticator through to the driver', async () => {
    const opts = await connect({
      username: 'malloy',
      authenticator: 'EXTERNALBROWSER',
    });
    expect(opts['authenticator']).toBe('EXTERNALBROWSER');
  });
});
