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
  PersistSQLResults,
  PooledConnection,
} from "@malloydata/malloy";
import { RunSQLOptions } from "@malloydata/malloy/src/malloy";
import {
  FetchSchemaAndRunSimultaneously,
  StreamingConnection,
  FetchSchemaAndRunStreamSimultaneously,
} from "@malloydata/malloy/src/runtime_types";
import { CompilerService, ICompilerServer } from "./compiler_grpc_pb";
import {
  CompileDocument,
  CompileRequest,
  CompileResponse,
  CompilerRequest,
} from "./compiler_pb";

class CompilerHandler implements ICompilerServer {
  compileStream = (
    call: grpc.ServerDuplexStream<CompileRequest, CompilerRequest>
  ): void => {
    console.log("compileStream Called");
    const urlReader = new StreamingCompileURLReader();
    const connection = new StreamingCompileConnection();
    const runtime = new Runtime(urlReader, connection);
    let modelUrl: URL | undefined = undefined;
    let query = "";
    call.on("data", (request: CompileRequest) => {
      console.log("compile stream data received");
      const response = new CompilerRequest();
      response.setType(CompilerRequest.Type.UNKNOWN);

      switch (request.getType()) {
        case CompileRequest.Type.COMPILE:
          console.log("COMPILE received");
          const document = request.getDocument();
          if (document === undefined) {
            response.setContent("Document must be defined for compile request");
            call.write(response);
            return;
          }
          modelUrl = new URL(document.getUrl());
          query = request.getQuery();
          urlReader.addDoc(document);
          break;
        case CompileRequest.Type.REFERENCES:
          console.log("REFERENCES received");
          urlReader.addDocs(request.getReferencesList());
          break;
        case CompileRequest.Type.TABLE_SCHEMAS:
          console.log("TABLE SCHEMAS received");
          const rawJson = JSON.parse(request.getSchema());
          for (const [name, schema] of Object.entries(rawJson["schemas"])) {
            connection.addTableSchema(name, schema as StructDef);
          }
          break;
      }

      if (modelUrl === undefined) {
        response.setContent("Compile document url is undefined");
        call.write(response);
        return;
      }

      runtime
        .loadModel(modelUrl)
        .getModel()
        .then((model) => model.getPreparedQueryByName(query))
        .then((query) => query.preparedResult.sql)
        .then((sql) => response.setContent(sql))
        .then(() => response.setType(CompilerRequest.Type.COMPLETE))
        .catch((error) => this.mapErrorToResponse(response, error))
        .finally(() => {
          call.write(response);
        });
    });
    call.on("end", () => {
      console.log("compile session ended");
    });
  };
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
            // console.log(`Model loaded...`);
            // console.log(JSON.stringify(model, null, 2));
            response.setModel(JSON.stringify(model));
          })
          .then(() =>
            runtime.loadQueryByName(modelUrl, call.request.getQuery())
          )
          .then((query) => query.getSQL())
          .then((sql) => {
            // console.log(`sql: ${JSON.stringify(query)}`);
            response.setSql(sql);
          })
          .then(() => {
            // console.log("Response:");
            // console.log(JSON.stringify(response, null, 2));
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
      runtime_methods();
      // runtime_methods_different_load();
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

  private mapErrorToResponse(response: CompilerRequest, error: any) {
    if (error instanceof MissingReferenceError) {
      response.setType(CompilerRequest.Type.IMPORT);
      response.addImportUrls(error.message);
      return;
    }

    if (error.log && error.log[0] && error.log[0].message) {
      const importRegex = new RegExp(/^import error: mlr:\/\/(.+)$/);
      if (importRegex.test(error.log[0].message)) {
        response.setType(CompilerRequest.Type.IMPORT);
        for (const log of error.log) {
          const matches = log.message.match(importRegex);
          if (matches.length > 0) {
            response.addImportUrls(matches[1]);
          } else {
            // console.warn(`Processing import errors, ignoring: ${log.message}`);
          }
        }
        console.log(response);
        return;
      }

      const schemaRegex = new RegExp(
        /^Schema error\s'(.+)':\sNo schema data available$/
      );
      if (schemaRegex.test(error.log[0].message)) {
        response.setType(CompilerRequest.Type.TABLE_SCHEMAS);
        for (const log of error.log) {
          const matches = log.message.match(schemaRegex);
          if (matches && matches.length > 0) {
            response.addTableSchemas(matches[1]);
          } else {
            // console.warn(`Processing table schemas, ignoring: ${log.message}`);
          }
        }
        return;
      }
    }

    response.setType(CompilerRequest.Type.UNKNOWN);
    response.setContent(error.message);
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
    try {
      this.schemas = JSON.parse(this.request.getSchema())["schemas"] as Record<
        string,
        StructDef
      >;
    } catch (ex) {
      this.schemas = {};
      console.warn("Error parsing schema");
      console.warn(ex);
    }
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

class MissingReferenceError extends Error {}
class MissingTableSchemasError extends Error {
  public tables: string[];
  constructor(tables: string[]) {
    super();
    this.tables = tables;
  }
}

class StreamingCompileURLReader implements URLReader {
  private doc_cache = new Map<string, string>();

  readURL = async (url: URL): Promise<string> => {
    const docUrl = this.urlToString(url);
    const doc = this.doc_cache.get(docUrl);
    if (doc === undefined) {
      throw new MissingReferenceError(docUrl);
    }
    return doc;
  };

  hasDoc = (url: URL): boolean => {
    return this.doc_cache.has(this.urlToString(url));
  };

  addDocs = (docs: CompileDocument[]): void => docs.forEach(this.addDoc);

  addDoc = (doc: CompileDocument): void => {
    this.doc_cache.set(doc.getUrl(), doc.getContent());
  };

  private urlToString = (url: URL): string => {
    return decodeURI(url.toString());
  };
}

class StreamingCompileConnection implements Connection {
  private table_schema_cache = new Map<string, StructDef>();

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
    const result = {
      schemas: {} as Record<string, StructDef>,
      errors: {} as Record<string, string>,
    };
    for (const table of tables) {
      const schema = this.table_schema_cache.get(table);
      if (schema === undefined) {
        result.errors[table] = "No schema data available";
      } else {
        result.schemas[table] = schema;
      }
    }

    return result;
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

  addTableSchema = (name: string, schema: StructDef): void => {
    this.table_schema_cache.set(name, schema);
  };
}
