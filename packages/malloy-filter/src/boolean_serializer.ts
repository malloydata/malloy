import {BooleanClause} from './clause_types';

export class BooleanSerializer {
  constructor(private clauses: BooleanClause[]) {
    this.clauses = clauses;
  }

  public serialize(): string {
    const result = BooleanSerializer.clauseToString(this.clauses);
    return result.trim().replace(/,$/, '');
  }

  private static booleanClauseToString(clause: BooleanClause): string {
    switch (clause.operator) {
      case 'NOTNULL':
        return '-NULL';
      case 'FALSEORNULL':
        return 'FALSE';
      case 'FALSE':
        return '=FALSE';
    }
    return clause.operator;
  }

  private static clauseToString(clauses: BooleanClause[]): string {
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
