# Malloy Syntax Highlighting

Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy currently supports BigQuery and Postgres, as well as querying Parquet and CSV files via DuckDB. 

Currently, two other dialects of Malloy are supported in addition to the standard syntax used in .malloy files: the Malloy notebook format (.malloynb) and Malloy SQL (.malloysql). Ensuring the visual and semantic accuracy of the syntax highlighting provided by each dialects' TextMate grammars was previously done through manual verification alone and often caused syncing issues between Malloy packages that each maintained their own copy of these grammars. Thus, this package can be pulled into only the Malloy repos that need it and includes a test runner to verify the semantic and visual accuracy of syntax highlighting provided by our TextMate grammars. Additionally, the need to maintain a Monarch grammar for Malloy has necessitated the inclusion of a both a script to generate Monarch grammars from ground truth TextMate grammars as well as infrastructure to test all Monarch grammars for parity with their TextMate counterparts. 

## Automatically generating a Monarch grammar

In `scripts/generateMonarchGrammar.ts`, you will find a script that generates a Monarch syntax highlighting grammar from a TextMate grammar. In `package.json` you will find a script definition `gen-malloy-monarch` that runs this script for the Malloy TextMate grammar. The script's first argument is the input file to parse the TextMate specification from and the second argument is the output file to write the Monarch definition to.

To visually inspect how well the script works out of box, run:

`npm run gen-malloy-monarch` 

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
