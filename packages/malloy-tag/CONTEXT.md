# Malloy Tag Language (MOTLY)

MOTLY is the payload language for Malloy annotations whose route is MOTLY-shaped
(the empty route `# tag`, the compiler-flag route `##! flag`, etc.). The
language spec and parser live at
[github.com/malloydata/motly](https://github.com/malloydata/motly). This
package wraps the parser with type-safe accessors via a `Tag` class.

Malloy annotations are *just text* — MOTLY is one possible payload format, used
where it's claimed. Routes that aren't MOTLY-shaped (e.g. `#" markdown`) pass
their payload through some other parser.

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

Annotations have a **prefix** (everything from `#`/`##` up to the first
whitespace) that resolves to a **route** — a namespace key. The prefix grammar
(forms, bracket pairs, malformation warnings) is defined in `packages/malloy`
(`src/prefix.ts`); this package just parses MOTLY content once a consumer has
split the prefix off.

Claimed routes:

- **`# tag`** — empty route. Reserved for the Malloy renderer; if you write
  to it, you are talking to the renderer. Other apps should claim their own
  route.
- **`##! flag`** — model-level compiler flag (route `!`, internal sigil).
- **`#@ persist`** — persistence directive (route `@`, internal sigil).
- **`#" markdown`** — doc string (route `"`, payload is markdown, not MOTLY).
- **`#(appName) ...`** — app route. Bracket forms `() <> [] {}` are
  equivalent (`#(docs)` ≡ `#<docs>`). This is how a new app stakes a
  namespace.

## Reading tags from a compiled model

Tag reading lives in `packages/malloy`. From a `Taggable` core entity, use
the `annotations` view to filter by route and parse as MOTLY:

```typescript
field.annotations.parseAsTag()        // empty route (renderer tags)
field.annotations.parseAsTag('docs')  // route `docs`
field.annotations.forRoute('vite')    // raw text + offsets, BYO parser
```

The old `tagParse({prefix: /^#@ /})` / `getTaglines(/.../)` RegExp surface is
deprecated — it can't see block annotations and has no content offsets.

## Tag API

```typescript
import {Tag} from '@malloydata/malloy-tag';

const {tag, log} = Tag.parse('enabled=@true port=8080 name="My App"');

tag.toObject();             // { enabled: true, port: 8080, name: "My App" }

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
tag.tag('server');          // returns a nested Tag
```
