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

import {
  DataColumn,
  DateTimeframe,
  Field,
  Tag,
  TimestampTimeframe,
} from '@malloydata/malloy';
import startCase from 'lodash/startCase';
import {RenderDef} from '../data_styles';
import {RendererOptions} from '../renderer_types';
import {DateTime} from 'luxon';

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
  timeframe: DateTimeframe | TimestampTimeframe | undefined,
  timezone?: string
): string {
  timeframe ||= TimestampTimeframe.Second;

  let shouldNormalize = false;
  switch (timeframe) {
    case TimestampTimeframe.Hour:
    case TimestampTimeframe.Minute:
    case TimestampTimeframe.Second:
      shouldNormalize = true;
      break;
  }

  const dateTime = DateTime.fromJSDate(time, {
    zone: shouldNormalize && timezone ? timezone : 'UTC',
  });

  switch (timeframe) {
    case TimestampTimeframe.Year:
    case DateTimeframe.Year: {
      const year = numberFixedDigits(dateTime.year, 4);
      return `${year}`;
    }
    case TimestampTimeframe.Quarter:
    case DateTimeframe.Quarter: {
      const year = numberFixedDigits(dateTime.year, 4);
      const quarter = Math.floor(dateTime.month / 3) + 1;
      return `${year}-Q${quarter}`;
    }
    case TimestampTimeframe.Month:
    case DateTimeframe.Month: {
      const year = numberFixedDigits(dateTime.year, 2);
      const month = numberFixedDigits(dateTime.month, 2);
      return `${year}-${month}`;
    }
    case TimestampTimeframe.Week:
    case DateTimeframe.Week: {
      const year = numberFixedDigits(dateTime.year, 2);
      const month = numberFixedDigits(dateTime.month, 2);
      const day = numberFixedDigits(dateTime.day, 2);
      return `WK${year}-${month}-${day}`;
    }
    case DateTimeframe.Day:
    case TimestampTimeframe.Day: {
      const year = numberFixedDigits(dateTime.year, 2);
      const month = numberFixedDigits(dateTime.month, 2);
      const day = numberFixedDigits(dateTime.day, 2);
      return `${year}-${month}-${day}`;
    }
    case TimestampTimeframe.Hour: {
      const year = numberFixedDigits(dateTime.year, 2);
      const month = numberFixedDigits(dateTime.month, 2);
      const day = numberFixedDigits(dateTime.day, 2);
      const hour = numberFixedDigits(dateTime.hour, 2);
      return `${year}-${month}-${day} ${hour}:00 for 1 hour`;
    }
    case TimestampTimeframe.Minute: {
      const year = numberFixedDigits(dateTime.year, 2);
      const month = numberFixedDigits(dateTime.month, 2);
      const day = numberFixedDigits(dateTime.day, 2);
      const hour = numberFixedDigits(dateTime.hour, 2);
      const minute = numberFixedDigits(dateTime.minute, 2);
      return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    case TimestampTimeframe.Second: {
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
  drill.style.borderRadius = '20px';
  drill.style.backgroundColor = 'var(--malloy-border-color, #efefef)';
  drill.style.width = '27px';
  drill.style.height = '14px';
  drill.style.display = 'flex';
  drill.style.justifyContent = 'center';
  drill.style.alignItems = 'center';
  drill.style.gap = '2px';
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.style.backgroundColor = 'var(--malloy-title-color, rgb(181 181 181))';
    dot.style.borderRadius = '5px';
    dot.style.width = '4px';
    dot.style.height = '4px';
    drill.appendChild(dot);
  }
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
  if (
    field.isAtomicField() &&
    (field.isDate() || field.isTimestamp()) &&
    timezone
  ) {
    title = `${title} (${timezone})`;
  }

  return title;
}

export function getParentRecord(data: DataColumn, n = 0) {
  let record = data;
  while (n > 0 && record.parentRecord) {
    n -= 1;
    record = record.parentRecord;
  }
  return record;
}

export function getDynamicValue<T = unknown>({
  tag,
  data,
}: {
  tag: Tag;
  data: DataColumn;
}): T | undefined {
  const match = tag
    .tag('field')
    ?.text()
    ?.match(/^(\^*)(.*)/);
  if (!match) return undefined;

  const [, parentScoping, fieldName] = match;

  const ancestorCt = parentScoping.length;
  const scope = getParentRecord(data, ancestorCt);
  if ('cell' in scope) return scope.cell(fieldName)?.value as T;
  return undefined;
}
