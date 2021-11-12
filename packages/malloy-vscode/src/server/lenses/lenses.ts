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

const explain = `
  index
  | reduce  : [
      field_value: != null,
    ]
    strings is (reduce order by 2 : [field_type: 'string']
      field_name
      cardinality is count(distinct field_value)
      top_values_list is (reduce order by 2 desc top 20
        field_value
        occurrences is weight
      )
    )
    other_types is (reduce : [field_type: != 'string']
      field_name
      field_type
      field_value
    )
`;

export function getMalloyLenses(document: TextDocument): CodeLens[] {
  const lenses: CodeLens[] = [];
  const symbols = Malloy.parse(document.getText()).getSymbols();

  let currentUnnamedQueryIndex = 0;
  symbols.forEach((symbol) => {
    if (symbol.getType() === "query") {
      lenses.push({
        range: symbol.getRange().toJSON(),
        command: {
          title: "Run",
          command: "malloy.runNamedQuery",
          arguments: [symbol.getName()],
        },
      });
    } else if (symbol.getType() === "unnamed_query") {
      lenses.push({
        range: symbol.getRange().toJSON(),
        command: {
          title: "Run",
          command: "malloy.runQueryFile",
          arguments: [currentUnnamedQueryIndex],
        },
      });
      currentUnnamedQueryIndex++;
    } else if (symbol.getType() === "explore") {
      const children = symbol.getChildren();
      const exploreName = symbol.getName();
      lenses.push({
        range: symbol.getRange().toJSON(),
        command: {
          title: "Query",
          command: "malloy.runQueryWithEdit",
          arguments: [exploreName, ""],
        },
      });
      lenses.push({
        range: symbol.getRange().toJSON(),
        command: {
          title: "Preview",
          command: "malloy.runQuery",
          arguments: [
            `explore ${exploreName} | project limit 20 *`,
            `preview ${exploreName}`,
          ],
        },
      });
      lenses.push({
        range: symbol.getRange().toJSON(),
        command: {
          title: "Explain",
          command: "malloy.runQuery",
          arguments: [
            `explore ${exploreName} | ${explain}`,
            `explain ${exploreName}`,
          ],
        },
      });
      children.forEach((child) => {
        if (child.getType() === "turtle") {
          const turtleName = child.getName();
          lenses.push({
            range: child.getRange().toJSON(),
            command: {
              title: "Run",
              command: "malloy.runQuery",
              arguments: [
                `explore ${exploreName} | ${turtleName}`,
                `${exploreName} | ${turtleName}`,
              ],
            },
          });
          lenses.push({
            range: child.getRange().toJSON(),
            command: {
              title: "Edit and Run",
              command: "malloy.runQueryWithEdit",
              arguments: [exploreName, turtleName],
            },
          });
        }
      });
    }
  });

  return lenses;
}
