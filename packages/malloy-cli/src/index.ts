/* eslint-disable no-console */
import { Options } from "./options";
import { FileGetter, Malloy, QueryResult, Runtime } from "malloy";
import * as fs from "fs";
import * as util from "util";
import { Config } from "./config";
import { getConnections } from "./connections";

class FileSystem implements FileGetter {
  async getFile(uri: string): Promise<string> {
    if (uri.startsWith("file://")) {
      uri = uri.substring("file://".length);
    }
    return await util.promisify(fs.readFile)(uri, "utf8");
  }
}

export interface Loggable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (message?: any, ...optionalParams: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (message?: any, ...optionalParams: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (message?: any, ...optionalParams: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (message?: any, ...optionalParams: any[]) => void;
}

export async function getResult(
  files: FileGetter,
  options: Options,
  config: Config
): Promise<QueryResult> {
  const connections = getConnections(options, config);
  const malloy = new Malloy(new Runtime(connections, files));
  return malloy.runQuery(options.querySpec);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function run(
  files: FileGetter,
  logger: Loggable,
  args: string[]
): Promise<void> {
  try {
    const options = Options.fromArgs(args);
    let configFile: string | undefined;
    {
      try {
        configFile = await files.getFile(options.configUri);
      } catch (error) {
        /* Silently fail for now. */
      }
    }
    const config = Config.fromString(configFile);

    const result = await getResult(files, options, config);
    logger.info(result.result);
  } catch (error) {
    logger.error(error.message);
  }
}

export async function main(): Promise<void> {
  const files = new FileSystem();
  await run(files, console, process.argv.slice(2));
}
