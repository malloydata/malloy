/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as Malloy from '@malloydata/malloy-interfaces';

export class Timer {
  readonly startTime: number;
  private endTime: number | undefined = undefined;
  private detailedTiming: Malloy.TimingInfo[] = [];
  constructor(readonly name: string) {
    this.startTime = performance.now();
  }

  incorporate(timing: Malloy.TimingInfo | undefined) {
    this.contribute(timing?.detailed_timing);
  }

  contribute(timings: Malloy.TimingInfo[] | undefined) {
    this.detailedTiming.push(...(timings ?? []));
  }

  stop(): Malloy.TimingInfo {
    this.endTime = performance.now();
    return {
      name: this.name,
      duration_ms: this.endTime - this.startTime,
      detailed_timing: [...this.detailedTiming.values()],
    };
  }
}
