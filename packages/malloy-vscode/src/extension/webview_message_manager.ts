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

import { WebviewPanel, WebviewView } from "vscode";

export class WebviewMessageManager<T> {
  constructor(private panel: WebviewPanel | WebviewView) {
    this.panel.webview.onDidReceiveMessage((message: T) => {
      if (!this.clientCanReceiveMessages) {
        this.onClientCanReceiveMessages();
      }
      this.callback(message);
    });
    if ("onDidChangeViewState" in this.panel) {
      this.panel.onDidChangeViewState(() => {
        if (this.panelCanReceiveMessages && !this.panel.visible) {
          this.panelCanReceiveMessages = false;
        } else if (!this.panelCanReceiveMessages && this.panel.visible) {
          this.onPanelCanReceiveMessages();
        }
      });
    }
  }

  private pendingMessages: T[] = [];
  private panelCanReceiveMessages = true;
  private clientCanReceiveMessages = false;
  private callback: (message: T) => void = () => {
    /* Do nothing by default */
  };

  public postMessage(message: T): void {
    if (this.canSendMessages) {
      this.panel.webview.postMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  public onReceiveMessage(callback: (message: T) => void): void {
    this.callback = callback;
  }

  private flushPendingMessages() {
    this.pendingMessages.forEach((message) => {
      this.panel.webview.postMessage(message);
    });
    this.pendingMessages.splice(0, this.pendingMessages.length);
  }

  private onPanelCanReceiveMessages() {
    this.panelCanReceiveMessages = true;
    if (this.canSendMessages) {
      this.flushPendingMessages();
    }
  }

  private onClientCanReceiveMessages() {
    this.clientCanReceiveMessages = true;
    if (this.canSendMessages) {
      this.flushPendingMessages();
    }
  }

  private get canSendMessages() {
    return this.panelCanReceiveMessages && this.clientCanReceiveMessages;
  }
}
