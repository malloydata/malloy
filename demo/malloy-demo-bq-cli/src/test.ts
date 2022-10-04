import { BigQueryConnection } from "@malloydata/db-bigquery";

export function main(): void {
  const conn = new BigQueryConnection("fake");
  conn.fetchSchemaForTables(["malloy-data.faa.airports"]).then((schema) => {
    console.log(JSON.stringify(schema, null, 2));
  });
}

main();
