import {RendererProps} from './apply-renderer';

function padZeros(num: number, length = 2) {
  return `${'0'.repeat(length - 1)}${num}`.slice(-length);
}

export function renderTimeString(
  value: Date,
  isDate: boolean,
  timeframe?: string
) {
  const fullYear = value.getUTCFullYear();
  const fullMonth = padZeros(value.getUTCMonth() + 1);
  const fullDate = padZeros(value.getUTCDate());
  const hours = padZeros(value.getUTCHours());
  const minutes = padZeros(value.getUTCMinutes());
  const seconds = padZeros(value.getUTCSeconds());
  const time = `${hours}:${minutes}:${seconds}`;
  const dateDisplay = `${fullYear}-${fullMonth}-${fullDate}`;
  switch (timeframe) {
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
    default: {
      if (isDate) return dateDisplay;
      return `${dateDisplay} ${time}`;
    }
  }
}

export function renderTime({dataColumn}: RendererProps) {
  if (!dataColumn.field.isAtomic())
    throw new Error(
      `Time renderer error: field ${dataColumn.field.name} is not an atomic field`
    );
  if (!dataColumn.isTime())
    throw new Error(
      `Time renderer error: field ${dataColumn.field.name} is not a date or timestamp`
    );

  const value = dataColumn.value;
  return renderTimeString(
    value,
    dataColumn.field.isDate(),
    dataColumn.field.timeframe
  );
}
