import {RendererProps} from './apply-renderer';

function padZeros(num: number, length = 2) {
  return `${'0'.repeat(length - 1)}${num}`.slice(-length);
}

function getUTCDisplayDate(date: Date) {
  const fullYear = date.getUTCFullYear();
  const fullMonth = padZeros(date.getUTCMonth() + 1);
  const fullDate = padZeros(date.getUTCDate());
  return `${fullYear}-${fullMonth}-${fullDate}`;
}

export function renderTime({field, dataColumn}: RendererProps) {
  if (!field.isAtomicField())
    throw new Error(
      `Time renderer error: field ${field.name} is not an atomic field`
    );
  if (!field.isDate() && !field.isTimestamp())
    throw new Error(
      `Time renderer error: field ${field.name} is not a date or timestamp`
    );

  if (field.isDate()) {
    const value = dataColumn.value as Date;
    return getUTCDisplayDate(value);
  }
  if (field.isTimestamp()) {
    const value = dataColumn.value as Date;
    const fullYear = value.getUTCFullYear();
    const fullMonth = padZeros(value.getUTCMonth() + 1);
    const fullDate = padZeros(value.getUTCDate());
    const hours = padZeros(value.getUTCHours());
    const minutes = padZeros(value.getUTCMinutes());
    const seconds = padZeros(value.getUTCSeconds());
    const time = `${hours}:${minutes}:${seconds}`;
    const dateDisplay = `${fullYear}-${fullMonth}-${fullDate}`;
    switch (field.timeframe) {
      case 'minute': {
        return `${dateDisplay} ${hours}:${minutes}`;
      }
      case 'hour': {
        return `${dateDisplay} ${hours}:00 for 1 hour`;
      }
      case 'day': {
        return `${dateDisplay}`;
      }
      case 'week': {
        return `WK${dateDisplay}`;
      }
      case 'month': {
        return `${fullYear}-${fullMonth}`;
      }
      case 'quarter': {
        return `${fullYear}-Q${Math.floor(value.getUTCMonth() / 3) + 1}`;
      }
      case 'year': {
        return value.getUTCFullYear();
      }
      default: {
        return `${dateDisplay} ${time}`;
      }
    }
  }
  return '';
}
