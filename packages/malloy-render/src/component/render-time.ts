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
    const dateDisplay = getUTCDisplayDate(value);
    const hours = padZeros(value.getUTCHours());
    const minutes = padZeros(value.getUTCMinutes());
    const seconds = padZeros(value.getUTCSeconds());
    const time = `${hours}:${minutes}:${seconds}`;
    return `${dateDisplay} ${time}`;
  }
  return '';
}
