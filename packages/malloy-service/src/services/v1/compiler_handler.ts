import * as grpc from "@grpc/grpc-js";
import {
  Malloy,
  Runtime,
  URLReader,
  LookupConnection,
  Connection,
  MalloyQueryData,
  SQLBlock,
  StructDef,
} from "@malloydata/malloy";
import { CompilerService, ICompilerServer } from "./compiler_grpc_pb";
import { CompileRequest, CompileResponse } from "./compiler_pb";

class CompilerHandler implements ICompilerServer {
  compile = (
    call: grpc.ServerUnaryCall<CompileRequest, CompileResponse>,
    callback: grpc.sendUnaryData<CompileResponse>
  ): void => {
    const validationErrors = this.validate(call.request);
    const response = new CompileResponse();
    if (validationErrors.length != 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: validationErrors.join(","),
      });
    }

    try {
      const modelUrl = new URL(call.request.getDocument()!.getUrl());
      const compilerRuntime = new CompilerRuntime(call.request);
      const compilerURLReader = new CompilerURLReader(call.request);

      function malloy_dot_methods() {
        console.log("######## RUNNING USING MALLOY DOT METHODS ########");
        Malloy.parse({
          url: modelUrl,
          urlReader: compilerURLReader,
        })
          .then((parse) => {
            console.log("parsed...");
            return Malloy.compile({
              urlReader: compilerURLReader,
              connections: compilerRuntime,
              parse: parse,
            });
          })
          .then((model) => {
            console.log("compiled...");
            console.log(JSON.stringify(model, null, 2));
            response.setModel(JSON.stringify(model));
            response.setSql(
              model.getPreparedQueryByName(call.request.getQuery())
                .preparedResult.sql
            );
            callback(null, response);
          })
          .catch((error) => {
            console.log(error);
            callback({ code: grpc.status.INTERNAL, message: error });
          });
      }

      function runtime_methods() {
        console.log("######## RUNNING USING MALLOY RUNTIME ########");
        const runtime = new Runtime(compilerURLReader, compilerRuntime);
        runtime
          .loadModel(modelUrl)
          .getModel()
          .then((model) => {
            console.log(`Model loaded...`);
            console.log(JSON.stringify(model, null, 2));
            response.setModel(JSON.stringify(model));
          })
          .then(() => runtime.getQueryByName(modelUrl, call.request.getQuery()))
          .then((query) => {
            console.log(`sql: ${JSON.stringify(query)}`);
            response.setSql(JSON.stringify(query));
          })
          .then(() => {
            console.log("Response:");
            console.log(JSON.stringify(response, null, 2));
            callback(null, response);
          })
          .catch((error) => {
            console.log(error);
            callback({ code: grpc.status.INTERNAL, message: error });
          });
      }

      function runtime_methods_different_load() {
        console.log("######## RUNNING USING MALLOY RUNTIME ########");
        const runtime = new Runtime(compilerURLReader, compilerRuntime);
        runtime
          .loadQueryByName(modelUrl, call.request.getQuery())
          .getSQL()
          .then((sql) => {
            response.setSql(sql);
            callback(null, response);
          })
          .catch((error) => {
            console.log(error);
            callback({ code: grpc.status.INTERNAL, message: error });
          });
      }
      // malloy_dot_methods();
      // runtime_methods();
      runtime_methods_different_load();
    } catch (ex) {
      console.log(ex);
      callback({
        code: grpc.status.INTERNAL,
        message: "An internal error has occurred",
      });
    }
  };

  private validate(request: CompileRequest): string[] {
    const errors: string[] = [];
    if (!request.hasDocument()) {
      errors.push("No document to compile was provided");
    }

    return errors;
  }
}

class CompilerURLReader implements URLReader {
  private request: CompileRequest;

  constructor(request: CompileRequest) {
    this.request = request;
  }

  readURL = async (url: URL): Promise<string> => {
    const urlString = decodeURI(url.toString());
    console.log("readURL() called:");
    console.log(urlString);
    if (this.request.getDocument()?.getUrl() == urlString) {
      console.log("found URL");
      return this.request.getDocument()!.getContent();
    }

    for (const reference of this.request.getReferencesList()) {
      if (reference.getUrl() == urlString) {
        console.log("found reference URL");
        return reference.getContent();
      }
    }

    throw new Error(`No document defined for url: ${urlString}`);
  };
}

class CompilerRuntime implements LookupConnection<Connection>, Connection {
  private request: CompileRequest;
  private schemas: Record<string, StructDef>;

  constructor(request: CompileRequest) {
    this.request = request;
    this.schemas = JSON.parse(this.request.getSchema())["schemas"] as Record<
      string,
      StructDef
    >;
  }

  runSQL = async (sql: string, options?: unknown): Promise<MalloyQueryData> => {
    console.log("ERROR: runSQL() called.");
    throw new Error("Method not implemented.");
  };

  isPool = async (): Promise<Boolean> => {
    console.log("ERROR: isPool() called.");
    throw new Error("Method not implemented.");
  };

  canPersist = async (): Promise<Boolean> => {
    console.log("ERROR: canPersist() called.");
    throw new Error("Method not implemented.");
  };

  canFetchSchemaAndRunSimultaneously = async (): Promise<Boolean> => {
    console.log("ERROR: canFetchSchemaAndRunSimultaneously() called.");
    throw new Error("Method not implemented.");
  };

  canStream = async (): Promise<Boolean> => {
    console.log("ERROR: canStream() called.");
    throw new Error("Method not implemented.");
  };

  canFetchSchemaAndRunStreamSimultaneously = async (): Promise<Boolean> => {
    console.log("ERROR: canFetchSchemaAndRunStreamSimultaneously() called.");
    throw new Error("Method not implemented.");
  };

  async fetchSchemaForTables(tables: string[]): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    console.log(JSON.stringify(tables));
    for (const table of tables) {
      if (!(table in this.schemas)) {
        throw new Error(`Requested table (${table}) not found in schema data.`);
      }
    }
    return { schemas: this.schemas, errors: {} };
  }

  fetchSchemaForSQLBlocks(sqlStructs: SQLBlock[]): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    console.log("ERROR: fetchSchemaForSQLBlocks() called.");
    throw new Error("Method not implemented.");
  }

  get name(): string {
    console.log("ERROR: name() called.");
    throw new Error("Method not implemented.");
  }

  lookupConnection = async (
    connectionName?: string | undefined
  ): Promise<Connection> => {
    console.log("lookupConnection() called.");
    return this as Connection;
  };
}

export default {
  service: CompilerService,
  handler: new CompilerHandler(),
};
