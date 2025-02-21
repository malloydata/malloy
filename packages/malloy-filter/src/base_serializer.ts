import {Clause} from './clause_types';

export abstract class BaseSerializer {
  constructor(protected clauses: Clause[]) {
    this.clauses = clauses;
  }

  public abstract serialize(): string;
}
