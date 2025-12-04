# Malloy Tag Language

The Malloy Tag Language is a concise, readable syntax for adding structured metadata to Malloy objects through annotations. It's designed to work seamlessly with Malloy's annotation system.

## Purpose

While Malloy annotations can contain arbitrary text, the Tag Language provides a standardized way to express structured metadata that is:
- Human-readable and writable
- Easy to parse programmatically
- Flexible enough for various use cases
- Concise and unobtrusive in code

## Syntax Overview

The Tag Language supports several data types:

### Boolean Tags
```malloy
# hidden
```
A tag name without a value is a boolean (implicitly `true`).

### String Values
```malloy
# color=blue
# name="User Name"
```
Unquoted strings for simple values, quoted strings for values with spaces or special characters.

### Numeric Values
```malloy
# size=10
# width=100.5
```
Numbers are automatically parsed as numeric types.

### Nested Properties
```malloy
# box { width=100 height=200 }
```
Curly braces create nested property groups.

### Combined Example
```malloy
#(myApp) hidden color=blue size=10 box { width=100 height=200 } name="Blue Thing"
```

## Annotation Prefixes

Different prefixes are used to avoid collision between different uses of annotations:

- **`# `** (hash-space) - Reserved for Malloy renderer
- **`#!`** - Compiler directives
- **`#(docs)`** - Malloy documentation
- **`#(appName) `** - Encouraged pattern for application-specific tags

Example with application prefix:
```malloy
#(myApp) visible theme=dark priority=high
```

## Multi-line Annotations

The tag language works with single-line annotations. For multi-line text that is NOT in the tag language:

```malloy
#" This is a multi-line string annotation
#" which is NOT in the tag language
#" but could be displayed as help text
source: name is VALUE
```

## Usage Pattern

The expected workflow for using tag annotations:

1. **Write annotations** in Malloy code using tag syntax
2. **Query annotations** from compiled model using pattern matching (filter by prefix)
3. **Parse tags** using the malloy-tag package
4. **Extract values** and use in your application

## Implementation

The `malloy-tag` package provides:
- **Parser** for tag language syntax
- **Type definitions** for parsed tag structures
- **Utilities** for working with tags in JavaScript/TypeScript

## Documentation

For complete tag language syntax and examples, see:
https://docs.malloydata.dev/documentation/language/tags

## Important Notes

- Not all annotations use the tag language - raw text is also valid
- The tag language is optional - annotations can be simple strings
- Each application defines its own conventions for tag usage
- Tags are metadata only - they don't affect query execution
