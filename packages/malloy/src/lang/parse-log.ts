/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {DocumentLocation} from '../model/malloy_types';

export type LogSeverity = 'error' | 'warn' | 'debug';

/**
 * Default severity is "error"
 */
export interface LogMessage {
  message: string;
  at?: DocumentLocation;
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
    this.rawLog.push(logMsg);
  }

  reset(): void {
    this.rawLog.length = 0;
  }

  noErrors(): boolean {
    return !this.hasErrors();
  }

  hasErrors(): boolean {
    const firstError = this.rawLog.find(l => l.severity !== 'warn');
    return firstError !== undefined;
  }

  empty(): boolean {
    return this.rawLog.length === 0;
  }
}
