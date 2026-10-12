/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Time strings and durations for one value. Pure: no DOM, no data tree — part
// of the headless `@malloydata/render/format` entry.

import {format} from 'ssf';
import {DurationUnit, isDurationUnit} from '../html/data_styles';
import {timeToString as htmlTimeToString} from '../html/utils';

// Copied from malloy core to avoid depending on it for simple type guards.
type DateUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';
function isDateUnit(str: string): str is DateUnit {
  return ['day', 'week', 'month', 'quarter', 'year'].includes(str);
}
type TimestampUnit = DateUnit | 'hour' | 'minute' | 'second';
function isTimestampUnit(s: string): s is TimestampUnit {
  return isDateUnit(s) || ['hour', 'minute', 'second'].includes(s);
}

export function formatTimeUnit(
  value: number,
  unit: DurationUnit,
  options: {numFormat?: string; terse?: boolean} = {}
) {
  let unitString = unit.toString();
  if (options.terse) {
    unitString = terseDurationUnitsMap.get(unit) ?? unitString;
  } else if (value === 1) {
    unitString = unitString.substring(0, unitString.length - 1);
  }

  const formattedValue = options.numFormat
    ? format(options.numFormat, value)
    : value.toLocaleString();
  return `${formattedValue}${options.terse ? '' : ' '}${unitString}`;
}

const terseDurationUnitsMap = new Map<DurationUnit, string>([
  [DurationUnit.Nanoseconds, 'ns'],
  [DurationUnit.Microseconds, 'µs'],
  [DurationUnit.Milliseconds, 'ms'],
  [DurationUnit.Seconds, 's'],
  [DurationUnit.Minutes, 'm'],
  [DurationUnit.Hours, 'h'],
  [DurationUnit.Days, 'd'],
]);

const multiplierMap = new Map<DurationUnit, number>([
  [DurationUnit.Nanoseconds, 1000],
  [DurationUnit.Microseconds, 1000],
  [DurationUnit.Milliseconds, 1000],
  [DurationUnit.Seconds, 60],
  [DurationUnit.Minutes, 60],
  [DurationUnit.Hours, 24],
  [DurationUnit.Days, Number.MAX_VALUE],
]);

/**
 * A duration in `options.durationUnit` (seconds by default) as its two largest
 * nonzero parts, e.g. 3725 → "1 hour 2 minutes"; `terse` → "1h 2m".
 */
export function formatDuration(
  value: number,
  options: {
    durationUnit?: string;
    terse?: boolean;
  }
): string {
  const targetUnit =
    options.durationUnit && isDurationUnit(options.durationUnit)
      ? options.durationUnit
      : DurationUnit.Seconds;
  const numFormat = undefined; // Format now resolved at setup time
  const terse = options.terse ?? false;

  let currentDuration = value;
  let currentUnitValue = 0;
  let durationParts: string[] = [];
  let foundUnit = false;

  for (const [unit, multiplier] of multiplierMap) {
    if (unit === targetUnit) {
      foundUnit = true;
    }

    if (!foundUnit) {
      continue;
    }

    currentUnitValue = currentDuration % multiplier;
    currentDuration = Math.floor((currentDuration /= multiplier));

    if (currentUnitValue > 0) {
      durationParts = [
        formatTimeUnit(currentUnitValue, unit, {numFormat, terse}),
        ...durationParts,
      ];
    }

    if (currentDuration === 0) {
      break;
    }
  }

  if (durationParts.length > 0) {
    return durationParts.slice(0, 2).join(' ');
  }

  return formatTimeUnit(0, targetUnit, {numFormat, terse});
}

function padZeros(num: number, length = 2) {
  return `${'0'.repeat(length - 1)}${num}`.slice(-length);
}

export interface RenderTimeStringOptions {
  isDate?: boolean;
  timeframe?: string;
  extractFormat?: 'month-day' | 'quarter' | 'month' | 'week' | 'day';
  timezone?: string;
}

export function renderTimeString(
  value: Date,
  options: RenderTimeStringOptions = {}
) {
  // If timezone is provided, use the timezone-aware function
  // For full timestamps without timeframe, default to 'second' granularity
  if (options.timezone) {
    const timeframe =
      options.timeframe && isTimestampUnit(options.timeframe)
        ? options.timeframe
        : 'second';
    return htmlTimeToString(value, timeframe, options.timezone);
  }

  // Handle extraction formats for YoY mode
  if (options.extractFormat) {
    switch (options.extractFormat) {
      case 'month-day':
        return value.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
      case 'month':
        return value.toLocaleDateString('en-US', {
          month: 'long',
          timeZone: 'UTC',
        });
      case 'quarter':
        return `Q${Math.floor(value.getUTCMonth() / 3) + 1}`;
      case 'week':
        return value.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
      case 'day':
        return value.toLocaleDateString('en-US', {
          day: 'numeric',
          timeZone: 'UTC',
        });
    }
  }

  // Original logic
  const fullYear = value.getUTCFullYear();
  const fullMonth = padZeros(value.getUTCMonth() + 1);
  const fullDate = padZeros(value.getUTCDate());
  const hours = padZeros(value.getUTCHours());
  const minutes = padZeros(value.getUTCMinutes());
  const seconds = padZeros(value.getUTCSeconds());
  const time = `${hours}:${minutes}:${seconds}`;
  const dateDisplay = `${fullYear}-${fullMonth}-${fullDate}`;

  // Use type guards for safer timeframe validation
  const timeframe = options.timeframe;
  if (timeframe && isTimestampUnit(timeframe)) {
    switch (timeframe) {
      case 'second': {
        return `${dateDisplay} ${time}`;
      }
      case 'minute': {
        return `${dateDisplay} ${hours}:${minutes}`;
      }
      case 'hour': {
        return `${dateDisplay} ${hours}`;
      }
      case 'day': {
        return `${dateDisplay}`;
      }
      case 'week': {
        return `${dateDisplay}-WK`;
      }
      case 'month': {
        return `${fullYear}-${fullMonth}`;
      }
      case 'quarter': {
        return `${fullYear}-Q${Math.floor(value.getUTCMonth() / 3) + 1}`;
      }
      case 'year': {
        return value.getUTCFullYear().toString();
      }
    }
  }

  // Fallback for unrecognized timeframes or no timeframe
  if (options.isDate) return dateDisplay;
  return `${dateDisplay} ${time}`;
}
