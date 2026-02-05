/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {parseTag} from './peggy';
import {validateTag} from './schema';

describe('schema validation', () => {
  describe('missing required properties', () => {
    test('errors when required property is missing', () => {
      const {tag} = parseTag('');
      const {tag: schema} = parseTag('required: { name=string }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        message: "Missing required property 'name'",
        path: ['name'],
        code: 'missing-required',
      });
    });

    test('errors for multiple missing required properties', () => {
      const {tag} = parseTag('');
      const {tag: schema} = parseTag('required: { name=string age=number }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(2);
      expect(errors.map(e => e.path)).toEqual([['name'], ['age']]);
    });

    test('errors for missing nested required property', () => {
      const {tag} = parseTag('size { width=10 }');
      const {tag: schema} = parseTag(
        'required: { size: { required: { width=number height=number } } }'
      );

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        message: "Missing required property 'height'",
        path: ['size', 'height'],
        code: 'missing-required',
      });
    });
  });

  describe('wrong type errors', () => {
    test('errors when string expected but number provided', () => {
      const {tag} = parseTag('name=42');
      const {tag: schema} = parseTag('required: { name=string }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        message:
          "Property 'name' has wrong type: expected 'string', got 'number'",
        path: ['name'],
        code: 'wrong-type',
      });
    });

    test('errors when number expected but string provided', () => {
      const {tag} = parseTag('age=hello');
      const {tag: schema} = parseTag('required: { age=number }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        message:
          "Property 'age' has wrong type: expected 'number', got 'string'",
        path: ['age'],
        code: 'wrong-type',
      });
    });

    test('errors when boolean expected but string provided', () => {
      const {tag} = parseTag('enabled=yes');
      const {tag: schema} = parseTag('required: { enabled=boolean }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('wrong-type');
      expect(errors[0].message).toContain("expected 'boolean'");
    });

    test('errors when date expected but string provided', () => {
      const {tag} = parseTag('created=yesterday');
      const {tag: schema} = parseTag('required: { created=date }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('wrong-type');
      expect(errors[0].message).toContain("expected 'date'");
    });

    test('errors when tag expected but scalar provided', () => {
      const {tag} = parseTag('config=value');
      const {tag: schema} = parseTag('required: { config=tag }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('wrong-type');
      expect(errors[0].message).toContain("expected 'tag'");
    });

    test('validates tag type correctly', () => {
      const {tag} = parseTag('config { a=1 b=2 }');
      const {tag: schema} = parseTag('required: { config=tag }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });
  });

  describe('unknown property errors', () => {
    test('errors on unknown property', () => {
      const {tag} = parseTag('name=alice unknown=value');
      const {tag: schema} = parseTag('required: { name=string }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        message: "Unknown property 'unknown'",
        path: ['unknown'],
        code: 'unknown-property',
      });
    });

    test('allows unknown properties with allowUnknown=@true', () => {
      const {tag} = parseTag('name=alice extra=value');
      const {tag: schema} = parseTag(
        'allowUnknown=@true required: { name=string }'
      );

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('errors on unknown nested property', () => {
      const {tag} = parseTag('size { width=10 extra=5 }');
      const {tag: schema} = parseTag(
        'required: { size: { required: { width=number } } }'
      );

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        message: "Unknown property 'extra'",
        path: ['size', 'extra'],
        code: 'unknown-property',
      });
    });
  });

  describe('valid tags pass validation', () => {
    test('valid tag with required properties', () => {
      const {tag} = parseTag('name=alice age=30');
      const {tag: schema} = parseTag('required: { name=string age=number }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('valid tag with optional properties', () => {
      const {tag} = parseTag('name=alice');
      const {tag: schema} = parseTag(
        'required: { name=string } optional: { age=number }'
      );

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('valid tag with optional property present', () => {
      const {tag} = parseTag('name=alice age=30');
      const {tag: schema} = parseTag(
        'required: { name=string } optional: { age=number }'
      );

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('valid nested properties', () => {
      const {tag} = parseTag('size { width=100 height=200 }');
      const {tag: schema} = parseTag(
        'required: { size: { required: { width=number height=number } } }'
      );

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });
  });

  describe('array type validation', () => {
    test('validates string[] type', () => {
      const {tag} = parseTag('colors=[red, green, blue]');
      const {tag: schema} = parseTag('required: { colors="string[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('errors when string[] expected but number[] provided', () => {
      const {tag} = parseTag('values=[1, 2, 3]');
      const {tag: schema} = parseTag('required: { values="string[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('wrong-type');
      expect(errors[0].message).toContain("expected 'string[]'");
      expect(errors[0].message).toContain("got 'number[]'");
    });

    test('validates number[] type', () => {
      const {tag} = parseTag('counts=[1, 2, 3]');
      const {tag: schema} = parseTag('required: { counts="number[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('validates boolean[] type', () => {
      const {tag} = parseTag('flags=[@true, @false, @true]');
      const {tag: schema} = parseTag('required: { flags="boolean[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('validates date[] type', () => {
      const {tag} = parseTag('dates=[@2024-01-01, @2024-02-01]');
      const {tag: schema} = parseTag('required: { dates="date[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('any[] accepts any array', () => {
      const {tag} = parseTag('items=[1, 2, 3]');
      const {tag: schema} = parseTag('required: { items="any[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('errors when array expected but scalar provided', () => {
      const {tag} = parseTag('colors=red');
      const {tag: schema} = parseTag('required: { colors="string[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('wrong-type');
    });

    test('empty array matches any array type', () => {
      const {tag} = parseTag('items=[]');
      const {tag: schema} = parseTag('required: { items="string[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });
  });

  describe('any type validation', () => {
    test('any accepts string', () => {
      const {tag} = parseTag('value=hello');
      const {tag: schema} = parseTag('required: { value=any }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('any accepts number', () => {
      const {tag} = parseTag('value=42');
      const {tag: schema} = parseTag('required: { value=any }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('any accepts boolean', () => {
      const {tag} = parseTag('value=@true');
      const {tag: schema} = parseTag('required: { value=any }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('any accepts date', () => {
      const {tag} = parseTag('value=@2024-01-15');
      const {tag: schema} = parseTag('required: { value=any }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('any accepts tag', () => {
      const {tag} = parseTag('value { a=1 }');
      const {tag: schema} = parseTag('required: { value=any }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('any accepts array', () => {
      const {tag} = parseTag('value=[1, 2, 3]');
      const {tag: schema} = parseTag('required: { value=any }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });
  });

  describe('full form type syntax', () => {
    test('validates with type in full form', () => {
      const {tag} = parseTag('name=alice');
      const {tag: schema} = parseTag('required: { name: { type=string } }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('validates nested with full form', () => {
      const {tag} = parseTag('person { name=alice age=30 }');
      const {tag: schema} = parseTag(`
        required: {
          person: {
            type=tag
            required: {
              name=string
              age=number
            }
          }
        }
      `);

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('errors on type mismatch with full form', () => {
      const {tag} = parseTag('name=42');
      const {tag: schema} = parseTag('required: { name: { type=string } }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('wrong-type');
    });
  });

  describe('optional property type validation', () => {
    test('validates type of optional property when present', () => {
      const {tag} = parseTag('name=alice age=notanumber');
      const {tag: schema} = parseTag(
        'required: { name=string } optional: { age=number }'
      );

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        message:
          "Property 'age' has wrong type: expected 'number', got 'string'",
        path: ['age'],
        code: 'wrong-type',
      });
    });
  });

  describe('complex schemas', () => {
    test('validates complex nested schema', () => {
      const {tag} = parseTag(`
        config {
          database {
            host=localhost
            port=5432
          }
          features {
            enabled=@true
            flags=[@true, @false]
          }
        }
      `);
      const {tag: schema} = parseTag(`
        required: {
          config: {
            required: {
              database: {
                required: {
                  host=string
                  port=number
                }
              }
              features: {
                required: {
                  enabled=boolean
                }
                optional: {
                  flags="boolean[]"
                }
              }
            }
          }
        }
      `);

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('collects multiple errors from complex schema', () => {
      const {tag} = parseTag(`
        config {
          database {
            host=123
          }
          extra=bad
        }
      `);
      const {tag: schema} = parseTag(`
        required: {
          config: {
            required: {
              database: {
                required: {
                  host=string
                  port=number
                }
              }
            }
          }
        }
      `);

      const errors = validateTag(tag, schema);

      // Should have: wrong type for host, missing port, unknown extra
      expect(errors.length).toBeGreaterThanOrEqual(3);
      expect(errors.map(e => e.code)).toContain('wrong-type');
      expect(errors.map(e => e.code)).toContain('missing-required');
      expect(errors.map(e => e.code)).toContain('unknown-property');
    });
  });

  describe('edge cases', () => {
    test('empty tag against schema with only optional properties', () => {
      const {tag} = parseTag('');
      const {tag: schema} = parseTag('optional: { name=string }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('empty schema passes any tag', () => {
      const {tag} = parseTag('anything=goes here=too');
      const {tag: schema} = parseTag('');

      const errors = validateTag(tag, schema);

      // Unknown properties should error even with empty schema
      expect(errors).toHaveLength(2);
    });

    test('empty schema with allowUnknown passes any tag', () => {
      const {tag} = parseTag('anything=goes here=too');
      const {tag: schema} = parseTag('allowUnknown=@true');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('property with no type in schema allows any value', () => {
      const {tag} = parseTag('name=42');
      const {tag: schema} = parseTag('required: { name }');

      const errors = validateTag(tag, schema);

      // No type specified, so any value is OK
      expect(errors).toHaveLength(0);
    });

    test('mixed array reports as mixed type', () => {
      const {tag} = parseTag('items=[1, hello, @true]');
      const {tag: schema} = parseTag('required: { items="string[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('wrong-type');
      expect(errors[0].message).toContain("got 'mixed[]'");
    });

    test('any[] accepts mixed arrays', () => {
      const {tag} = parseTag('items=[1, hello, @true]');
      const {tag: schema} = parseTag('required: { items="any[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('value with properties validates only value type', () => {
      const {tag} = parseTag('name=alice { extra=1 }');
      const {tag: schema} = parseTag('required: { name=string }');

      const errors = validateTag(tag, schema);

      // Only value type is checked; nested properties aren't validated
      // unless schema has required/optional sections
      expect(errors).toHaveLength(0);
    });

    test('value with properties and nested schema (full form)', () => {
      const {tag} = parseTag('name=alice { extra=1 }');
      const {tag: schema} = parseTag(`
        required: {
          name: {
            type=string
            optional: { extra=number }
          }
        }
      `);

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('value with properties and nested schema (shorthand)', () => {
      const {tag} = parseTag('name=alice { extra=1 }');
      const {tag: schema} = parseTag(`
        required: {
          name=string { optional: { extra=number } }
        }
      `);

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('arrays of objects have tag element type', () => {
      const {tag} = parseTag('items=[{a=1}, {b=2}]');
      const {tag: schema} = parseTag('required: { items="string[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('wrong-type');
      expect(errors[0].message).toContain("got 'tag[]'");
    });

    test('tag[] validates arrays of objects', () => {
      const {tag} = parseTag('items=[{a=1}, {b=2}]');
      const {tag: schema} = parseTag('required: { items="tag[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('tag[] rejects arrays of scalars', () => {
      const {tag} = parseTag('items=[1, 2, 3]');
      const {tag: schema} = parseTag('required: { items="tag[]" }');

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('wrong-type');
      expect(errors[0].message).toContain("expected 'tag[]'");
    });

    test('tag[] with element schema validates each element', () => {
      const {tag} = parseTag(
        'items=[{size=10 color=red}, {size=20 color=blue}]'
      );
      const {tag: schema} = parseTag(
        'required: { items="tag[]" { required: { size=number color=string } } }'
      );

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(0);
    });

    test('tag[] element schema reports errors with index in path', () => {
      const {tag} = parseTag(
        'items=[{size=10 color=red}, {size=bad color=blue}]'
      );
      const {tag: schema} = parseTag(
        'required: { items="tag[]" { required: { size=number color=string } } }'
      );

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('wrong-type');
      expect(errors[0].path).toEqual(['items', '1', 'size']);
    });

    test('tag[] element schema catches missing required', () => {
      const {tag} = parseTag('items=[{size=10}, {color=blue}]');
      const {tag: schema} = parseTag(
        'required: { items="tag[]" { required: { size=number color=string } } }'
      );

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(2);
      expect(errors[0].path).toEqual(['items', '0', 'color']);
      expect(errors[1].path).toEqual(['items', '1', 'size']);
    });

    test('tag[] element schema catches unknown properties', () => {
      const {tag} = parseTag('items=[{size=10 color=red extra=bad}]');
      const {tag: schema} = parseTag(
        'required: { items="tag[]" { required: { size=number color=string } } }'
      );

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('unknown-property');
      expect(errors[0].path).toEqual(['items', '0', 'extra']);
    });

    test('misspelled type in schema reports invalid-schema error', () => {
      const {tag} = parseTag('name=42');
      const {tag: schema} = parseTag('required: { name=stirng }'); // typo

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('invalid-schema');
      expect(errors[0].message).toContain("Invalid type 'stirng'");
    });

    test('invalid type in full form reports invalid-schema error', () => {
      const {tag} = parseTag('name=42');
      const {tag: schema} = parseTag('required: { name: { type=nubmer } }'); // typo

      const errors = validateTag(tag, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('invalid-schema');
      expect(errors[0].message).toContain("Invalid type 'nubmer'");
    });
  });
});
