import {
  DateMoment,
  DateBetweenClause,
  DateForClause,
  DateClause,
} from './date_types';

export class DateSerializer {
  constructor(private clauses: DateClause[]) {
    this.clauses = clauses;
  }

  public serialize(): string {
    const result = DateSerializer.clausesToString(this.clauses);
    return result.trim().replace(/,$/, '');
  }

  private static dateMomentToString(moment: DateMoment): string {
    if (moment.type === 'ABSOLUTE') {
      return moment.date;
    } else if (moment.type === 'INTERVAL') {
      return moment.kind + ' ' + moment.unit;
    } else if (moment.type === 'NAMED') {
      return moment.name;
    } else if (moment.type === 'OFFSET_FROM_NOW') {
      const direction = moment.direction === 'FROMNOW' ? 'FROM NOW' : 'AGO';
      return moment.amount + ' ' + moment.unit + ' ' + direction;
    } else if (moment.type === 'SPAN_FROM_NOW') {
      return moment.direction + ' ' + moment.amount + ' ' + moment.unit;
    } else {
      throw new Error('moment type not recognized ' + JSON.stringify(moment));
    }
  }

  private static goDateBetweenClause(clause: DateBetweenClause): string {
    return (
      DateSerializer.dateMomentToString(clause.from) +
      ' TO ' +
      DateSerializer.dateMomentToString(clause.to)
    );
  }

  private static goDateForClause(clause: DateForClause): string {
    return (
      DateSerializer.dateMomentToString(clause.from) +
      ' FOR ' +
      clause.duration.amount +
      ' ' +
      clause.duration.unit
    );
  }

  private static clauseToString(clause: DateClause): string {
    if (!('operator' in clause)) {
      throw new Error('Invalid date clause ' + JSON.stringify(clause));
    }
    if (clause.operator === 'TO_RANGE') {
      return DateSerializer.goDateBetweenClause(clause);
    } else if (clause.operator === 'FOR_RANGE') {
      return DateSerializer.goDateForClause(clause);
    } else if (clause.operator === 'BEFORE') {
      return 'BEFORE ' + DateSerializer.dateMomentToString(clause.moment);
    } else if (clause.operator === 'AFTER') {
      return 'AFTER ' + DateSerializer.dateMomentToString(clause.moment);
    } else if (clause.operator === 'ON') {
      return DateSerializer.dateMomentToString(clause.moment);
    } else if (clause.operator === 'DURATION') {
      return clause.duration.amount + ' ' + clause.duration.unit;
    } else {
      throw new Error('Clause type not recognized ' + JSON.stringify(clause));
    }
  }

  private static clausesToString(clauses: DateClause[]): string {
    let result = '';
    for (const clause of clauses) {
      result += DateSerializer.clauseToString(clause);
      result += ', ';
    }
    return result;
  }
}
