import "jasmine";

import { generateTextmateTokenizations } from "../../test/generateTextmateTokenizations";
import expectedTokenizations from "./tokenizations/darkPlus";
import testConfig from "../../test/config/textmate/malloyDarkPlusConfig";
import { TestItem } from "../../test/testUtils";

let actualTokenizations: TestItem[][];

beforeAll(async () => {
  actualTokenizations = await generateTextmateTokenizations(testConfig);
});
describe("malloy", () => {
  for (let i = 0; i < testConfig.testInput.length; i++) {
    const block = testConfig.testInput[i]
      .map((line) => `\t^${line}$`)
      .join("\n");
    it(`correctly tokenizes\n${block}\n\twith correct colors`, () => {
      expect(actualTokenizations[i]).toEqual(expectedTokenizations[i]);
    });
  }
});
