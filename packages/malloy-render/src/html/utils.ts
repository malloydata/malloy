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

import startCase from 'lodash/startCase';
import type {RenderDef} from './data_styles';
import type {RendererOptions} from './renderer_types';
import {DateTime} from 'luxon';
import type * as Malloy from '@malloydata/malloy-interfaces';
import type {Field} from '../data_tree';

export function getColorScale(
  type: 'temporal' | 'ordinal' | 'quantitative' | 'nominal' | undefined,
  isRectMark: boolean,
  hasOverlappingText = false
): {range: string[]} | undefined {
  if (type === undefined) {
    return undefined;
  }
  switch (type) {
    case 'ordinal':
      return {range: ['#C2D5EE', '#1A73E8']};
    case 'temporal':
    case 'quantitative':
      return isRectMark
        ? hasOverlappingText
          ? {range: ['#6BA4EE', '#EEA361']}
          : {range: ['#1A73E8', '#E8710A']}
        : {range: ['#C2D5EE', '#1A73E8']};
    case 'nominal':
      return hasOverlappingText
        ? {
            range: [
              '#6BA4EE',
              '#66CEDC',
              '#EC72B8',
              '#EEA361',
              '#F9C85B',
              '#AACD85',
              '#B87CED',
              '#ACB0B3',
            ],
          }
        : {
            range: [
              '#1A73E8',
              '#12B5CB',
              '#E52592',
              '#E8710A',
              '#F9AB00',
              '#7CB342',
              '#9334E6',
              '#80868B',
            ],
          };
  }
}

function numberFixedDigits(value: number, digits: number) {
  return value.toString().padStart(digits, '0');
}

export function timeToString(
  time: Date,
  timeframe: Malloy.DateTimeframe | Malloy.TimestampTimeframe | undefined,
  timezone?: string
): string {
  timeframe ||= 'second';

  let shouldNormalize = false;
  switch (timeframe) {
    case 'hour':
    case 'minute':
    case 'second':
      shouldNormalize = true;
      break;
  }

  const dateTime = DateTime.fromJSDate(time, {
    zone: shouldNormalize && timezone ? timezone : 'UTC',
  });

  switch (timeframe) {
    case 'year': {
      const year = numberFixedDigits(dateTime.year, 4);
      return `${year}`;
    }
    case 'quarter': {
      const year = numberFixedDigits(dateTime.year, 4);
      const quarter = Math.floor(dateTime.month / 3) + 1;
      return `${year}-Q${quarter}`;
    }
    case 'month': {
      const year = numberFixedDigits(dateTime.year, 2);
      const month = numberFixedDigits(dateTime.month, 2);
      return `${year}-${month}`;
    }
    case 'week': {
      const year = numberFixedDigits(dateTime.year, 2);
      const month = numberFixedDigits(dateTime.month, 2);
      const day = numberFixedDigits(dateTime.day, 2);
      return `${year}-${month}-${day}-WK`;
    }
    case 'day': {
      const year = numberFixedDigits(dateTime.year, 2);
      const month = numberFixedDigits(dateTime.month, 2);
      const day = numberFixedDigits(dateTime.day, 2);
      return `${year}-${month}-${day}`;
    }
    case 'hour': {
      const year = numberFixedDigits(dateTime.year, 2);
      const month = numberFixedDigits(dateTime.month, 2);
      const day = numberFixedDigits(dateTime.day, 2);
      const hour = numberFixedDigits(dateTime.hour, 2);
      return `${year}-${month}-${day} ${hour}`;
    }
    case 'minute': {
      const year = numberFixedDigits(dateTime.year, 2);
      const month = numberFixedDigits(dateTime.month, 2);
      const day = numberFixedDigits(dateTime.day, 2);
      const hour = numberFixedDigits(dateTime.hour, 2);
      const minute = numberFixedDigits(dateTime.minute, 2);
      return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    case 'second': {
      const year = numberFixedDigits(dateTime.year, 2);
      const month = numberFixedDigits(dateTime.month, 2);
      const day = numberFixedDigits(dateTime.day, 2);
      const hour = numberFixedDigits(dateTime.hour, 2);
      const minute = numberFixedDigits(dateTime.minute, 2);
      const second = numberFixedDigits(dateTime.second, 2);
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
    default:
      throw new Error('Unknown timeframe.');
  }
}

export function normalizeToTimezone(date: Date, timezone: string | undefined) {
  const dateTime = DateTime.fromJSDate(date, {
    zone: timezone ?? 'UTC',
  });

  return new Date(
    dateTime.year,
    dateTime.month - 1,
    dateTime.day,
    dateTime.hour,
    dateTime.minute,
    dateTime.second,
    dateTime.millisecond
  );
}

/**
 * Use this function to break up expensive computation over multiple tasks.
 *
 * @return A promise, which when awaited, puts subsequent code in a separate task.
 *
 * This is useful for cases when expensive code needs to run "concurrently" with a
 * rendering / UI task. Sprinkling in `yieldTask`s into a long task allows other
 * tasks to run periodically.
 */
let LAST_YIELD_TIME: number | undefined = undefined;
const YIELD_DEBOUNCE = 100; // milliseconds
export async function yieldTask(): Promise<void> {
  const currentTime = Date.now();
  // We don't actually yield every time the function is called, because that can add a lot of
  // overhead in terms of new tasks. Instead, we debounce yielding to once every 100ms.
  if (LAST_YIELD_TIME && currentTime < LAST_YIELD_TIME + YIELD_DEBOUNCE) {
    return;
  }
  LAST_YIELD_TIME = currentTime;
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

export function createErrorElement(
  document: Document,
  error: string | Error
): HTMLElement {
  const element = document.createElement('span');
  element.classList.add('error');
  element.appendChild(
    document.createTextNode(typeof error === 'string' ? error : error.message)
  );
  return element;
}

export function createNullElement(document: Document): HTMLElement {
  const element = document.createElement('span');
  element.appendChild(document.createTextNode('∅'));
  element.classList.add('value-null');
  return element;
}

export function createDrillIcon(document: Document): HTMLElement {
  const drill = document.createElement('div');
  drill.classList.add('drill-icon');
  drill.innerHTML = `
  <style>
    .drill-icon:hover .copy-circle {
      fill: #eef7f9;
    }

    .drill-icon:active .copy-circle {
      fill: #cfe9f0;
    }

    .drill-icon:hover .copy-icon,
    .drill-icon:active .copy-icon {
      fill: #53b2c8;
    }
  </style>
  <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="12" fill="none" class="copy-circle" />
        <svg
          x="6"
          y="6"
          width="12"
          height="14"
          viewBox="0 0 12 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 10.6667C3.63333 10.6667 3.31944 10.5361 3.05833 10.275C2.79722 10.0139 2.66667 9.7 2.66667 9.33333V1.33333C2.66667 0.966667 2.79722 0.652778 3.05833 0.391667C3.31944 0.130556 3.63333 0 4 0H10C10.3667 0 10.6806 0.130556 10.9417 0.391667C11.2028 0.652778 11.3333 0.966667 11.3333 1.33333V9.33333C11.3333 9.7 11.2028 10.0139 10.9417 10.275C10.6806 10.5361 10.3667 10.6667 10 10.6667H4ZM4 9.33333H10V1.33333H4V9.33333ZM1.33333 13.3333C0.966667 13.3333 0.652778 13.2028 0.391667 12.9417C0.130556 12.6806 0 12.3667 0 12V2.66667H1.33333V12H8.66667V13.3333H1.33333Z"
            fill="#E7E7E7"
            class="copy-icon"
          />
        </svg>
      </svg>`;
  return drill;
}

export function formatTitle(
  options: RendererOptions,
  field: Field,
  renderDef?: RenderDef | undefined,
  timezone?: string
) {
  const label = renderDef?.data?.label || field.name;
  let title = options.titleCase ? startCase(label) : label;
  if (field.isTime() && timezone) {
    title = `${title} (${timezone})`;
  }

  return title;
}
