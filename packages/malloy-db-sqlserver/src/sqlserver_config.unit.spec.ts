/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {driverConfig, SQLServerConnection} from '.';

// The configuration a user writes, mapped to what tedious is handed. No
// server is involved.
describe('SQL Server driver configuration', () => {
  it('defaults to a SQL login on 1433, encrypted, reading UTC', () => {
    const c = driverConfig({
      server: 'db.example.com',
      user: 'u',
      password: 'p',
    });
    expect(c.server).toBe('db.example.com');
    expect(c.port).toBe(1433);
    expect(c.authentication).toEqual({
      type: 'default',
      options: {userName: 'u', password: 'p'},
    });
    expect(c.options).toMatchObject({
      encrypt: true,
      trustServerCertificate: false,
      useUTC: true,
    });
  });

  it('maps Entra authentication kinds onto tedious', () => {
    expect(
      driverConfig({server: 's', authentication: 'azure-default'})
        .authentication
    ).toEqual({
      type: 'azure-active-directory-default',
      options: {clientId: undefined},
    });
    expect(
      driverConfig({
        server: 's',
        authentication: 'azure-service-principal',
        clientId: 'cid',
        clientSecret: 'sec',
        tenantId: 'tid',
      }).authentication
    ).toEqual({
      type: 'azure-active-directory-service-principal-secret',
      options: {clientId: 'cid', clientSecret: 'sec', tenantId: 'tid'},
    });
    expect(
      driverConfig({
        server: 's',
        authentication: 'azure-access-token',
        accessToken: 'tok',
      }).authentication
    ).toEqual({
      type: 'azure-active-directory-access-token',
      options: {token: 'tok'},
    });
  });

  it('refuses a service principal missing its parts', () => {
    expect(() =>
      driverConfig({server: 's', authentication: 'azure-service-principal'})
    ).toThrow(/clientId, clientSecret and tenantId/);
  });

  it('refuses a connection string alongside structured fields', () => {
    expect(() =>
      driverConfig({connectionString: 'Server=x;', server: 'x'})
    ).toThrow(/connectionString and also server/);
    expect(
      driverConfig({connectionString: 'Server=x;'}).options?.connectionString
    ).toBe('Server=x;');
  });

  it('digests identity, never a secret', () => {
    const base = {server: 's', database: 'd', user: 'u', password: 'p'};
    const a = new SQLServerConnection('a', base).getDigest();
    expect(
      new SQLServerConnection('b', {...base, password: 'q'}).getDigest()
    ).toBe(a);
    expect(
      new SQLServerConnection('c', {...base, user: 'v'}).getDigest()
    ).not.toBe(a);
    expect(
      new SQLServerConnection('d', {...base, database: 'e'}).getDigest()
    ).not.toBe(a);
    expect(
      new SQLServerConnection('e', {...base, setupSQL: 'SET X'}).getDigest()
    ).not.toBe(a);
  });
});
