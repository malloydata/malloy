import { Clause } from './clause_types'

export interface FilterError {
    message: string;
    startIndex: number;
    endIndex: number;
}

export interface FilterParserResponse {
    clauses: Clause[];
    errors: FilterError[];
};