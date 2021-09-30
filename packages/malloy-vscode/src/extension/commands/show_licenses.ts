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

import * as vscode from "vscode";
import * as path from "path";

export async function showLicensesCommand(): Promise<void> {
  // Replace package.json with "licenses.txt" or whatever gets generated
  const licenseFilePath = path.join(__dirname, "../package.json");

  // We could open a NEW text document with the content of the licenses
  // If we did this, we could just fs.readFileSync the path and show it like so:
  // const document = await vscode.workspace.openTextDocument({
  //   language: "json",
  //   content: `The license for Malloy are...`,
  // });

  // Or just open the license file directly
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.parse(licenseFilePath)
  );

  await vscode.window.showTextDocument(doc, { preview: true });
}
