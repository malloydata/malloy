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
import {EventStream} from './events';

export type LogSeverity = 'error' | 'warn' | 'debug';

/**
 * Default severity is "error"
 */
export interface LogMessage {
  message: string;
  at?: DocumentLocation;
  severity: LogSeverity;
  errorTag?: string;
  replacement?: string;
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

  constructor(private readonly eventStream: EventStream | null) {}

  getLog(): LogMessage[] {
    return this.rawLog;
  }

  /**
   * Add a message to the log.
   *
   * If the messsage ends with '[tag]', the tag is removed and stored in the `errorTag` field.
   * @param logMsg Message possibly containing an error tag
   */
  log(logMsg: LogMessage): void {
    const msg = logMsg.message;
    // github security is worried about msg.match(/^(.+)\[(.+)\]$/ because if someone
    // could craft code with a long varibale name which would blow up that regular expression
    if (msg.endsWith(']')) {
      const tagStart = msg.lastIndexOf('[');
      if (tagStart > 0) {
        logMsg.message = msg.slice(0, tagStart);
        logMsg.errorTag = msg.slice(tagStart + 1, -1);
      }
    }
    this.rawLog.push(logMsg);
    this.eventStream?.emit({
      id: `translation-${logMsg.severity}`,
      data: {code: logMsg.errorTag, data: null, message: logMsg.message}, // TODO change to code
    });
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
