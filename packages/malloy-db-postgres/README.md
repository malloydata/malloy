# Malloy

Malloy is a modern open source language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy currently connects to BigQuery and Postgres, and natively supports DuckDB. We've built a Visual Studio Code extension to facilitate building Malloy data models, querying and transforming data, and creating simple visualizations and dashboards.

## This package

This package facilitates using the `malloydata/malloy` library with Postgres - see [here](https://github.com/malloydata/malloy/blob/main/packages/malloy/README.md) for additional information.

## Verified TLS through a tunnel

`PostgresConnectionConfiguration.ssl` is forwarded verbatim to `pg`'s TLS options. To get servername-based certificate verification through a local tunnel (e.g. an SSH bastion forwarding to a remote Postgres), connect via the loopback IP rather than `localhost` — `pg` overwrites `servername` with `host` whenever `host` is a DNS name. If the certificate doesn't match the host `pg` connects to, `pg` throws a certificate error and the connector annotates it with this servername/host guidance.

```ts
import {PostgresConnection} from '@malloydata/db-postgres';

const connection = new PostgresConnection({
  name: 'tunneled_postgres',
  host: '127.0.0.1', // must be an IP, not 'localhost', for servername to take effect
  port: 5432,
  ssl: {
    servername: 'db.example.com',
    ca: '<PEM-encoded CA certificate>',
  },
});
```

### Semantics (pg/Node `tls`, not libpq)

- `ssl: true` — full verification against the system trust store, hostname included (verify-full). A self-signed or custom-CA server fails unless you supply `ca` (and/or set `servername` for a tunnel).
- `ssl: { rejectUnauthorized: false }` — encrypt but do **not** verify (libpq's `sslmode=require`/`no-verify`). Use only when verification is impossible; it does not stop MITM.
- `ssl: { ca }` — trust a specific CA (a PEM string, or an array of PEMs for rotation). This is the path for AWS RDS (or use `NODE_EXTRA_CA_CERTS`) and Cloud SQL.
- **verify-ca** against a cert whose SAN/CN doesn't match any reachable name (e.g. Cloud SQL *legacy* per-instance certs) needs a `checkServerIdentity` override. That is a function, so it is **not** expressible in a saved `json` config — construct the connection programmatically and pass the full `pg` `ssl` (`tls.ConnectionOptions`) directly.

Do **not** put TLS parameters in both `ssl` and the `connectionString`: `pg` merges URL ssl params (`sslmode`, `sslrootcert`, …) *over* the `ssl` object, silently dropping it. Set TLS in one place.

`ssl` is passed through literally — `json` config is never reference-resolved (a malloy security invariant), so `key`/`passphrase` cannot be pulled from an `{env:...}`/overlay reference. Inject secret material programmatically at construction time; never persist it in a shared connection config.
