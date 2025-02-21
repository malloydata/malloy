import { StringCondition, StringOperator, Clause } from './clause_types'
import { BaseSerializer } from './base_serializer'

export class StringSerializer extends BaseSerializer {
    constructor(clauses: Clause[]) {
        super(clauses);
    }

    public serialize(): string {
        let result = StringSerializer.clauseToString(this.clauses);
        return result.trim().replace(/,$/, '');
    }

    private static isNegated(operator: StringOperator): boolean {
        return operator === 'NOTEMPTY' || operator === '!~' || operator === '!=' ||
        operator === 'notStarts' || operator === 'notEnds' || operator === 'notContains';
    }

    private static escapeSpecialCharacters(input: string): string {
        return input.replace(/[,\\]/g, (match) => `\\${match}`);
    }

    private static escapeWildcardCharacters(input: string): string {
        return input.replace(/[_%]/g, (match) => `\\${match}`);
    }

    // export type StringOperator = 'EMPTY' | 'NOTEMPTY' | 'starts' | 'ends' | 'contains' | 'notStarts' |
    // 'notEnds' | 'notContains' | '~' | '=' | '!~' | '!=';
    private static stringConditionToString(operator: StringOperator, value: string | null): string {
        if (operator === 'EMPTY') {
            return 'EMPTY';
        } else if (operator === 'NOTEMPTY') {
            return '-EMPTY';
        }

        const negated: boolean = StringSerializer.isNegated(operator);
        if (value === null) {
            return negated ? '-NULL' : 'NULL'; 
        }
        if (value === 'NULL' || value ==='-NULL') {
            return (negated ? '-' : '') + '\\' + value;
        }

        value = StringSerializer.escapeSpecialCharacters(value);
        if (operator === 'starts' || operator === 'notStarts') {
            value = StringSerializer.escapeWildcardCharacters(value);
            return (negated ? '-' : '') + value + '%';
        }
        else if (operator === 'ends' || operator === 'notEnds') {
            value = StringSerializer.escapeWildcardCharacters(value);
            return (negated ? '-' : '') + '%' + value;
        }
        else if (operator === 'contains' || operator === 'notContains') {
            value = StringSerializer.escapeWildcardCharacters(value);
            return (negated ? '-' : '') + '%' + value + '%';
        } else if (operator === '=' || operator === '!=') {
            value = StringSerializer.escapeWildcardCharacters(value);
            return (negated ? '-' : '') + value;
        }
        
        return (negated ? '-' : '') + value;
    }

    private static clauseToString(clauses: Clause[]): string {
        let result = '';
        for (const genericClause of clauses) {
            const clause: StringCondition = genericClause as StringCondition;
            for (const value of clause.values) {
                const word = StringSerializer.stringConditionToString(clause.operator, value);
                if (word) {
                    result += word + ', ';
                }
            }
        }
        return result;
    }
}