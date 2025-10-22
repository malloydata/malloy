/**
 * Utilities for generating date intervals for ordinal scales
 */

export type DateInterval =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'hour'
  | 'minute'
  | 'second';

/**
 * Generate an array of dates for a given interval between start and end
 * This creates a complete range of interval values, filling in gaps
 */
export function generateDateRange(
  start: Date | number,
  end: Date | number,
  interval: DateInterval
): number[] {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dates: number[] = [];

  // Floor the start date to the interval
  const current = floorDate(startDate, interval);

  // Generate dates until we pass the end date
  while (current <= endDate) {
    dates.push(current.valueOf());
    offsetDate(current, interval, 1);
  }

  return dates;
}

/**
 * Floor a date to the given interval
 */
function floorDate(date: Date, interval: DateInterval): Date {
  const d = new Date(date);

  switch (interval) {
    case 'second':
      d.setUTCMilliseconds(0);
      break;
    case 'minute':
      d.setUTCSeconds(0, 0);
      break;
    case 'hour':
      d.setUTCMinutes(0, 0, 0);
      break;
    case 'day':
      d.setUTCHours(0, 0, 0, 0);
      break;
    case 'week': {
      d.setUTCHours(0, 0, 0, 0);
      // Adjust to start of week (Sunday)
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day);
      break;
    }
    case 'month': {
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      break;
    }
    case 'quarter': {
      const month = d.getUTCMonth();
      const quarterMonth = Math.floor(month / 3) * 3;
      d.setUTCMonth(quarterMonth, 1);
      d.setUTCHours(0, 0, 0, 0);
      break;
    }
    case 'year':
      d.setUTCMonth(0, 1);
      d.setUTCHours(0, 0, 0, 0);
      break;
  }

  return d;
}

/**
 * Offset a date by the given interval and amount
 */
function offsetDate(date: Date, interval: DateInterval, amount: number): Date {
  switch (interval) {
    case 'second':
      date.setUTCSeconds(date.getUTCSeconds() + amount);
      break;
    case 'minute':
      date.setUTCMinutes(date.getUTCMinutes() + amount);
      break;
    case 'hour':
      date.setUTCHours(date.getUTCHours() + amount);
      break;
    case 'day':
      date.setUTCDate(date.getUTCDate() + amount);
      break;
    case 'week':
      date.setUTCDate(date.getUTCDate() + amount * 7);
      break;
    case 'month':
      date.setUTCMonth(date.getUTCMonth() + amount);
      break;
    case 'quarter':
      date.setUTCMonth(date.getUTCMonth() + amount * 3);
      break;
    case 'year':
      date.setUTCFullYear(date.getUTCFullYear() + amount);
      break;
  }

  return date;
}

/**
 * Determine if a date/time field should use an ordinal scale
 */
export function shouldUseOrdinalScale(field: {
  timeframe?: string;
  isDate(): boolean;
  isTime(): boolean;
}): boolean {
  // If it's a date field (no timestamp), use ordinal scale
  if (field.isDate()) {
    return true;
  }

  // If it has a timeframe extraction, use ordinal scale
  if (field.timeframe) {
    return true;
  }

  return false;
}

/**
 * Get the interval for a field based on its properties
 */
export function getFieldInterval(field: {
  timeframe?: string;
  isDate(): boolean;
}): DateInterval | null {
  // If it has a timeframe, use that
  if (field.timeframe) {
    // Handle all possible timeframe values
    if (field.timeframe.includes('second')) return 'second';
    if (field.timeframe.includes('minute')) return 'minute';
    if (field.timeframe.includes('hour')) return 'hour';
    if (field.timeframe.includes('day')) return 'day';
    if (field.timeframe.includes('week')) return 'week';
    if (field.timeframe.includes('month')) return 'month';
    if (field.timeframe.includes('quarter')) return 'quarter';
    if (field.timeframe.includes('year')) return 'year';
  }

  // If it's a date field without timeframe, default to day
  if (field.isDate()) {
    return 'day';
  }

  return null;
}
