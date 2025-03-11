# Filter Languages

There is a unique filter language for each filterable data type. The documentation-bRoKeN-lInK describes the various languages.

# Grammars

`malloy-filter` use [moo](https://github.com/no-context/moo?tab=readme-ov-file) and [nearley](https://nearley.js.org/) to generate parsers for each sub language. The grammars are in `grammars`.

After changing a `.ne` file use `npm run build` to update the generated parser.

# API

Refer to the [clause interfaces](src/filter_clause.ts) for details on the
output of the parser, or look at the parser tests in [`tests/`](tests/) for more examples
of parser output.

```TypeScript
import {StringFilterExpression, StringClause} from '@malloydata/malloy-filter'

// or ...
// NumberFilterExpression, NumberClause
// BooleanFilterExpression, BooleanClause
// TemporalFilterExpression, TemporalClause

// Each has two entry points, "parse" and "unparse"

const stringParse = StringFilterExpression.parse('FOO%,-FOOD')
if (stringParse.parsed) {
    console.log(JSON.stringify(stringParse.parsed, null, 2));
    /*
     * Output will look something like this ...
     * { operator: ',',
     *   members: [
     *     {operator: 'starts', values: ['FOO']}
     *     {operator: '=', not: true, values: ['FOOD']}
     *   ],
     * }
     */
    console.log(StringFilterExpression.unparse(stringParse.parse));
    /*
     * There will be minor variations on unparse, for example in this
     * case there will be space after the comma:
     *
     * FOO%, -FOOD
     */
} else {
    console.log(stringParse.log);
}
```

# Testing

The `malloy-filter` tests use Jest.

```bash
npm run build
npm run test
```