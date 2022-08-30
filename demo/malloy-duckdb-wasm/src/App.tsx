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
import { Malloy, Runtime } from "@malloydata/malloy";
import { HTMLView } from "@malloydata/render";
import { DuckDBWASMConnection } from "@malloydata/db-duckdb-wasm";
import { Controls } from "./Controls";
import { Render } from "./Render";
import { Model } from "./Model";
import { Status } from "./Status";
import { BrowserURLReader } from "./utils/files";
import { DuckDBWasmLookup } from "./utils/connections";
import { HackyDataStylesAccumulator } from "./utils/data_styles";

const FILES = [
  "1_names.malloy",
  "2_iconic_names.malloy",
  "3_names_dashboads.malloy",
];

const baseReader = new BrowserURLReader();
const lookup = new DuckDBWasmLookup();
const reader = new HackyDataStylesAccumulator(baseReader);
const runtime = new Runtime(reader, lookup);

export const App: React.FC = () => {
  const [malloyFile, setMalloyFile] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("j_names");
  const [queries, setQueries] = useState<string[]>([]);
  const [rendered, setRendered] = useState<HTMLElement>();
  const [file, setFile] = useState(FILES[0]);

  useEffect(() => {
    setStatus("Loading Model");
    (async () => {
      await lookup.lookupConnection("duckdb");
      const queries = [];
      const fileUrl = new URL(file, window.location.href);
      const malloyFile = await reader.readURL(fileUrl);
      const symbols = Malloy.parse({ source: malloyFile }).symbols;
      for (const symbol of symbols) {
        if (symbol.type === "query") {
          queries.push(symbol.name);
        }
      }
      setMalloyFile(malloyFile);
      setQueries(queries);
      setQuery(queries[0]);
      setStatus("Ready");
    })();
  }, [file]);

  useEffect(() => {
    setStatus("Loading DuckDB");
    (async () => {
      const nameUrl = new URL("./dist/usa_names.parquet", window.location.href);
      const connection = (await lookup.lookupConnection(
        "duckdb"
      )) as DuckDBWASMConnection;
      connection.database?.registerFileURL(
        "data/usa_names.parquet",
        nameUrl.toString()
      );
    })();
  }, []);

  const onRun = async () => {
    setStatus("Loading Model");
    const fileUrl = new URL(file, window.location.href);
    const runnable = runtime.loadModel(fileUrl).loadQueryByName(query);
    setStatus("Loading Data");
    const rowLimit = (await runnable.getPreparedResult()).resultExplore.limit;
    setStatus(`Running query ${query}`);
    try {
      const result = await runnable.run({ rowLimit });
      setStatus("Rendering");
      const rendered = await new HTMLView(document).render(result.data, {
        dataStyles: reader.getHackyAccumulatedDataStyles(),
      });
      setStatus("Done");
      setRendered(rendered);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <>
      <h1>Malloy DuckDB WASM Query Demo</h1>
      <Controls
        files={FILES}
        onSelectFile={setFile}
        queries={queries}
        onSelectQuery={setQuery}
        onRun={onRun}
      />
      <View>
        <Model model={malloyFile} />
        {rendered ? <Render rendered={rendered} /> : <Status status={status} />}
      </View>
    </>
  );
};

const View = styled.div`
  display: flex;
  flex-direction: row;
  height: 90vh;
`;
