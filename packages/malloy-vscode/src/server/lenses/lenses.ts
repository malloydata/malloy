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

import { CodeLens } from "vscode-languageserver/node";
import { Malloy } from "@malloy-lang/malloy";
import { TextDocument } from "vscode-languageserver-textdocument";

export function getMalloyLenses(document: TextDocument): CodeLens[] {
  const lenses: CodeLens[] = [];
  const symbols = Malloy.parse({ source: document.getText() }).symbols;

  let currentUnnamedQueryIndex = 0;
  symbols.forEach((symbol) => {
    if (symbol.type === "query") {
      lenses.push({
        range: symbol.range.toJSON(),
        command: {
          title: "Run",
          command: "malloy.runNamedQuery",
          arguments: [symbol.name, "json"],
        },
      });
      lenses.push({
        range: symbol.range.toJSON(),
        command: {
          title: "Render",
          command: "malloy.runNamedQuery",
          arguments: [symbol.name, "html"],
        },
      });
    } else if (symbol.type === "unnamed_query") {
      lenses.push({
        range: symbol.range.toJSON(),
        command: {
          title: "Run",
          command: "malloy.runQueryFile",
          arguments: [currentUnnamedQueryIndex],
        },
      });
      lenses.push({
        range: symbol.range.toJSON(),
        command: {
          title: "Render",
          command: "malloy.runQueryFile",
          arguments: [currentUnnamedQueryIndex, "html"],
        },
      });
      currentUnnamedQueryIndex++;
    } else if (symbol.type === "explore") {
      const children = symbol.children;
      const exploreName = symbol.name;
      lenses.push({
        range: symbol.range.toJSON(),
        command: {
          title: "Query",
          command: "malloy.runQueryWithEdit",
          arguments: [exploreName, ""],
        },
      });
      children.forEach((child) => {
        if (child.type === "query") {
          const queryName = child.name;
          lenses.push({
            range: child.range.toJSON(),
            command: {
              title: "Run",
              command: "malloy.runQuery",
              arguments: [
                `query: ${exploreName}->${queryName}`,
                `${exploreName}->${queryName}`,
                "json",
              ],
            },
          });
          lenses.push({
            range: child.range.toJSON(),
            command: {
              title: "Render",
              command: "malloy.runQuery",
              arguments: [
                `query: ${exploreName}->${queryName}`,
                `${exploreName}->${queryName}`,
              ],
            },
          });
        }
      });
    }
  });

  return lenses;
}
