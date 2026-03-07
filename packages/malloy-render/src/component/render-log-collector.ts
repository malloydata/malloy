/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Tag} from '@malloydata/malloy-tag';
import type * as Malloy from '@malloydata/malloy-interfaces';

const NO_LOCATION = {
  url: '',
  range: {
    start: {line: 0, character: 0},
    end: {line: 0, character: 0},
  },
};

function getLocation(tag?: Tag): {url: string; range: Malloy.DocumentRange} {
  return tag?.location ?? NO_LOCATION;
}

/**
 * Collects LogMessages during rendering.
 * Semantic validation logs are added during setResult().
 * Unread tag warnings are added when onReady fires after render completes.
 */
export class RenderLogCollector {
  private logs: Malloy.LogMessage[] = [];

  reset(): void {
    this.logs = [];
  }

  warn(message: string, tag?: Tag): void {
    this.add('warn', message, tag);
  }

  error(message: string, tag?: Tag): void {
    this.add('error', message, tag);
  }

  private add(severity: Malloy.LogSeverity, message: string, tag?: Tag): void {
    const {url, range} = tag ? getLocation(tag) : getLocation();
    this.logs.push({
      url,
      range,
      severity,
      message,
    });
  }

  /**
   * Walk a tag tree and generate warnings for any unread properties.
   * Call this after rendering is complete.
   */
  collectUnreadTags(tag: Tag, fieldName: string): void {
    const unread = tag.getUnreadProperties();
    for (const path of unread) {
      const pathStr = path.join('.');
      // Don't use tag.find() here — it would mark the unread tag as read,
      // making this method non-idempotent. Use the tag itself for location.
      this.warn(`Unknown render tag '${pathStr}' on field '${fieldName}'`, tag);
    }
  }

  getLogs(): Malloy.LogMessage[] {
    return [...this.logs];
  }
}
