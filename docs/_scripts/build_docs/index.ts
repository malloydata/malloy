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

import path from "path";
import fs from "fs";
import { Malloy } from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { performance } from "perf_hooks";
import { renderDoc } from "./render_document";
import { renderFooter, renderSidebar, Section } from "./page";
import {
  isMarkdown,
  readDirRecursive,
  timeString,
  watchDebounced,
  watchDebouncedRecursive,
} from "./utils";
import { DEPENDENCIES } from "./run_code";
import { log } from "./log";

const DOCS_ROOT_PATH = path.join(__dirname, "../../_src");
const OUT_PATH = path.join(__dirname, "../../_includes/generated");
const OUT_PATH2 = path.join(__dirname, "../../documentation/");
const CONTENTS_PATH = path.join(DOCS_ROOT_PATH, "table_of_contents.json");
const SAMPLES_PATH = path.join(__dirname, "../../../samples");

const WATCH_ENABLED = process.argv.includes("--watch");

Malloy.db = new BigQueryConnection("docs");

async function compileDoc(file: string) {
  const startTime = performance.now();
  const shortPath = file.substring(DOCS_ROOT_PATH.length);
  const shortOutPath = shortPath.replace(/\.md$/, ".html");
  const outPath = path.join(OUT_PATH, shortOutPath);
  const outDirPath = path.join(outPath, "..");
  fs.mkdirSync(outDirPath, { recursive: true });
  const markdown = fs.readFileSync(file, "utf8");
  const renderedDoc = await renderDoc(markdown, shortPath);
  const headerDoc =
    `---\n` +
    `layout: documentation\n` +
    `title: Malloy Documentation\n` +
    `footer: ${path.join("/generated/footers", shortOutPath)}\n` +
    `---\n\n` +
    renderedDoc;
  fs.mkdirSync(path.join(OUT_PATH2, shortOutPath, ".."), { recursive: true });
  fs.writeFileSync(path.join(OUT_PATH2, shortOutPath), headerDoc);
  log(
    `File ${outPath.substring(OUT_PATH.length)} compiled in ${timeString(
      startTime,
      performance.now()
    )}.`
  );
}

function rebuildSidebarAndFooters() {
  const tableOfContents = JSON.parse(fs.readFileSync(CONTENTS_PATH, "utf8"))
    .contents as Section[];
  const renderedSidebar = renderSidebar(tableOfContents);
  fs.writeFileSync(path.join(OUT_PATH, "toc.html"), renderedSidebar);
  log(`File _includes/toc.html written.`);

  const allFiles = readDirRecursive(DOCS_ROOT_PATH);
  const allDocs = allFiles.filter(isMarkdown);

  for (const file of allDocs) {
    const shortPath = file.substring(DOCS_ROOT_PATH.length);
    const htmlLink = shortPath.replace(/\.md$/, ".html");
    const footer = renderFooter(tableOfContents, DOCS_ROOT_PATH, htmlLink);
    const footerPath = path.join(OUT_PATH, "footers", htmlLink);
    fs.mkdirSync(path.join(footerPath, ".."), {
      recursive: true,
    });
    fs.writeFileSync(footerPath, footer);
  }
  log(`Files _includes/footers/** written.`);
}

(async () => {
  const allFiles = readDirRecursive(DOCS_ROOT_PATH);
  const allDocs = allFiles.filter(isMarkdown);
  const staticFiles = allFiles.filter((file) => !isMarkdown(file));
  for (const file of staticFiles) {
    const destination = path.join(
      OUT_PATH,
      file.substring(DOCS_ROOT_PATH.length)
    );
    fs.mkdirSync(path.join(destination, ".."), { recursive: true });
    fs.copyFileSync(file, destination);
  }
  const startTime = performance.now();
  await Promise.all(allDocs.map(compileDoc));
  log(`All docs compiled in ${timeString(startTime, performance.now())}`);

  rebuildSidebarAndFooters();

  if (WATCH_ENABLED) {
    log(`\nWatching /documentation and /samples for changes...`);
    watchDebouncedRecursive(DOCS_ROOT_PATH, (type, file) => {
      const fullPath = path.join(DOCS_ROOT_PATH, file);
      if (isMarkdown(file)) {
        log(`Markdown file ${file} ${type}d. Recompiling...`);
        compileDoc(fullPath);
      } else {
        if (fs.existsSync(fullPath)) {
          log(`Static file ${file} ${type}d. Copied.`);
          fs.copyFileSync(fullPath, path.join(OUT_PATH, file));
        } else {
          fs.unlinkSync(path.join(OUT_PATH, file));
          log(`Static file ${file} deleted. Removed.`);
        }
      }
    });
    watchDebouncedRecursive(SAMPLES_PATH, (type, file) => {
      log(`Model file ${file} ${type}d. Recompiling dependent documents...`);
      for (const doc of DEPENDENCIES.get(file) || []) {
        const fullPath = path.join(DOCS_ROOT_PATH, doc);
        compileDoc(fullPath);
      }
    });
    watchDebounced(CONTENTS_PATH, (type) => {
      log(`Table of contents ${type}d. Recompiling...`);
      rebuildSidebarAndFooters();
    });
  }
})();
