/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import {
  Connection,
  FieldDef,
  FilterExpression,
  FixedConnectionMap,
  isFilteredAliasedName,
  Malloy,
  MalloyQueryData,
  ModelDef,
  PooledConnection,
  Runtime,
  StructDef,
  URLReader,
} from "@malloydata/malloy";
import { PersistSQLResults } from "@malloydata/malloy";
import {
  FetchSchemaAndRunSimultaneously,
  StreamingConnection,
  FetchSchemaAndRunStreamSimultaneously,
} from "@malloydata/malloy/src/runtime_types";

class DummyFiles implements URLReader {
  async readURL(): Promise<string> {
    return "";
  }
}

class DummyConnection implements Connection {
  name = "dummy";

  runSQL(): Promise<MalloyQueryData> {
    throw new Error("Dummy connection cannot run SQL.");
  }

  runSQLBlockAndFetchResultSchema(): Promise<{
    data: MalloyQueryData;
    schema: StructDef;
  }> {
    throw new Error("Dummy connection cannot run SQL blocks.");
  }

  fetchSchemaForSQLBlocks(): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    throw new Error("Dummy connection cannot fetch schemas.");
  }

  fetchSchemaForTables(): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    throw new Error("Dummy connection cannot fetch schemas.");
  }

  isPool(): this is PooledConnection {
    return false;
  }

  canPersist(): this is PersistSQLResults {
    return false;
  }

  canFetchSchemaAndRunSimultaneously(): this is FetchSchemaAndRunSimultaneously {
    return false;
  }

  canStream(): this is StreamingConnection {
    return false;
  }

  canFetchSchemaAndRunStreamSimultaneously(): this is FetchSchemaAndRunStreamSimultaneously {
    return false;
  }

  clearCache(): void {
    // n/a
  }
}

export async function compileModel(
  modelDef: ModelDef,
  malloy: string
): Promise<ModelDef> {
  const runtime = new Runtime(new DummyFiles(), new DummyConnection());
  const baseModel = await runtime._loadModelFromModelDef(modelDef).getModel();
  // TODO maybe a ModelMaterializer should have a `loadExtendingModel()` or something like that for this....
  const model = await Malloy.compile({
    urlReader: new DummyFiles(),
    connections: new FixedConnectionMap(
      new Map([["dummy", new DummyConnection()]]),
      "dummy"
    ),
    model: baseModel,
    parse: Malloy.parse({ source: malloy }),
  });
  return model._modelDef;
}

function modelDefForSource(source: StructDef): ModelDef {
  return {
    name: "model",
    exports: [],
    contents: { [source.as || source.name]: source },
  };
}

export async function compileFilter(
  source: StructDef,
  filter: string
): Promise<FilterExpression> {
  const malloy = `query: the_query is ${
    source.as || source.name
  } -> { group_by: one is 1; where: ${filter}}`;
  const modelDef = modelDefForSource(source);
  const model = await compileModel(modelDef, malloy);
  const theQuery = model.contents["the_query"];
  if (theQuery.type !== "query") {
    throw new Error("Expected the_query to be a query");
  }
  const filterList = theQuery.pipeline[0].filterList;
  if (filterList === undefined) {
    throw new Error("Expected a filter list");
  }
  return filterList[0];
}

export async function compileDimension(
  source: StructDef,
  name: string,
  dimension: string
): Promise<FieldDef> {
  const malloy = `query: the_query is ${
    source.as || source.name
  } -> { group_by: ${name} is ${dimension} }`;
  const modelDef = modelDefForSource(source);
  const model = await compileModel(modelDef, malloy);
  const theQuery = model.contents["the_query"];
  if (theQuery.type !== "query") {
    throw new Error("Expected the_query to be a query");
  }
  const field = theQuery.pipeline[0].fields[0];
  if (typeof field === "string") {
    throw new Error("Expected field definiton, not reference");
  } else if (isFilteredAliasedName(field)) {
    throw new Error("Expected field definition, not filtered aliased name");
  }
  return field;
}

export async function compileMeasure(
  source: StructDef,
  name: string,
  measure: string
): Promise<FieldDef> {
  const malloy = `query: the_query is ${
    source.as || source.name
  } -> { aggregate: ${name} is ${measure} }`;
  const modelDef = modelDefForSource(source);
  const model = await compileModel(modelDef, malloy);
  const theQuery = model.contents["the_query"];
  if (theQuery.type !== "query") {
    throw new Error("Expected the_query to be a query");
  }
  const field = theQuery.pipeline[0].fields[0];
  if (typeof field === "string") {
    throw new Error("Expected field definiton, not reference");
  } else if (isFilteredAliasedName(field)) {
    throw new Error("Expected field definition, not filtered aliased name");
  }
  return field;
}
