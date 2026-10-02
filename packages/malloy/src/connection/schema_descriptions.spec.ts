/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Annotations} from '../api/foundation/annotation';
import {
  SCHEMA_DESCRIPTION_URL,
  includeDescriptionsProperty,
  schemaDescriptionAnnotations,
} from './schema_descriptions';

describe('schemaDescriptionAnnotations', () => {
  it('makes a single-line description a doc string', () => {
    const annotations = schemaDescriptionAnnotations('Customer identifier.');
    expect(annotations?.notes?.map(n => n.text)).toEqual([
      '#" Customer identifier.\n',
    ]);
  });

  it('reads back on the doc string route, as a written `#"` would', () => {
    const notes = new Annotations(
      schemaDescriptionAnnotations('Customer identifier.')
    ).forRoute('"');
    expect(notes.map(n => n.content.trim())).toEqual(['Customer identifier.']);
  });

  it('keeps the line breaks of a multi-line description in a block', () => {
    const annotations = schemaDescriptionAnnotations(
      'First line.\r\nSecond line.\n'
    );
    expect(annotations?.notes?.map(n => n.text)).toEqual([
      '#|"\nFirst line.\nSecond line.',
    ]);
    const notes = new Annotations(annotations).forRoute('"');
    expect(notes.map(n => n.content)).toEqual(['First line.\nSecond line.']);
  });

  it('marks the note as coming from the database, not from a model', () => {
    const annotations = schemaDescriptionAnnotations('Doc.');
    expect(annotations?.notes?.[0].at.url).toBe(SCHEMA_DESCRIPTION_URL);
  });

  it.each([undefined, null, '', '   \n '])(
    'returns nothing for a missing or blank description (%p)',
    description => {
      expect(schemaDescriptionAnnotations(description)).toBeUndefined();
    }
  );
});

describe('includeDescriptionsProperty', () => {
  it('is an optional boolean, so connections are unchanged unless they opt in', () => {
    expect(includeDescriptionsProperty).toMatchObject({
      name: 'includeDescriptions',
      type: 'boolean',
      optional: true,
    });
    expect(includeDescriptionsProperty.default).toBeUndefined();
  });
});
