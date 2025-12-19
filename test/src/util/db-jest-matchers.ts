/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Result, Runtime} from '@malloydata/malloy';
import EventEmitter from 'events';

interface ExpectedEvent {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      isSqlEq(): R;
      toEmitDuringCompile(
        runtime: Runtime,
        ...events: ExpectedEvent[]
      ): Promise<R>;
      toEmitDuringTranslation(
        runtime: Runtime,
        ...events: ExpectedEvent[]
      ): Promise<R>;
    }
  }
}

expect.extend({
  /**
   * Check the return of `sqlEQ(expr1,expr2)` and error if the database
   * does not find those two expressions to be equal.
   */
  isSqlEq(result: Result) {
    const wantEq = result.data.path(0, 'calc').value;
    const sql = result.sql.replace(/\n/g, '\n    ');
    if (wantEq !== '=') {
      return {
        pass: false,
        message: () =>
          `Got '${wantEq}' ${Object.prototype.toString.call(
            wantEq
          )} instead of '='\nSQL:\n    ${sql}`,
      };
    }
    return {
      pass: true,
      message: () => 'SQL expression matched',
    };
  },

  async toEmitDuringCompile(
    querySrc: string,
    runtime: Runtime,
    ...expectedEvents: ExpectedEvent[]
  ) {
    return toEmit(this, querySrc, 'compile', runtime, ...expectedEvents);
  },
  async toEmitDuringTranslation(
    querySrc: string,
    runtime: Runtime,
    ...expectedEvents: ExpectedEvent[]
  ) {
    return toEmit(this, querySrc, 'translate', runtime, ...expectedEvents);
  },
});

async function toEmit(
  context: jest.MatcherContext,
  querySrc: string,
  when: 'compile' | 'translate',
  runtime: Runtime,
  ...expectedEvents: ExpectedEvent[]
) {
  const eventStream = runtime.eventStream;
  if (eventStream === undefined) {
    return {
      pass: false,
      message: () => 'No event stream found',
    };
  }
  if (!(eventStream instanceof EventEmitter)) {
    return {
      pass: false,
      message: () => 'Event stream is not an EventEmitter',
    };
  }
  const gotEvents: ExpectedEvent[] = [];
  const eventIdsWeCareAbout = new Set(expectedEvents.map(e => e.id));
  for (const id of eventIdsWeCareAbout) {
    eventStream.on(id, data => {
      gotEvents.push({id, data});
    });
  }
  const model = runtime.loadModel(querySrc, {
    noThrowOnError: when === 'translate',
  });
  if (when === 'compile') {
    const query = model.loadFinalQuery();
    await query.getPreparedResult();
  } else {
    await model.getModel();
  }

  let matching = gotEvents.length === expectedEvents.length;
  if (matching) {
    for (let i = 0; i < expectedEvents.length; i++) {
      const got = gotEvents[i];
      const want = expectedEvents[i];
      matching &&= objectsMatch(got, want);
    }
  }

  if (!matching) {
    return {
      pass: false,
      message: () =>
        `Expected events ${context.utils.diff(expectedEvents, gotEvents)}`,
    };
  }

  return {
    pass: true,
    message: () => 'All events matched',
  };
}

// Check if two values are numerically equal (handles number/bigint interop)
function numericallyEqual(a: unknown, b: unknown): boolean {
  const aIsNumeric = typeof a === 'number' || typeof a === 'bigint';
  const bIsNumeric = typeof b === 'number' || typeof b === 'bigint';
  if (aIsNumeric && bIsNumeric) {
    // Use == for loose equality between number and bigint
    // eslint-disable-next-line eqeqeq
    return a == b;
  }
  return false;
}

// If expected is an object, all of the keys should also match,
// but the expected is allowed to have other keys that are not matched
function objectsMatch(a: unknown, mustHave: unknown): boolean {
  if (
    typeof mustHave === 'string' ||
    typeof mustHave === 'number' ||
    typeof mustHave === 'boolean' ||
    typeof mustHave === 'bigint' ||
    mustHave === undefined ||
    mustHave === null
  ) {
    // Handle numeric equality between number and bigint
    if (numericallyEqual(a, mustHave)) {
      return true;
    }
    return mustHave === a;
  } else if (Array.isArray(mustHave)) {
    if (Array.isArray(a)) {
      return (
        a.length === mustHave.length &&
        a.every((v, i) => objectsMatch(v, mustHave[i]))
      );
    }
    return false;
  } else {
    if (
      typeof a === 'string' ||
      typeof a === 'number' ||
      typeof a === 'boolean' ||
      typeof a === 'bigint' ||
      a === undefined ||
      a === null
    ) {
      return false;
    }
    if (Array.isArray(a)) return false;
    const keys = Object.keys(mustHave);
    for (const key of keys) {
      if (!objectsMatch(a[key], mustHave[key])) {
        return false;
      }
    }
    return true;
  }
}
