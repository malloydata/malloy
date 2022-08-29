/*
 * Copyright 2022 Google LLC
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

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import {
  Connection,
  LookupConnection,
  Runtime,
  URLReader,
} from "@malloydata/malloy";
import { HTMLView } from "@malloydata/render";
import { DuckDBWASMConnection } from "@malloydata/db-duckdb-wasm";
import { Render } from "./Render";
import { Query } from "./Query";
import { Status } from "./Status";

class DuckDBWasmLookup implements LookupConnection<Connection> {
  connection: DuckDBWASMConnection;

  constructor() {
    this.connection = new DuckDBWASMConnection("duckdb");
  }

  lookupConnection(_name: string) {
    return new Promise<Connection>((resolve) => {
      resolve(this.connection);
    });
  }
}

class BrowserURLReader implements URLReader {
  async readURL(url: URL): Promise<string> {
    console.log("Reading", url);
    const body = await fetch(url);
    return body.text();
  }
}

const reader = new BrowserURLReader();
const lookup = new DuckDBWasmLookup();
const runtime = new Runtime(reader, lookup);

export const App: React.FC = () => {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [rendered, setRendered] = useState<HTMLElement>();

  useEffect(() => {
    (async () => {
      setStatus("Loading Malloy");
      const query = await reader.readURL(
        new URL("./1_names.malloy", window.location.href)
      );
      setQuery(query);
      setStatus("Loading DuckDB");
      const nameUrl = new URL("./dist/usa_names.parquet", window.location.href);
      const connection = (await lookup.lookupConnection(
        "duckdb"
      )) as DuckDBWASMConnection;
      await connection.connecting;
      await connection.database?.registerFileURL(
        "data/usa_names.parquet",
        nameUrl.toString()
      );
      setStatus("Loading Model");
      const runnable = runtime
        .loadModel(query)
        // .loadQuery("query: names->name_dashboard");
        .loadQueryByName("j_names");
      setStatus("Loading Data");
      const rowLimit = (await runnable.getPreparedResult()).resultExplore.limit;
      setStatus(`Running query "j_names"`);
      try {
        const result = await runnable.run({ rowLimit });
        setStatus("Rendering");
        const rendered = await new HTMLView(document).render(result.data, {
          dataStyles: {},
        });
        setStatus("Done");
        setRendered(rendered);
      } catch (error) {
        setStatus(`Error: ${error.message}`);
      }
    })();
  }, []);
  return (
    <>
      <h1>Malloy DuckDB WASM Query Demo</h1>
      <View>
        <Query query={query} />
        {rendered ? <Render rendered={rendered} /> : <Status status={status} />}
      </View>
    </>
  );
};

const View = styled.div`
  display: flex;
  flex-direction: row;
`;
