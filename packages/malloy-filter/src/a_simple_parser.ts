import { FilterParser } from './filter_parser'

function aSimpleParser() {
    let str = 'CAT,DOG';
    let response = new FilterParser(str, 'string').parse();
    console.log(str, '\n', ...response.clauses, '\n');

    str = '-5.5, 10, 2.3e7';
    response = new FilterParser(str, 'number').parse();
    console.log(str, '\n', ...response.clauses, '\n');

    str = 'null, false';
    response = new FilterParser(str, 'boolean').parse();
    console.log(str, '\n', ...response.clauses, '\n');

    str = 'after 2025-10-05';
    response = new FilterParser(str, 'date').parse();
    console.log(str, '\n', ...response.clauses, '\n');
}

aSimpleParser();