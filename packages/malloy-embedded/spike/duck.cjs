/* eslint-disable */
// SPIKE harness: not product code. See README.md.
// node duck.cjs <db> <sql>  -> JSON rows on stdout. Stands in for the C++ host's
// synchronous "run this SQL in the database I'm loaded into".
const {DuckDBInstance} = require('@duckdb/node-api');
(async () => {
  const db = await DuckDBInstance.create(process.argv[2]);
  const conn = await db.connect();
  const reader = await conn.runAndReadAll(process.argv[3]);
  const rows = reader.getRowObjectsJson();
  process.stdout.write(JSON.stringify(rows));
})().catch(e => {
  process.stderr.write(String(e.message));
  process.exit(1);
});
