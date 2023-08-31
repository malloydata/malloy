# Malloy Syntax Highlighting

Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy currently supports BigQuery and Postgres, as well as querying Parquet and CSV files via DuckDB. 

Currently, two other dialects of Malloy are supported in addition to the standard syntax used in `.malloy` files: the Malloy notebook format (`.malloynb`) and Malloy SQL (`.malloysql`). Ensuring the visual and semantic accuracy of the syntax highlighting provided by each dialects' TextMate grammars was previously done through manual verification alone and often caused syncing issues between Malloy packages that each maintained their own copy of these grammars. Thus, this package can be pulled into only the Malloy repos that need it and includes a test runner to verify the semantic and visual accuracy of syntax highlighting provided by our TextMate grammars. Additionally, the need to maintain a Monarch grammar for Malloy has necessitated the inclusion of a both a script to generate Monarch grammars from ground truth TextMate grammars as well as infrastructure to test all Monarch grammars for parity with their TextMate counterparts. 

## Generating a ground-truth tokenization artififact

This pakcage uses the term tokenization(s) to refer to a ground-truth artifact containing information about the scope names (ex. constant.numeric.date, keyword.control.select) and the color data (hex string color represenation) applied to certain patterns in user-defined blocks of text. See `grammars/malloy/malloyTestInput` for an example of these user-defined blocks. Each inner array represents a block of lines to tokenize and highlight, and we would like these blocks to exhaust the constructs that our language supports through definitions that at least somewhat resemble valid user-written Malloy code. See `grammars/malloy/tokenizations/darkPlus.ts` for an example of a tokenization artifact. Each tokenization artifiact also identifies the indices where new scope names or new colors begin in the test input.

Since TextMate grammars are used to provide syntax highlighting for Malloy dialects in VSCode and Monarch grammars do the same for the Monaco editor, both of which are Microsoft products with builtin theme support, color data from these testes dependens on VSCode themes to map many scope names to one color. While the notion of themes is far broader than what VSCode has championed, many code editors go out of their way to support custom theming and even pull in existing VSCode themes due to their ubiquity. This package allows us to run TextMate tests against the VSCode Dark Plus (Dark+) and Light Plus (Light+) themes, which are two of the richest, most ubiquitous themes offered by VSCode. Read more about sourcing these themes in `themes/THEMES.md`.

Another motivator for tracking color data is ensuring parity between our two current grammar formats, which is impossible to do using scope names alone because TextMate applies many scope names to patterns while Monaco only applies one per pattern. The task of knowing which TextMate scope name will actually be selected to style text matching these patterns is determined entirely by the theme that the editor is using, which also provides access to color data. Besides,the ultimate goal is to ensure that users see the same colors across environments, so what better way to do this than by inspecting colors programatically?

To create a ground truth tokenization artifact, you can use `scripts/generateLanguageTokenizationFile.ts` and change the config object passed into the `generateTokenizationFile(...)` function. An example config object can be found at `test/config/textmate/malloyDarkPlusConfig.ts`. Note that we can only generate tokenization artifacts from TextMate grammars at the moment since most other syntax highlighters are downstream from these ones. To run an example of generating an artifact, use:

```
npm run gen-malloy-tokens
```

## Testing TextMate grammars

This package's TextMate tokenization tests verify both the scope names (ex. constant.numeric.date, keyword.control.select) applied to patterns and the foreground text color applied by those styles.

TextMate tests are written in TypeScript and Jasmine, making use of ts-node to run the Jasmine binary on files with the suffix `.spec.ts` per the `jasmine.json` configuration. `grammars/malloy/malloy.spec.ts` provides an example test for the Malloy grammar using the Dark+ theme, including the config object for the test which can be found in `test/config/textmate/malloyDarkPlusConfig.ts`. You'll notice that this is the same config that is used to generate tokenizations artifacts above.

 To run all TextMate tests, use:

 ```
 npm run test-textmate-grammars
```

## Testing Monarch grammars

This package's Monarch tokenization tests verify parity between the foreground text color of lines highlighted using the TextMate grammar and its corresponding Monarch grammar.

Monarch tests are written in TypeScript and Jasmine with the file suffix `.test.ts` and run in the browser to use the `monaco-editor` package's API, hence the use of Karma with the configuration in `karma.conf.js`. `grammars/malloy/malloy.test.ts` provides an example test for the Malloy grammar using the Dark+ theme, including the config object for the test which can be found in `test/config/monaco/malloyDarkPlusConfig.ts`.

To run all Monarch tests, use:

```
npm run test-monarch-grammars
```

This command uses an `es6` TypeScript compilation target to generate JavaScript files in a temporary dist/ folder that are compatible with Karma's mechanisms for ES6 module support. The Karma tests will then be launched in Chrome: if Karma reports a failure in Chrome, you may need to refresh the page. Note that the dist/ folder is deleted before every run of `tsc` so you need not worry about Karma serving files that are out-of-date.

## Generating a Monarch grammar

In `scripts/generateMonarchGrammar.ts`, you will find a script that generates a Monarch syntax highlighting grammar from a TextMate grammar. In `package.json` you will find a script definition `gen-malloy-monarch` that runs this script for the Malloy TextMate grammar. The script's first command line argument is the input file to parse the TextMate specification from and the second commadn line argument is the output file to write the Monarch definition to.

To visually inspect how well the script works out of box, run:

```
npm run gen-malloy-monarch
``` 

Then, copy the Monarch object that is exported in the output file to the [Monarch playground](https://microsoft.github.io/monaco-editor/monarch.html).

### Known limitations

**The TextMate grammar**

The TextMate grammar must:
- continue to define all repository keys in kebab case or you may switch to snake case
- have unique values for the name field on begin/end rules
- supply regex match strings that, barring a top-level (?i) flag, are semantically identical, valid regex in JS (TextMate uses Oniguruma regex while Monarch requires standard JS regex)
- supply regex that contain exactly as many top-level capture groups as there could be captures (required by Monarch specification)
- use (?:), which has the same meaning in both regex dialects, to prevent capturing inner regex groups when multiple outer groups need to receieve different styling (required by the Monarch specification)

**Mapping many tokens to one**

While TextMate support multiple token classes per pattern via begin/end, caputres, and name fields,
Monarch only support one token class per pattern. This script takes a specificity-first approach to
mapping many tokens to one. That is:

*For begin/end rules:*

1. If beginCaptures and/or endCaptures are defined, they will be be applied to begin and end patterns.
2. If one or both of beginCaptures/endCaptures are undefined, capture will be applied to begin and end patterns.
3. If the captures field is udefined, the name field will be used to style both the begin/end patterns. In the same fashion as TextMate, every pattern in between a begin/end rule uses the name field.

*For match rules:*
1. If the captures field is defined, the capture field will be applied to the match pattern.
2. If the captures field is undefined, the name field will be applied to the match pattern.

**Embedding levels**

Only one level of language embedding is currently supported. In future versions that support more than one embedding level, the grammars we defined will always need to be one nesting level away from themselves. This is due to the fact that the Monarch API does not support grammar self-references like TextMate does, which only allows us to pop the current grammar (ex. Malloy) from the language stack within its definition (ex. the Malloy definition).

For example, the script could support an embedding structure like:
```
malloysql
  └── malloy
  └── sql
```
or
```
malloy
  └── sql
      └── malloy
             └── sql
```
but not
```
malloy
  └── sql
      └── markdown
               └── malloy
```
