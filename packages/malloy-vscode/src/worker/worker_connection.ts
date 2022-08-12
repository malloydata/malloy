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

/* eslint-disable no-console */
import * as child_process from "child_process";
import * as vscode from "vscode";
import { Message, WorkerMessage } from "./types";
const workerLog = vscode.window.createOutputChannel("Malloy Worker");

const DEFAULT_RESTART_SECONDS = 1;

export class WorkerConnection {
  worker!: child_process.ChildProcess;

  constructor(context: vscode.ExtensionContext) {
    const workerModule = context.asAbsolutePath("dist/worker.js");

    const startWorker = () => {
      this.worker = child_process
        .fork(workerModule, { execArgv: ["--no-lazy", "--inspect=6010"] })
        .on("error", console.error)
        .on("exit", (status) => {
          if (status !== 0) {
            console.error(`Worker exited with ${status}`);
            console.info(`Restarting in ${DEFAULT_RESTART_SECONDS} seconds`);
            // Maybe exponential backoff? Not sure what our failure
            // modes are going to be
            setTimeout(startWorker, DEFAULT_RESTART_SECONDS * 1000);
            this.notifyListeners({ type: "dead" });
          }
        })
        .on("message", (message: WorkerMessage) => {
          if (message.type === "log") {
            workerLog.appendLine(`worker: ${message.message}`);
          }
        });
    };
    startWorker();
  }

  send(message: Message): void {
    this.worker.send?.(message);
  }

  notifyListeners(message: WorkerMessage): void {
    this.worker.emit("message", message);
  }

  on(event: string, listener: (message: WorkerMessage) => void): void {
    this.worker.on(event, listener);
  }

  off(event: string, listener: (message: WorkerMessage) => void): void {
    this.worker.off(event, listener);
  }

  stop(): void {
    this.worker.kill("SIGHUP");
  }
}
