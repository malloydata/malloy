import { SpecialToken, Tokenizer, TokenizerParams } from './tokenizer'
import { StringCondition, StringOperator, QuoteType } from './clause_types'
import { BaseParser } from './base_parser'
import { FilterParserResponse, FilterError } from './filter_types'

export class StringParser extends BaseParser {
    private static readonly percentRegex: RegExp = /(?<!\\)%/;
    private static readonly underscoreRegex: RegExp = /(?<!\\)_/;
    private static readonly percentStartRegex: RegExp = /^%/;
    private static readonly percentEndRegex: RegExp = /(?<!\\)%$/;
    private static readonly negatedStartRegex: RegExp = /^-(.+)$/;
    private static readonly singleBackslashRegex: RegExp = /(?<!\\)\\(?!\\)/g;

    constructor(input: string) {
        super(input);
    }

    private tokenize(): void {
        const specialSubstrings: SpecialToken[] = [{ type: ',', value: ',' }];
        const specialWords: SpecialToken[] = [
            { type: 'NULL', value: 'null', ignoreCase: true },
            { type: 'EMPTY', value: 'empty', ignoreCase: true },
            { type: 'NOTNULL', value: '-null', ignoreCase: true },
            { type: 'NOTEMPTY', value: '-empty', ignoreCase: true }];
        const params: TokenizerParams =
            { trimWordWhitespace: true, combineAdjacentWords: true, specialSubstrings, specialWords: specialWords };

        const tokenizer = new Tokenizer(this.inputString, params);
        this.tokens = tokenizer.parse();
        this.tokens = Tokenizer.convertSpecialWords(this.tokens, specialWords)
    }

    public parse(): FilterParserResponse {
        this.index = 0;
        this.tokenize();
        let clauses: StringCondition[] = [];
        let errors: FilterError[] = [];
        while (this.index < this.tokens.length) {
            let token = this.getNext();
            if (token.type === ',') {
                this.index++;
            } else if (token.type == 'NULL') {
                clauses.push({ operator: '=', values: [null] });
                this.index++;
            } else if (token.type == 'EMPTY') {
                clauses.push({ operator: 'EMPTY', values: [null] });
                this.index++;
            } else if (token.type == 'NOTNULL') {
                clauses.push({ operator: '!=', values: [null] });
                this.index++;
            } else if (token.type == 'NOTEMPTY') {
                clauses.push({ operator: 'NOTEMPTY', values: [null] });
                this.index++;
            } else if (this.checkSimpleWord(clauses)) {
                this.index++;
            } else {
                errors.push({ message: 'Invalid expression', startIndex: token.startIndex, endIndex: token.endIndex });
                this.index++;
            }
        }
        return { clauses: StringParser.groupClauses(clauses), errors };
    }

    private static findQuotes(str: string): QuoteType[] {
        const quotes: Set<QuoteType> = new Set();
        let i = 0;

        while (i < str.length) {
            // Check for triple quotes first to avoid false positives
            if (str.slice(i, i + 3) === "'''") {
                quotes.add('TRIPLESINGLE');
                i += 3;
            } else if (str.slice(i, i + 3) === '"""') {
                quotes.add('TRIPLEDOUBLE');
                i += 3;
            } else if (str[i] === '\\') {
                // Check for escaped quotes
                if (i + 1 < str.length) {
                    switch (str[i + 1]) {
                        case "'":
                            quotes.add('ESCAPEDSINGLE');
                            break;
                        case '"':
                            quotes.add('ESCAPEDDOUBLE');
                            break;
                        case '`':
                            quotes.add('ESCAPEDBACKTICK');
                            break;
                    }
                    i += 2;
                } else {
                    i++;
                }
            } else {
                // Check for single quotes
                switch (str[i]) {
                    case "'":
                        quotes.add('SINGLE');
                        break;
                    case '"':
                        quotes.add('DOUBLE');
                        break;
                    case '`':
                        quotes.add('BACKTICK');
                        break;
                }
                i++;
            }
        }
        return Array.from(quotes);
    }

    private static groupClauses(clauses: StringCondition[]): StringCondition[] {
        if (clauses.length < 2) {
            return clauses;
        }
        let previous: StringCondition = clauses[0];
        let outputs: StringCondition[] = [previous];
        for (let i = 1; i < clauses.length; i++) {
            if (previous.operator === clauses[i].operator) {
                previous.values.push(...clauses[i].values);
            } else {
                previous = clauses[i];
                outputs.push(previous);
            }
        }
        return outputs;
    }

    private static percentInMiddle(word: string): boolean {
        if (word.length < 3) return false;
        word = word.substring(1, word.length - 1);
        return StringParser.percentRegex.test(word);
    }

    private static removeBackslashes(word: string): string {
        StringParser.singleBackslashRegex.lastIndex = 0;
        return word.replace(StringParser.singleBackslashRegex, (match) => '');
    }

    private checkSimpleWord(clauses: StringCondition[]): boolean {
        let token = this.getNext();
        if (token.type !== 'word') {
            return false;
        }
        const negatedMatch = StringParser.negatedStartRegex.exec(token.value);
        let word = negatedMatch ? negatedMatch[1] : token.value;

        const isPercentStart = StringParser.percentStartRegex.test(word);
        const isPercentEnd = StringParser.percentEndRegex.test(word);
        const isPercentBoth = isPercentStart && isPercentEnd;
        const isUnderscore = StringParser.underscoreRegex.test(word);
        const isPercentMiddle = StringParser.percentInMiddle(word);

        let operator: StringOperator = negatedMatch ? '!=' : '=';
        if (isUnderscore || isPercentMiddle || (isPercentBoth && word.length < 3)) {
            operator = negatedMatch ? '!~' : '~';
        } else if (isPercentBoth && word.length > 2) {
            operator = negatedMatch ? 'notContains' : 'contains';
            word = word.substring(1, word.length - 1);
            word = StringParser.removeBackslashes(word);
        } else if (isPercentStart) {
            operator = negatedMatch ? 'notEnds' : 'ends';
            word = word.substring(1, word.length);
            word = StringParser.removeBackslashes(word);
        } else if (isPercentEnd) {
            operator = negatedMatch ? 'notStarts' : 'starts';
            word = word.substring(0, word.length - 1);
            word = StringParser.removeBackslashes(word);
        } else {  // = or !=
            word = StringParser.removeBackslashes(word);
        }
        if (word.length == 0) {
            return false;
        }

        const clause: StringCondition = { operator: operator, values: [word] };
        //const quotes: QuoteType[] = StringParser.findQuotes(word);
        //if (quotes.length > 0) { clause.quotes = quotes; }
        clauses.push(clause);
        return true;
    }
}
