/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
    if (moment.type === 'absolute') {
      return moment.date;
    } else if (moment.type === 'interval') {
      return moment.kind + ' ' + moment.unit;
    } else if (moment.type === 'named') {
      return moment.name;
    } else if (moment.type === 'offset_from_now') {
      const direction = moment.direction === 'from_now' ? 'from now' : 'ago';
      return moment.amount + ' ' + moment.unit + ' ' + direction;
    } else if (moment.type === 'span_from_now') {
      return moment.direction + ' ' + moment.amount + ' ' + moment.unit;
    } else {
      throw new Error('moment type not recognized ' + JSON.stringify(moment));
    }
  }

  private static goDateBetweenClause(clause: DateBetweenClause): string {
    return (
      DateSerializer.dateMomentToString(clause.from) +
      ' to ' +
      DateSerializer.dateMomentToString(clause.to)
    );
  }

  private static goDateForClause(clause: DateForClause): string {
    return (
      DateSerializer.dateMomentToString(clause.from) +
      ' for ' +
      clause.duration.amount +
      ' ' +
      clause.duration.unit
    );
  }

  private static clauseToString(clause: DateClause): string {
    if (!('operator' in clause)) {
      throw new Error('Invalid date clause ' + JSON.stringify(clause));
    }
    if (clause.operator === 'to_range') {
      return DateSerializer.goDateBetweenClause(clause);
    } else if (clause.operator === 'for_range') {
      return DateSerializer.goDateForClause(clause);
    } else if (clause.operator === 'before') {
      return 'before ' + DateSerializer.dateMomentToString(clause.moment);
    } else if (clause.operator === 'after') {
      return 'after ' + DateSerializer.dateMomentToString(clause.moment);
    } else if (clause.operator === 'on') {
      return DateSerializer.dateMomentToString(clause.moment);
    } else if (clause.operator === 'null') {
      return 'null';
    } else if (clause.operator === 'not_null') {
      return '-null';
    } else if (clause.operator === 'duration') {
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
