/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

{{
  // Helper to parse escape sequences in strings
  // Handles: \b \f \n \r \t \uXXXX and passthrough for other escapes
  function parseEscapes(str) {
    return str.replace(/\\(u[0-9A-Fa-f]{4}|.)/g, (match, capture) => {
      if (capture.startsWith('u') && capture.length === 5) {
        return String.fromCharCode(parseInt(capture.slice(1), 16));
      }
      switch (capture) {
        case 'b': return '\b';
        case 'f': return '\f';
        case 'n': return '\n';
        case 'r': return '\r';
        case 't': return '\t';
        default: return capture;
      }
    });
  }
}}

// Entry point - supports multi-line input
tagLine = specs:(_ @tagSpec)* _ { return specs; }

// Line comment: # to end of line
comment = "#" [^\r\n]* ("\r\n" / "\r" / "\n" / !.)

tagSpec
  = tagEq
  / tagReplaceProperties
  / tagUpdateProperties
  / tagEmpty
  / tagDef

// name = value { properties }  or  name = value { ... }
tagEq
  = path:propName _ "=" _ value:eqValue props:(_ properties)? {
      const result = {
        kind: 'setEq',
        path,
        value
      };
      if (props) {
        if (props[1].dotty) {
          result.preserveProperties = true;
        } else {
          result.properties = props[1].statements;
        }
      }
      return result;
    }

// name = { properties }  or  name = ... { properties }  or  name: { properties }
tagReplaceProperties
  = path:propName _ "=" _ dotty:"..."? _ props:properties {
      return {
        kind: 'replaceProperties',
        path,
        properties: props.statements,
        preserveValue: dotty !== null
      };
    }
  / path:propName _ ":" _ props:properties {
      return {
        kind: 'replaceProperties',
        path,
        properties: props.statements,
        preserveValue: false
      };
    }

// name { properties }
tagUpdateProperties
  = path:propName _ props:properties {
      return {
        kind: 'updateProperties',
        path,
        properties: props.statements
      };
    }

// name  or  -name
tagDef
  = deleted:"-"? path:propName {
      return {
        kind: 'define',
        path,
        deleted: deleted !== null
      };
    }

// -...
tagEmpty
  = "-..." { return { kind: 'clearAll' }; }

// Property path: a.b.c
propName
  = head:identifier tail:("." @identifier)* {
      return [head, ...tail];
    }

// Values that can be assigned with =
eqValue
  = arrayValue
  / stringValue

stringValue
  = s:string { return { kind: 'string', value: s }; }

// Array: [element, element, ...]
arrayValue
  = "[" _ "]" { return { kind: 'array', elements: [] }; }
  / "[" _ head:arrayElement tail:(_ "," _ @arrayElement)* _ ","? _ "]" {
      return { kind: 'array', elements: [head, ...tail] };
    }

// Array element: can be value, value with props, just props, or nested array
arrayElement
  = value:string _ props:properties {
      return {
        value: { kind: 'string', value },
        properties: props.statements
      };
    }
  / value:string {
      return { value: { kind: 'string', value } };
    }
  / props:properties {
      return { properties: props.statements };
    }
  / value:arrayValue {
      return { value };
    }

// Properties block: { ... } or { tagSpec* }
properties
  = "{" _ "..." _ "}" { return { dotty: true }; }
  / "{" specs:(_ @tagSpec)* _ "}" { return { dotty: false, statements: specs }; }

// Identifiers for property names
identifier
  = bqString
  / bareString

// String literals
string
  = tripleString
  / sqString
  / dqString
  / numericLiteral
  / bareString

// Bare string: alphanumeric and underscore
bareString
  = chars:$[0-9A-Za-z_\u00C0-\u024F\u1E00-\u1EFF]+ { return chars; }

// Triple-quoted string (multi-line allowed)
tripleString
  = '"""' chars:$([^"\\] / '"' !('""') / "\\" .)* '"""' { return parseEscapes(chars); }

// Single-quoted string (no raw newlines)
sqString
  = "'" chars:$([^'\\\r\n] / "\\" .)* "'" { return parseEscapes(chars); }

// Double-quoted string (no raw newlines)
dqString
  = '"' chars:$([^"\\\r\n] / "\\" .)* '"' { return parseEscapes(chars); }

// Backtick-quoted string (for identifiers with special chars, no raw newlines)
bqString
  = '`' chars:$([^`\\\r\n] / "\\" .)* '`' { return parseEscapes(chars); }

// Numeric literals
numericLiteral
  = $("-"? [0-9]* "." [0-9]+ ([Ee] [+-]? [0-9]+)?)
  / $("-"? [0-9]+ ([Ee] [+-]? [0-9]+)?)

// Whitespace and comments (required between some tokens, optional elsewhere)
_ = ([ \t\r\n] / comment)*
