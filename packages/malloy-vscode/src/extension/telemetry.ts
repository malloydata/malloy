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

import fetch from "node-fetch";
import * as vscode from "vscode";

const telemetryLog = vscode.window.createOutputChannel("Malloy Telemetry");

function isTelemetryEnabled() {
  const vsCodeValue = vscode.env.isTelemetryEnabled;
  const configValue =
    vscode.workspace.getConfiguration("malloy").get("telemetry") ?? false;
  return vsCodeValue && configValue;
}

// TODO
const GA_TRACKING_ID = "";

async function trackEvent({
  category,
  action,
  label,
  value,
}: {
  category: string;
  action: string;
  label?: string | undefined;
  value?: number | undefined;
}): Promise<void> {
  if (!isTelemetryEnabled()) return;

  const params = new URLSearchParams();
  params.append("v", "1");
  params.append("tid", GA_TRACKING_ID);
  params.append("cid", "555"); // TODO
  params.append("t", "event");
  params.append("ec", category);
  params.append("ea", action);
  if (label !== undefined) {
    params.append("el", label);
  }
  if (value !== undefined) {
    params.append("ev", value.toString());
  }

  telemetryLog.appendLine(
    `Logging telemetry event. Category: ${category}, action: ${action}, label: ${label}, value: ${value}.`
  );

  try {
    await fetch("http://www.google-analytics.com/debug/collect", {
      method: "POST",
      body: params,
    });
  } catch (error) {
    telemetryLog.appendLine(`Logging telemetry event failed: ${error}`);
  }
}

export function trackQueryRun(): Promise<void> {
  return trackEvent({ category: "query", action: "run" });
}
