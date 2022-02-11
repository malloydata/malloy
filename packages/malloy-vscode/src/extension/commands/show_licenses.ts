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

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export async function showLicensesCommand(): Promise<void> {
  const licenseFilePath = path.join(__dirname, "third_party_notices.txt");

  const content = fs.readFileSync(licenseFilePath);
  const document = await vscode.workspace.openTextDocument({
    language: "text",
    content: content.toString(),
  });

  await vscode.window.showTextDocument(document, { preview: true });
}
