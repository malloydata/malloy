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
import { Malloy } from "@malloydata/malloy";
import { TextDocument } from "vscode-languageserver-textdocument";

// const explain = `
//   index
//   | reduce  : [
//       field_value: != null,
//     ]
//     strings is (reduce order by 2 : [field_type: 'string']
//       field_name
//       cardinality is count(distinct field_value)
//       top_values_list is (reduce order by 2 desc top 20
//         field_value
//         occurrences is weight
//       )
//     )
//     other_types is (reduce : [field_type: != 'string']
//       field_name
//       field_type
//       field_value
//     )
// `;

export function getMalloyLenses(document: TextDocument): CodeLens[] {
  const lenses: CodeLens[] = [];
  const symbols = Malloy.parse({ source: document.getText() }).symbols;

  let currentUnnamedQueryIndex = 0;
  let currentUnnamedSQLBlockIndex = 0;
  symbols.forEach((symbol) => {
    if (symbol.type === "query") {
      lenses.push({
        range: symbol.range.toJSON(),
        command: {
          title: "Run",
          command: "malloy.runNamedQuery",
          arguments: [symbol.name],
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
      currentUnnamedQueryIndex++;
    } else if (symbol.type === "explore") {
      const children = symbol.children;
      const exploreName = symbol.name;
      lenses.push({
        range: symbol.range.toJSON(),
        command: {
          title: "Preview",
          command: "malloy.runQuery",
          arguments: [
            `query: ${exploreName}->{ project: *; limit: 20 }`,
            `preview ${exploreName}`,
          ],
        },
      });
      // lenses.push({
      //   range: symbol.range.toJSON(),
      //   command: {
      //     title: "Explain",
      //     command: "malloy.runQuery",
      //     arguments: [
      //       `query: ${exploreName}->${explain}`,
      //       `explain ${exploreName}`,
      //     ],
      //   },
      // });
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
              ],
            },
          });
        }
      });
    } else if (symbol.type === "sql") {
      lenses.push({
        range: symbol.range.toJSON(),
        command: {
          title: "Run",
          command: "malloy.runNamedSQLBlock",
          arguments: [symbol.name],
        },
      });
      // TODO feature-sql-block Currently, named SQL blocks are not in the model, but stored
      //      in the same list alongside unnaed SQL blocks. This is unlike the way queries work:
      //      named queries exist in the model, and unnamed queries exist outside the model in
      //      a separate list. Anyway, this means that at the moment, _named_ SQL blocks are also
      //      indexable.
      currentUnnamedSQLBlockIndex++;
    } else if (symbol.type === "unnamed_sql") {
      lenses.push({
        range: symbol.range.toJSON(),
        command: {
          title: "Run",
          command: "malloy.runUnnamedSQLBlock",
          arguments: [currentUnnamedSQLBlockIndex],
        },
      });
      currentUnnamedSQLBlockIndex++;
    }
  });

  return lenses;
}
