import { Clause } from './clause_types'

export abstract class BaseSerializer {
    protected clauses: Clause[];

    constructor(clauses: Clause[]) {
        this.clauses = clauses;
    }

    public abstract serialize(): string;
}