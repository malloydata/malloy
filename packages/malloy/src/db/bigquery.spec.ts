import { Malloy } from "../malloy";
import { BigQuery } from "./bigquery";
import { BigQuery as BigQuerySDK, TableMetadata } from "@google-cloud/bigquery";

describe("db:BigQuery", () => {
  let bq: BigQuery;
  beforeAll(() => {
    bq = new BigQuery();
  });

  it("runs a SQL query", async () => {
    const res = await bq.runQuery(`SELECT 1 as t`);
    expect(res[0]["t"]).toBe(1);
  });

  it("costs a SQL query", async () => {
    const res = await bq.costQuery(`SELECT * FROM malloy-data.faa.airports`);
    expect(res).toBe(3029200);
  });

  it("gets table schema", async () => {
    const res = await bq.getTableFieldSchema(`malloy-data.faa.carriers`);
    expect(res).toStrictEqual({
      fields: [
        { name: "code", type: "STRING" },
        { name: "name", type: "STRING" },
        { name: "nickname", type: "STRING" },
      ],
    });
  });

  it.todo("gets table structdefs");

  it("runs a Malloy query", async () => {
    const malloy = new Malloy();
    await malloy.parseAndLoadModel(
      "define carriers is (explore 'malloy-data.faa.carriers'\ncarrier_count is count());"
    );
    const sql = await malloy.computeSql(
      "explore carriers | reduce carrier_count"
    );
    const res = await bq.runMalloyQuery(sql);
    expect(res.rows[0]["carrier_count"]).toBe(21);
  });

  it("streams a Malloy query for download", async () => {
    const malloy = new Malloy();
    await malloy.parseAndLoadModel(
      "define carriers is (explore 'malloy-data.faa.carriers'\ncarrier_count is count());"
    );
    const sql = await malloy.computeSql("explore carriers | reduce name");
    const res = await bq.downloadMalloyQuery(sql);

    return new Promise((resolve) => {
      let count = 0;
      res.on("data", () => (count += 1));
      res.on("end", () => {
        expect(count).toBe(21);
        resolve(true);
      });
    });
  });

  it("manifests a temporary table", async () => {
    const fullTempTableName = await bq.manifestTemporaryTable("SELECT 1 as t");
    const splitTableName = fullTempTableName.split(".");
    const sdk = new BigQuerySDK();
    const dataset = sdk.dataset(splitTableName[1]);
    const table = dataset.table(splitTableName[2]);
    const exists = await table.exists();
    expect(exists).toBeTruthy();
  });

  describe.skip("manifests permanent table", () => {
    const datasetName = "test_malloy_test_dataset";
    const tableName = "test_malloy_test_table";
    const sdk = new BigQuerySDK();

    // delete entire dataset before each test and once tests are complete
    const deleteTestDataset = async () => {
      const dataset = sdk.dataset(datasetName);
      if ((await dataset.exists())[0]) {
        await dataset.delete({
          force: true,
        });
      }
    };
    beforeEach(deleteTestDataset);
    afterAll(deleteTestDataset);

    it("throws if dataset does not exist and createDataset=false", async () => {
      await expect(async () => {
        await bq.manifestPermanentTable(
          "SELECT 1 as t",
          datasetName,
          tableName,
          false,
          false
        );
      }).rejects.toThrowError(`Dataset ${datasetName} does not exist`);
    });

    it("creates dataset if createDataset=true", async () => {
      // note - dataset does not exist b/c of beforeEach()
      await bq.manifestPermanentTable(
        "SELECT 1 as t",
        datasetName,
        tableName,
        false,
        true
      );

      const dataset = sdk.dataset(datasetName);
      const [exists] = await dataset.exists();
      expect(exists).toBeTruthy();
    });

    it("throws if table exist and overwriteExistingTable=false", async () => {
      const newDatasetResponse = await sdk.createDataset(datasetName);
      const dataset = newDatasetResponse[0];
      const tableMeta: TableMetadata = { name: tableName };
      await dataset.createTable(tableName, tableMeta);

      await expect(async () => {
        await bq.manifestPermanentTable(
          "SELECT 1 as t",
          datasetName,
          tableName,
          false,
          true
        );
      }).rejects.toThrowError(`Table ${tableName} already exists`);
    });

    it("manifests a table", async () => {
      const jobId = await bq.manifestPermanentTable(
        "SELECT 1 as t",
        datasetName,
        tableName,
        false,
        true
      );

      // wait for job to complete
      const [job] = await sdk.job(jobId).get();
      let [metaData] = await job.getMetadata();
      while (metaData.status.state !== "DONE") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        [metaData] = await job.getMetadata();
      }

      // query the new table
      const [queryJob] = await sdk.createQueryJob(
        `SELECT * FROM ${datasetName}.${tableName}`
      );
      const [results] = await queryJob.getQueryResults();
      expect(results[0]).toStrictEqual({ t: 1 });
    });
  });
});
