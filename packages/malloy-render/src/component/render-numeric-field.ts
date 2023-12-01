import {AtomicField} from '@malloydata/malloy';
import {Currency, DurationUnit} from '../data_styles';
import {format} from 'ssf';

// Map of unit to how many units of the make up the following time unit.
const multiplierMap = new Map<DurationUnit, number>([
  [DurationUnit.Nanoseconds, 1000],
  [DurationUnit.Microseconds, 1000],
  [DurationUnit.Milliseconds, 1000],
  [DurationUnit.Seconds, 60],
  [DurationUnit.Minutes, 60],
  [DurationUnit.Hours, 24],
  [DurationUnit.Days, Number.MAX_VALUE],
]);

function formatTimeUnit(value: number, unit: DurationUnit) {
  let unitString = unit.toString();
  if (value === 1) {
    unitString = unitString.substring(0, unitString.length - 1);
  }
  return `${value} ${unitString}`;
}

export function renderNumericField(f: AtomicField, value: number) {
  let displayValue: string | number = value;
  const {tag} = f.tagParse();
  if (tag.has('currency')) {
    let unitText = '$';

    switch (tag.text('currency')) {
      case Currency.Euros:
        unitText = '€';
        break;
      case Currency.Pounds:
        unitText = '£';
        break;
      case Currency.Dollars:
        // Do nothing.
        break;
    }
    displayValue = format(`${unitText}#,##0.00`, value);
  } else if (tag.has('percent')) displayValue = format('#,##0.00%', value);
  else if (tag.has('duration')) {
    const duration_unit = tag.text('duration');
    const targetUnit = duration_unit ?? DurationUnit.Seconds;

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
          formatTimeUnit(currentUnitValue, unit),
          ...durationParts,
        ];
      }

      if (currentDuration === 0) {
        break;
      }
    }

    if (durationParts.length > 0) {
      displayValue = durationParts.slice(0, 2).join(' ');
    } else displayValue = formatTimeUnit(0, targetUnit as DurationUnit);
  } else if (tag.has('number'))
    displayValue = format(tag.text('number')!, value);
  else displayValue = (value as number).toLocaleString();
  return displayValue;
}
