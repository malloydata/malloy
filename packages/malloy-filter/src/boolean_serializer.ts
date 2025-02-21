import {BooleanClause, Clause} from './clause_types';
import {BaseSerializer} from './base_serializer';

export class BooleanSerializer extends BaseSerializer {
  constructor(clauses: Clause[]) {
    super(clauses);
  }

  public serialize(): string {
    const result = BooleanSerializer.clauseToString(this.clauses);
    return result.trim().replace(/,$/, '');
  }

  private static booleanClauseToString(clause: BooleanClause): string {
    return clause.operator === 'NOTNULL' ? '-NULL' : clause.operator;
  }

  private static clauseToString(clauses: Clause[]): string {
    let result = '';
    for (const clause of clauses) {
      if ('operator' in clause) {
        result += BooleanSerializer.booleanClauseToString(
          clause as BooleanClause
        );
      } else {
        throw new Error('Invalid boolean clause ' + JSON.stringify(clause));
      }
      result += ', ';
    }
    return result;
  }
}
