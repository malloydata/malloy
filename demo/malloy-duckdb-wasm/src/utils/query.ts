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

export interface SampleQuery {
  name: string;
  query: string;
}

export interface SampleQueries {
  importFile: string;
  queries: SampleQuery[];
}

const IMPORT_RE = /^import "([^"]+)"$/gm;
const SPLIT_RE = /^\/\/\s*--.*$/gm;
const QUERY_NAME_RE = /^\/\/\s*Name:\s*(.*)$/im;

export const loadSampleQueries = async (url: URL): Promise<SampleQueries> => {
  const sampleRequest = await fetch(url);
  const sampleData = await sampleRequest.text();
  const importFile = IMPORT_RE.exec(sampleData)?.[1];
  if (!importFile) {
    throw new Error("Unable to find import statement");
  }

  const queryStrings = sampleData.replace(IMPORT_RE, "").trim().split(SPLIT_RE);

  const queries: SampleQuery[] = [];
  let i = 1;
  for (const queryString of queryStrings) {
    let name = queryString.match(QUERY_NAME_RE)?.[1];
    if (name) {
      name = `${i++} - ${name}`;
      // remove the first line
      let query = queryString.trim();
      const q = query.split("\n");
      q.splice(0, 1);
      query = q.join("\n");
      queries.push({ name, query });
    }
  }

  return {
    importFile,
    queries,
  };
};
