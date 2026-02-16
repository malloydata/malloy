# Malloy Tag Language (MOTLY)

Malloy annotations use a configuration language called MOTLY. The MOTLY language specification and parser live in a separate repository (TODO: add link to MOTLY git repository when available).

MOTLY is a concise, readable syntax for adding structured metadata to Malloy objects through annotations. It's designed to work seamlessly with Malloy's annotation system and can also be used as a standalone configuration language.

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

### Typed Values
Values prefixed with `@` are typed:
```malloy
# enabled=@true
# debug=@false
# created=@2024-01-15
# updated=@2024-01-15T10:30:00Z
```

### String Values
```malloy
# color=blue
# name="User Name"
# description="""
Multi-line string
with preserved newlines.
"""
```
Unquoted strings for simple values (alphanumeric and underscore), quoted strings for values with spaces or special characters, triple-quoted for multi-line.

### Numeric Values
```malloy
# size=10
# width=100.5
# rate=-0.05
```
Numbers are automatically parsed as numeric types.

### Arrays
```malloy
# colors=[red, green, blue]
# ports=[80, 443, 8080]
# users=[{ name=alice role=admin }, { name=bob role=user }]
```

### Nested Properties
```malloy
# box: { width=100 height=200 }
```
Colon and curly braces create nested property groups.

### Deep Path Notation
```malloy
# database.connection.pool.max=100
```
Dot notation for setting nested values directly.

### Delete Property
```malloy
# -deprecated_field
```
Minus prefix removes a property.

### Combined Example
```malloy
#(myApp) hidden color=blue size=10 box: { width=100 height=200 } name="Blue Thing"
```

## Colon vs Space Syntax

Two ways to add properties to objects with different semantics:

**Colon syntax (`: { }`) replaces all properties:**
```malloy
# server: { host=localhost port=8080 }
# server: { url="http://example.com" }  # Replaces - only url remains
```

**Space syntax (`{ }`) merges with existing properties:**
```malloy
# server: { host=localhost }
# server { port=8080 }  # Merges - both host and port exist
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
- **MOTLY parser** via the `motly-ts` package
- **Tag class** with methods for type-safe value access
- **Type definitions** for parsed tag structures

### Key API Methods

```typescript
import {Tag} from '@malloydata/malloy-tag';

const {tag, log} = Tag.parse('enabled=@true port=8080 name="My App"');

// Convert to plain JavaScript object
const obj = tag.toObject();  // { enabled: true, port: 8080, name: "My App" }

// Type-safe accessors
tag.text('name');           // "My App"
tag.numeric('port');        // 8080
tag.boolean('enabled');     // true
tag.isTrue('enabled');      // true
tag.date('created');        // Date object
tag.textArray('features');  // string[]
tag.has('name');            // true

// Nested access
tag.text('server', 'host');
tag.tag('server');          // Get nested Tag object
```

## Documentation

For complete MOTLY language syntax and examples, see the MOTLY repository (TODO: add link).

## Important Notes

- Not all annotations use the tag language - raw text is also valid
- The tag language is optional - annotations can be simple strings
- Each application defines its own conventions for tag usage
- Tags are metadata only - they don't affect query execution
