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

import { TextDocument, Webview, WebviewPanel } from "vscode";
import { QueryResult } from "malloy";
import { QueryPanelMessage } from "./types";

export class WebviewMessageManager<T> {
  constructor(private webview: Webview) {
    this.webview.onDidReceiveMessage((message: T) => {
      if (!this.ready) {
        this.ready = true;
        this.pendingMessages.forEach((message) => webview.postMessage(message));
      }
      this.callback(message);
    });
  }

  private pendingMessages: T[] = [];
  private ready = false;
  private callback: (message: T) => void = () => {
    /* Do nothing by default */
  };

  public postMessage(message: T): void {
    if (this.ready) {
      this.webview.postMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  public onReceiveMessage(callback: (message: T) => void): void {
    this.callback = callback;
  }
}

export interface RunState {
  cancel: () => void;
  panel: WebviewPanel;
  messages: WebviewMessageManager<QueryPanelMessage>;
  panelId: string;
  document: TextDocument;
  result?: QueryResult;
}

class MalloyExtensionState {
  private activeWebviewPanelId: string | undefined;

  setActiveWebviewPanelId(panelId: string) {
    this.activeWebviewPanelId = panelId;
  }

  getActiveWebviewPanelId() {
    return this.activeWebviewPanelId;
  }

  getActiveWebviewPanel() {
    const id = this.activeWebviewPanelId;
    return id ? this.getRunState(id) : undefined;
  }

  private runStates: Map<string, RunState> = new Map();

  setRunState(panelId: string, state: RunState | undefined) {
    if (state) {
      this.runStates.set(panelId, state);
    } else {
      this.runStates.delete(panelId);
    }
  }

  getRunState(panelId: string) {
    return this.runStates.get(panelId);
  }
}

export const MALLOY_EXTENSION_STATE = new MalloyExtensionState();
