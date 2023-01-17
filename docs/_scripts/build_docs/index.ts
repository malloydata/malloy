/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import path from "path";
import fs from "fs";
import archiver from "archiver";
import { performance } from "perf_hooks";
import { renderDoc } from "./render_document.js";
import { renderFooter, renderSidebar, Section } from "./page.js";
import { copyFiddle } from "./fiddle.js";
import {
  isMarkdown,
  readDirRecursive,
  timeString,
  watchDebounced,
  watchDebouncedRecursive,
} from "./utils.js";
import { DEPENDENCIES } from "./run_code.js";
import { log } from "./log.js";
import { exit } from "process";

const __dirname = path.resolve("./docs/_scripts/build_docs");

const DOCS_ROOT_PATH = path.join(__dirname, "../../_src");
const OUT_PATH = path.join(__dirname, "../../_includes/generated");
const JS_OUT_PATH = path.join(__dirname, "../../js/generated");
const OUT_PATH2 = path.join(__dirname, "../../documentation/");
const CONTENTS_PATH = path.join(DOCS_ROOT_PATH, "table_of_contents.json");
const SAMPLES_BIGQUERY_PATH = path.join(__dirname, "../../../samples/bigquery");
const SAMPLES_ROOT_PATH = path.join(__dirname, "../../../samples");
const AUX_OUT_PATH = path.join(__dirname, "../../aux/generated");

const WATCH_ENABLED = process.argv.includes("--watch");

async function compileDoc(file: string): Promise<{
  errors: { path: string; snippet: string; error: string }[];
  searchSegments: {
    path: string;
    titles: string[];
    paragraphs: (
      | { type: "p"; text: string }
      | { type: "code"; text: string }
    )[];
  }[];
}> {
  const startTime = performance.now();
  const shortPath = file.substring(DOCS_ROOT_PATH.length);
  const shortOutPath = shortPath.replace(/\.md$/, ".html");
  const outPath = path.join(OUT_PATH, shortOutPath);
  const outDirPath = path.join(outPath, "..");
  fs.mkdirSync(outDirPath, { recursive: true });
  const markdown = fs.readFileSync(file, "utf8");
  const { renderedDocument, errors, searchSegments } = await renderDoc(
    markdown,
    shortPath
  );
  const headerDoc =
    `---\n` +
    `layout: documentation\n` +
    `title: Malloy Documentation\n` +
    `footer: ${path.join("/generated/footers", shortOutPath)}\n` +
    `---\n\n` +
    renderedDocument;
  fs.mkdirSync(path.join(OUT_PATH2, shortOutPath, ".."), { recursive: true });
  fs.writeFileSync(path.join(OUT_PATH2, shortOutPath), headerDoc);
  log(
    `File ${outPath.substring(OUT_PATH.length)} compiled in ${timeString(
      startTime,
      performance.now()
    )}.`
  );
  return {
    errors: errors.map((error) => ({ ...error, path: shortPath })),
    searchSegments: searchSegments.map((segment) => ({
      ...segment,
      path: shortPath,
    })),
  };
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

function outputSearchSegmentsFile(
  searchSegments: {
    path: string;
    titles: string[];
    paragraphs: (
      | { type: "p"; text: string }
      | { type: "code"; text: string }
    )[];
  }[]
) {
  const file = `window.SEARCH_SEGMENTS = ${JSON.stringify(
    searchSegments,
    null,
    2
  )}`;
  fs.mkdirSync(JS_OUT_PATH, { recursive: true });
  fs.writeFileSync(path.join(JS_OUT_PATH, "search_segments.js"), file);
  log(`File js/generated/search_segments.js written.`);
}

function outputSamplesZip(
  rootPath: string,
  relativePath: string,
  name: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const archive = archiver("zip");
      fs.mkdirSync(AUX_OUT_PATH, { recursive: true });
      const output = fs.createWriteStream(path.join(AUX_OUT_PATH, name));
      output.on("close", () => {
        log(`File aux/${name} written.`);
        resolve();
      });
      archive.on("error", (error) => {
        log(error.message);
        reject(error);
      });
      archive.pipe(output);
      archive.directory(path.join(rootPath, relativePath), false);
      archive.finalize();
    } catch (error) {
      log(error);
      reject(error);
    }
  });
}

async function outputSamplesZips(): Promise<void> {
  log("Zipping samples");
  await Promise.all([
    outputSamplesZip(SAMPLES_ROOT_PATH, "/", "samples.zip"),
    ...fs.readdirSync(SAMPLES_BIGQUERY_PATH).map((relativePath) => {
      if (
        fs
          .statSync(path.join(SAMPLES_BIGQUERY_PATH, relativePath))
          .isDirectory()
      ) {
        return outputSamplesZip(
          SAMPLES_BIGQUERY_PATH,
          relativePath,
          relativePath + ".zip"
        );
      }
    }),
  ]);
}

(async () => {
  await copyFiddle();
  await outputSamplesZips();
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
  const results = await Promise.all(allDocs.map(compileDoc));
  const allErrors = results.map(({ errors }) => errors).flat();
  const allSegments = results
    .map(({ searchSegments }) => searchSegments)
    .flat();
  // TODO make this update in watch mode
  outputSearchSegmentsFile(allSegments);
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
    watchDebouncedRecursive(SAMPLES_BIGQUERY_PATH, (type, file) => {
      log(`Model file ${file} ${type}d. Recompiling dependent documents...`);
      for (const doc of DEPENDENCIES.get(file) || []) {
        const fullPath = path.join(DOCS_ROOT_PATH, doc);
        compileDoc(fullPath);
      }
      outputSamplesZips();
    });
    watchDebounced(CONTENTS_PATH, (type) => {
      log(`Table of contents ${type}d. Recompiling...`);
      rebuildSidebarAndFooters();
    });
  } else {
    if (allErrors.length > 0) {
      log(
        `Failure: ${allErrors.length} example snippet${
          allErrors.length === 1 ? "" : "s"
        } had errors`
      );
      allErrors.forEach((error) => {
        log(`Error in file ${error.path}: ${error.error}`);
        log("```");
        log(error.snippet);
        log("```");
      });
      exit(1);
    }
  }
})();
