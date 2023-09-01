import { TextmateTestConfig, TestItem } from "../test/testUtils";
import { generateTextmateTokenizations } from "../test/generateTextmateTokenizations";
import { writeFileSync } from "fs";
import { inspect } from "util";

import malloyDarkPlusConfig from "../test/config/textmate/malloyDarkPlusConfig";

export {};

function writeTokenizations(tokenizations: TestItem[][], outputPath: string) {
  const outputTemplate = `
export default ${inspect(tokenizations, {
    depth: null,
  })};`;
  writeFileSync(outputPath, outputTemplate, "utf-8");
}

async function generateTokenizationFile(
  config: TextmateTestConfig,
  outputPath: string
) {
  const tokenizations = await generateTextmateTokenizations(config);
  writeTokenizations(tokenizations, outputPath);
}

// TODO: Validate command line args
generateTokenizationFile(malloyDarkPlusConfig, process.argv[2]);
