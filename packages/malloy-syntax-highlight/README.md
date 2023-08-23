# Malloy

Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy currently supports BigQuery and Postgres, as well as querying Parquet and CSV files via DuckDB.

## This package

 /*
 *
 * A script to generate the Monarch syntax highlighting grammar
 * from the TextMate grammar
 *
 * TODO: Add current limitations to a README.md
 *
 * A script to generate the Monarch syntax highlighting grammar
 * from the TextMate grammar
 *
 * TODO: Add current limitations to a README.md
 *
 * Current limitations:
 * 1. The TextMate grammar must
 *     - be written in TextMate 1.5.x
 *     - define all repository keys in snake case (current version only supports snake, but kebab is maintaiable too)
 *     - supply regex match strings that, barring a top-level (?i) flag, are semantically identical, valid regex in JS
 *     - supply regex that contain exactly as many top-level capture groups as there could be captures (Monarch requirement)
 *     - use (?:) to prevent capturing inner regex groups, which is the same in both regex dialects (Monarch requirement)
 *     - have unique values for the name field on begin/end rules
 * 2. While TextMate support multiple token classes per pattern via begin/end, caputres, and name fields,
 *     Monarch only support one token class per pattern. This script takes a specificity-first approach to
 *     mapping many tokens to one. That is:
 *        a. Begin and end tokens will be always applied to begin and end patterns first
 *        b. If no begin/end tokens are defined, the captures field will be used to highlight begin and end patterns
 *        c. If no captures tokens are provided, the name field will be used to style both the begin/end patterns and everything in between
 *            (In begin/end rules, the name is applied to everything between begin/end by default, but in non-begin/end rules,
 *             the captures field overrides the provided name)
 * 3. Only one level of language embedding is currently supported. In future versions, each
 *     Malloy context will always need to be one nesting level away from another Malloy
 *     context. This is driven by the absence of grammar self-references in Monarch that
 *     only allow us to pop the current Malloy context, not push a new one.
 *
 */
 * Current limitations:
 * 1. The TextMate grammar must
 *     - be written in TextMate 1.5.x
 *     - define all repository keys in snake case (current version only supports snake, but kebab is maintaiable too)
 *     - supply regex match strings that, barring a top-level (?i) flag, are semantically identical, valid regex in JS
 *     - supply regex that contain exactly as many top-level capture groups as there could be captures (Monarch requirement)
 *     - use (?:) to prevent capturing inner regex groups, which is the same in both regex dialects (Monarch requirement)
 *     - have unique values for the name field on begin/end rules
 * 2. While TextMate support multiple token classes per pattern via begin/end, caputres, and name fields,
 *     Monarch only support one token class per pattern. This script takes a specificity-first approach to
 *     mapping many tokens to one. That is:
 *        a. Begin and end tokens will be always applied to begin and end patterns first
 *        b. If no begin/end tokens are defined, the captures field will be used to highlight begin and end patterns
 *        c. If no captures tokens are provided, the name field will be used to style both the begin/end patterns and everything in between
 *            (In begin/end rules, the name is applied to everything between begin/end by default, but in non-begin/end rules,
 *             the captures field overrides the provided name)
 * 3. Only one level of language embedding is currently supported. In future versions, each
 *     Malloy context will always need to be one nesting level away from another Malloy
 *     context. This is driven by the absence of grammar self-references in Monarch that
 *     only allow us to pop the current Malloy context, not push a new one.
 *
 */
 
 See [here](https://github.com/malloydata/malloy/blob/main/packages/malloy/README.md) for additional information.
