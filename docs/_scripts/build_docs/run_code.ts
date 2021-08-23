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

/*
 * This stores model dependencies -- for some model file with path `modelFilePath`,
 * `DEPENDENCIES.get(modelFilePath)` should be an array of known documents
 * that depend on that model. If `--watch` is enabled, changes to a model file
 * will cause relevant documents to recompile.
 */
import { DataStyles, DataTreeRoot, HtmlView } from "malloy-render";
import { Malloy, MalloyTranslator } from "malloy";
import path from "path";
import fs from "fs";
import { performance } from "perf_hooks";
import { timeString } from "./utils";
import { log } from "./log";

const SAMPLES_PATH = path.join(__dirname, "../../../samples");

export const DEPENDENCIES = new Map<string, string[]>();

/*
 * Add a known dependency to the `DEPENDENCIES` map.
 */
function addDependency(modelPath: string, documentPath: string) {
  const key = modelPath.substring(SAMPLES_PATH.length);
  const existing = DEPENDENCIES.get(key);
  if (existing) {
    if (!existing.includes(documentPath)) {
      existing.push(documentPath);
    }
  } else {
    DEPENDENCIES.set(key, [documentPath]);
  }
}

/*
 * Interface for the options that can appear in magic comments (`--! { ... }`)
 * at the top of Malloy snippets in documentation.
 */
interface RunOptions {
  source?: string;
  size?: string;
  pageSize?: number;
  dataStyles: DataStyles;
}

export async function dataStylesForFile(
  uri: string,
  text: string
): Promise<DataStyles> {
  const PREFIX = "--! styles ";
  if (text.startsWith(PREFIX)) {
    const fileName = text.split("\n")[0].trimEnd().substring(PREFIX.length);
    const stylesPath = path.join(uri.replace(/^file:\/\//, ""), "..", fileName);
    const stylesText = await fetchFile(stylesPath);
    return JSON.parse(stylesText);
  }
  return {};
}

async function fetchFile(uri: string) {
  return fs.readFileSync(uri.replace(/^file:\/\//, ""), "utf8");
}

async function compile(uri: string, malloy: string, documentPath: string) {
  let dataStyles = await dataStylesForFile(uri, malloy);
  const translator = new MalloyTranslator(uri, {
    URLs: { [uri]: malloy },
  });
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = translator.translate();
    if (result.final) {
      return { result, dataStyles };
    } else if (result.URLs) {
      for (const neededUri of result.URLs) {
        const neededText = await fetchFile(neededUri);
        translator.update({ URLs: { [neededUri]: neededText } });
        addDependency(neededUri.replace(/^file:\/\//, ""), documentPath);
        dataStyles = {
          ...dataStyles,
          ...(await dataStylesForFile(neededUri, neededText)),
        };
      }
    } else if (result.tables) {
      const tables = await Malloy.db.getSchemaForMissingTables(result.tables);
      translator.update({ tables });
    }
  }
}

/*
 * Run a `query` appearing within a document at `documentPath` with `options`,
 * and render the result as a string (HTML).
 */
export async function runCode(
  query: string,
  documentPath: string,
  options: RunOptions
): Promise<string> {
  const malloy = new Malloy();
  // Here, we assume that docs queries that reference a model only care about
  // things _exported_ from that model. In other words, a query with
  // `"source": "something.malloy" is equivalent to prepending the query with
  // `import "something.malloy"` (and is useful only to avoid having to include
  // the import statement at the top of each code snippet). If this assumption
  // proves to be incorrect, this function should be modified to first compile
  // the source model and pass it in to translation of the query, allowing the
  // query to reference non-exported members of the model. It may be argued that
  // querying a model in this way is only useful as a developer experience,
  // because it ignores the actual specified interface of the model. Therefore,
  // it may be a good idea to force something to be exported if it needs to be
  // queried in a docs snippet.
  const fullQuery = options.source
    ? `import "${path.join(SAMPLES_PATH, options.source)}"\n${query}`
    : query;

  let compiledQuery;
  let styles;
  const fakeUri = "file://" + path.join(SAMPLES_PATH, "__QUERY__.malloy");
  const { result, dataStyles } = await compile(
    fakeUri,
    fullQuery,
    documentPath
  );
  if (result?.translated) {
    const q =
      result.translated.queryList[result.translated.queryList.length - 1];
    compiledQuery = await malloy.compileQuery(q);
    styles = dataStyles;
  } else if (result?.errors) {
    throw new Error(result.errors[0].message);
  }

  if (!compiledQuery) {
    throw new Error("Could not compile query.");
  }

  const querySummary = `"${query.split("\n").join(" ").substring(0, 50)}..."`;
  log(`  >> Running query ${querySummary}`);
  const runStartTime = performance.now();
  const queryResult = await malloy.runCompiledQuery(
    compiledQuery,
    options.pageSize || 5
  );
  log(
    `  >> Finished running query ${querySummary} in ${timeString(
      runStartTime,
      performance.now()
    )}`
  );
  const data = queryResult.result;
  const field = queryResult.structs.find(
    (s) => s.name === queryResult.lastStageName
  );
  if (field) {
    const namedField = {
      ...field,
      name: queryResult.queryName || field.name,
    };

    const dataStyles = {
      ...options.dataStyles,
      ...styles,
    };

    const result = await new HtmlView().render(
      new DataTreeRoot(
        data,
        namedField,
        queryResult.sourceExplore,
        queryResult.sourceFilters || []
      ),
      dataStyles
    );

    return `<div class="result-outer ${options.size || "small"}">
      <div class="result-middle">
        <div class="result-inner">
          ${result}
        </div>
      </div>
    </div>`;
  }
  log(`  !! Error: query did not contain a field.`);
  return `<div class="error">Error: query did not contain a field.</div>`;
}
