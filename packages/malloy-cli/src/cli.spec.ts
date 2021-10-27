import { NoFiles } from "malloy";
import { Config } from "./config";
import { getResult } from "./index";
import { Options } from "./options";

const noFiles = new NoFiles();
const noConfig = Config.fromString("");

it("runs a query", async () => {
  const result = await getResult(
    noFiles,
    Options.fromArgs([
      "--query",
      "'examples.flights' | reduce flight_count is count()",
      "-c",
      "bigquery-env",
    ]),
    noConfig
  );

  expect(result.result).toMatchObject([{ flight_count: 37561525 }]);
});
