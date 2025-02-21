import {
  DateRange,
  DateMoment,
  DateMomentInterval,
  DateMomentNumberInterval,
  DateMomentNumberUnit,
  DateMomentNumber,
  Clause,
} from './clause_types';
import {BaseSerializer} from './base_serializer';

export class DateSerializer extends BaseSerializer {
  constructor(clauses: Clause[]) {
    super(clauses);
  }

  public serialize(): string {
    let result = DateSerializer.clausesToString(this.clauses);
    return result.trim().replace(/,$/, '');
  }

  private static dateMomentToString(operator: string, clause: Clause): string {
    if (
      operator === 'NOW' ||
      operator === 'TODAY' ||
      operator === 'YESTERDAY' ||
      operator === 'TOMORROW'
    ) {
      const custom: DateMoment = clause as DateMoment;
      return custom.prefix ? custom.prefix + ' ' + operator : operator;
    } else if (
      operator === 'LAST' ||
      operator === 'THIS' ||
      operator === 'NEXT'
    ) {
      const custom: DateMomentInterval = clause as DateMomentInterval;
      let value = custom.operator + ' ' + custom.unit;
      if (custom.prefix) {
        value = custom.prefix + ' ' + value;
      }
      return value;
    } else if (operator === 'LASTN' || operator === 'NEXTN') {
      const custom: DateMomentNumberInterval =
        clause as DateMomentNumberInterval;
      operator = operator.substring(0, 4); // Strip "N"
      let value = operator + ' ' + custom.value + ' ' + custom.unit;
      if (custom.prefix) {
        value = custom.prefix + ' ' + value;
      }
      return value;
    } else if (operator === 'AGO' || operator === 'FROMNOW') {
      const custom: DateMomentNumberInterval =
        clause as DateMomentNumberInterval;
      if (operator === 'FROMNOW') operator = 'FROM NOW';
      let value = custom.value + ' ' + custom.unit + ' ' + operator;
      if (custom.prefix) {
        value = custom.prefix + ' ' + value;
      }
      return value;
    } else if (operator === 'TIMEBLOCK') {
      const custom: DateMomentNumberUnit = clause as DateMomentNumberUnit;
      let value = custom.value + ' ' + custom.unit;
      if (custom.prefix) {
        value = custom.prefix + ' ' + value;
      }
      return value;
    } else if (operator === 'DATE' || operator === 'DATETIME') {
      const custom: DateMomentNumber = clause as DateMomentNumber;
      let value = custom.date;
      if (custom.time) {
        value = value + ' ' + custom.time;
      }
      if (custom.prefix) {
        value = custom.prefix + ' ' + value;
      }
      return value;
    }
    return '';
  }

  private static dateRangeToString(
    operator: 'TO' | 'FOR',
    clause: DateRange
  ): string {
    return (
      DateSerializer.dateMomentToString(clause.start.operator, clause.start) +
      ' ' +
      clause.operator +
      ' ' +
      DateSerializer.dateMomentToString(clause.end.operator, clause.end)
    );
  }

  private static clauseToString(operator: string, clause: Clause): string {
    if (operator === 'TO' || operator === 'FOR') {
      const custom = clause as DateRange;
      return DateSerializer.dateRangeToString(operator, custom);
    }
    return DateSerializer.dateMomentToString(operator, clause);
  }

  private static clausesToString(clauses: Clause[]): string {
    let result = '';
    for (const clause of clauses) {
      if ('operator' in clause) {
        result += DateSerializer.clauseToString(clause.operator, clause);
        result += ', ';
      } else {
        throw new Error('Invalid date clause ' + JSON.stringify(clause));
      }
    }
    return result;
  }
}
