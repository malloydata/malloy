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
import { MALLOY_EXTENSION_STATE } from "./state";
import fetch from "node-fetch";

const telemetryLog = vscode.window.createOutputChannel("Malloy Telemetry");

function isTelemetryEnabled() {
  const vsCodeValue = vscode.env.isTelemetryEnabled;
  const configValue =
    vscode.workspace.getConfiguration("malloy").get("telemetry") ?? false;
  return vsCodeValue && configValue;
}

export interface GATrackingEvent {
  name: string;
  params: Record<string, string>;
}

const MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
const API_SECRET = process.env.GA_API_SECRET;

async function track(event: GATrackingEvent) {
  if (!isTelemetryEnabled()) return;

  telemetryLog.appendLine(`Logging telemetry event: ${JSON.stringify(event)}.`);

  console.log(`https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`);

  try {
    process.env.NODE_DEBUG = "http";
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
      {
        method: "POST",
        body: JSON.stringify({
          client_id: MALLOY_EXTENSION_STATE.getClientId(),
          events: [event],
        }),
      }
    );
  } catch (error) {
    telemetryLog.appendLine(`Logging telemetry event failed: ${error}`);
  }
}

export function trackQueryRun({ dialect }: { dialect: string }): Promise<void> {
  return track({
    name: "query_run",
    params: {},
  });
}

export function trackModelLoad(): Promise<void> {
  return track({
    name: "model_load",
    params: {},
  });
}

export function trackModelSave(): Promise<void> {
  return track({
    name: "model_save",
    params: {},
  });
}
