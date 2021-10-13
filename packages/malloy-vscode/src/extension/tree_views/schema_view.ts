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

import * as path from "path";
import * as vscode from "vscode";
import { Malloy, FieldDef, MalloyTranslator, NamedMalloyObject } from "malloy";
import numberIcon from "../../media/number.svg";
import numberAggregateIcon from "../../media/number-aggregate.svg";
import booleanIcon from "../../media/boolean.svg";
import timeIcon from "../../media/time.svg";
import structIcon from "../../media/struct.svg";
import turtleIcon from "../../media/turtle.svg";
import stringIcon from "../../media/string.svg";
import oneToManyIcon from "../../media/one_to_many.svg";
import manyToOneIcon from "../../media/many_to_one.svg";
import oneToOneIcon from "../../media/one_to_one.svg";
import { MALLOY_EXTENSION_STATE } from "../state";

export class SchemaProvider
  implements vscode.TreeDataProvider<StructItem | FieldItem>
{
  private readonly resultCache: Map<string, StructItem[]>;
  private previousKey: string | undefined;

  constructor() {
    this.resultCache = new Map();
  }

  getTreeItem(element: StructItem): vscode.TreeItem {
    return element;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    (StructItem | FieldItem) | undefined
  > = new vscode.EventEmitter<(StructItem | FieldItem) | undefined>();

  readonly onDidChangeTreeData: vscode.Event<
    (StructItem | FieldItem) | undefined
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async getChildren(element?: StructItem): Promise<(StructItem | FieldItem)[]> {
    if (element) {
      return (element.struct.fields || []).sort(byKindThenName).map((field) => {
        const newPath = [...element.accessPath, field.as || field.name];
        if (field.type === "struct") {
          return new StructItem(
            element.topLevelExplore,
            field,
            newPath,
            element.struct.fields?.length === 1
          );
        } else {
          return new FieldItem(element.topLevelExplore, field, newPath);
        }
      });
    } else {
      const document =
        vscode.window.activeTextEditor?.document ||
        MALLOY_EXTENSION_STATE.getActiveWebviewPanel()?.document;

      if (document === undefined) {
        return [];
      }

      const cacheKey = document.uri.toString();

      if (this.previousKey !== cacheKey) {
        this.previousKey = cacheKey;
        this.refresh();
        return this.resultCache.get(cacheKey) || [];
      }

      const structs = await getStructs(document);
      if (structs === undefined) {
        return this.resultCache.get(cacheKey) || [];
      } else {
        const results = structs.map(
          (struct) =>
            new StructItem(
              struct.as || struct.name,
              struct,
              [],
              structs.length === 1
            )
        );
        this.resultCache.set(cacheKey, results);
        return results;
      }
    }
  }
}

async function fetchFile(uri: string): Promise<string> {
  return (
    await vscode.workspace.openTextDocument(uri.replace(/^file:\/\//, ""))
  ).getText();
}

async function getStructs(
  document: vscode.TextDocument
): Promise<NamedMalloyObject[] | undefined> {
  const uri = document.uri.toString();
  const translator = new MalloyTranslator(uri, {
    URLs: {
      [uri]: document.getText(),
    },
  });
  let done = false;
  let nameSpace;
  while (!done) {
    const result = translator.translate();
    done = result.final || false;
    if (result.translated) {
      nameSpace = result.translated.modelDef.structs;
    } else if (result.URLs) {
      for (const neededUri of result.URLs) {
        const URLs = { [neededUri]: await fetchFile(neededUri) };
        translator.update({ URLs });
      }
    } else if (result.tables) {
      const tables = await Malloy.db.getSchemaForMissingTables(result.tables);
      translator.update({ tables });
    }
  }

  if (nameSpace) {
    return Object.values(nameSpace).sort(exploresByName);
  }
  return undefined;
}

class StructItem extends vscode.TreeItem {
  constructor(
    public topLevelExplore: string,
    public struct: NamedMalloyObject,
    public accessPath: string[],
    open: boolean
  ) {
    super(
      struct.as || struct.name,
      open
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.tooltip = struct.as || struct.name;

    let subtype = "base";

    if (struct.type === "struct") {
      if (struct.structRelationship.type === "foreignKey") {
        subtype = "many_to_one";
      } else if (struct.structRelationship.type === "nested") {
        subtype = "one_to_many";
      } else if (struct.structRelationship.type === "inline") {
        subtype = "one_to_one";
      }
    }

    this.iconPath = {
      light: getIconPath(`struct_${subtype}`, false),
      dark: getIconPath(`struct_${subtype}`, false),
    };
  }
}

class FieldItem extends vscode.TreeItem {
  constructor(
    public topLevelExplore: string,
    public field: FieldDef,
    public accessPath: string[]
  ) {
    super(field.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = field.type;
    this.tooltip = new vscode.MarkdownString(
      `
$(symbol-field) \`${field.name}\`

**Path**: \`${this.accessPath.join(".")}\`

**Type**: \`${field.type}\`
    `,
      true
    );
  }

  command = {
    title: "Copy Field path",
    command: "malloy.copyFieldPath",
    arguments: [this.accessPath.join(".")],
  };

  iconPath = {
    light: getIconPath(this.field.type, this.isAggregate()),
    dark: getIconPath(this.field.type, this.isAggregate()),
  };

  isAggregate() {
    return "aggregate" in this.field && !!this.field.aggregate;
  }
}

function getIconPath(fieldType: string, isAggregate: boolean) {
  let imageFileName;
  if (isAggregate) {
    imageFileName = numberAggregateIcon;
  } else {
    switch (fieldType) {
      case "number":
        imageFileName = numberIcon;
        break;
      case "string":
        imageFileName = stringIcon;
        break;
      case "date":
      case "timestamp":
        imageFileName = timeIcon;
        break;
      case "struct_base":
        imageFileName = structIcon;
        break;
      case "struct_one_to_many":
        imageFileName = oneToManyIcon;
        break;
      case "struct_one_to_one":
        imageFileName = oneToOneIcon;
        break;
      case "struct_many_to_one":
        imageFileName = manyToOneIcon;
        break;
      case "boolean":
        imageFileName = booleanIcon;
        break;
      case "turtle":
        imageFileName = turtleIcon;

        break;
      default:
        imageFileName = "unknown";
    }
  }

  return path.join(__filename, "..", imageFileName);
}

export function runTurtleFromSchemaCommand(fieldItem: FieldItem): void {
  vscode.commands.executeCommand(
    "malloy.runQuery",
    `explore ${fieldItem.topLevelExplore} | ${fieldItem.accessPath.join(".")}`,
    `${fieldItem.topLevelExplore} | ${fieldItem.accessPath.join(".")}`
  );
}

function byKindThenName(field1: FieldDef, field2: FieldDef) {
  const kind1 = kindOrd(field1);
  const kind2 = kindOrd(field2);
  if (kind1 === kind2) {
    const name1 = field1.as || field1.name;
    const name2 = field2.as || field2.name;
    if (name1 < name2) {
      return -1;
    }
    if (name2 < name1) {
      return 1;
    }
    return 0;
  }
  return kind1 - kind2;
}

function kindOrd(field: FieldDef) {
  if (field.type === "turtle") {
    return 0;
  }
  if (field.type === "struct") {
    return 4;
  }
  if ("aggregate" in field && field.aggregate) {
    return 2;
  }
  return 1;
}

function exploresByName(
  struct1: NamedMalloyObject,
  struct2: NamedMalloyObject
) {
  if (struct1.name < struct2.name) {
    return -1;
  }
  if (struct2.name < struct1.name) {
    return 1;
  }
  return 0;
}
