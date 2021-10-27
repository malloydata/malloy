import { ArgumentParser } from "argparse2";
import { QuerySpec } from "malloy";

export class Options {
  querySpec: QuerySpec;
  configUri: string;
  defaultConnectionName?: string;

  constructor({
    querySpec,
    configUri = "~/.malloy-cli.rc",
    defaultConnectionName,
  }: {
    querySpec: QuerySpec;
    configUri?: string;
    defaultConnectionName?: string;
  }) {
    this.querySpec = querySpec;
    this.configUri = configUri;
    this.defaultConnectionName = defaultConnectionName;
  }

  static fromArgs(args: string[]): Options {
    const parser = new ArgumentParser({ description: "The Malloy CLI" });
    parser.add_argument("-m", "--model", {
      help: "Path to a model file to run the query against.",
      type: "str",
    });
    parser.add_argument("-c", "--connection", {
      help: "The name of the default connection to use.",
      type: "str",
    });
    parser.add_argument("-q", "--query", {
      help: "A query string to run.",
      type: "str",
    });

    // parser.add_argument("-i", "--index", {
    //   help: "Index of an unnamed query to run, or -1 for the last query in the file.",
    // });

    // parser.add_argument("-n", "--name", {
    //   help: "Name of a query to run in the given model.",
    // });

    parser.add_argument("--config", {
      help: "Path to a config file.",
      type: "str",
    });

    const parsed = parser.parse_args(args);

    let querySpec: QuerySpec;
    {
      if (parsed.query && parsed.model) {
        querySpec = {
          query: parsed.query,
          modelUri: parsed.model,
        };
      } else if (parsed.query) {
        querySpec = {
          query: parsed.query,
        };
      } else {
        throw new Error("A query is required.");
      }
    }

    const options = new Options({
      querySpec,
      configUri: parsed.config,
      defaultConnectionName: parsed.connection,
    });

    return options;
  }
}
