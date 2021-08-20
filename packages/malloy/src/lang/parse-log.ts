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

export interface SourcePosition {
  line: number;
  char?: number;
}

type LogSeverity = "error" | "warn" | "debug";

/**
 * All errors are guaranteed to have a message, many errors will have a
 * start position, some errors will have an end position.
 *
 * "severity" is not required and defaults to "error"
 */
export interface LogMessage {
  sourceURL: string;
  message: string;
  begin?: SourcePosition;
  end?: SourcePosition;
  severity?: LogSeverity;
}

export interface MessageLogger {
  log(logMsg: LogMessage): void;
  reset(): void;
  getLog(): LogMessage[];
  hasErrors(): boolean;
  noErrors(): boolean;
  empty(): boolean;
}

export class MessageLog implements MessageLogger {
  private rawLog: LogMessage[] = [];

  getLog(): LogMessage[] {
    return this.rawLog;
  }

  log(logMsg: LogMessage): void {
    const xMsg = { ...logMsg };
    if (
      xMsg.end &&
      xMsg.end.line === xMsg.begin?.line &&
      xMsg.end.char === xMsg.begin?.char
    ) {
      delete xMsg.end;
    }
    this.rawLog.push(xMsg);
  }

  reset(): void {
    this.rawLog.length = 0;
  }

  noErrors(): boolean {
    return !this.hasErrors();
  }

  hasErrors(): boolean {
    const firstError = this.rawLog.find((l) => l.severity !== "warn");
    return firstError !== undefined;
  }

  empty(): boolean {
    return this.rawLog.length === 0;
  }
}
