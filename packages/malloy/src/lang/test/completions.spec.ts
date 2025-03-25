import type {Position} from '@malloydata/malloy-interfaces';
import {computeMalloyCompletions} from '../malloy-completions';

const root_schema = {
  'test_source': ['a', 'b'],
};

function findPositionOf(input: string, char: string): Position | null {
  const lines = input.split('\n');
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    for (let c = 0; c < line.length; c++) {
      if (line[c] === char) {
        // Add 1 to create a 1-based index, which the editor and language both use
        return {line: l + 1, character: c + 1};
      }
    }
  }
  return null;
}

// Test method for fetching completions
const getCompletions = (input: string): string[] => {
  // Technically | is valid syntax in Malloy, but we just won't use that in these tests.
  const position = findPositionOf(input, '|');
  if (!position) {
    return [];
  }
  input = input.replace('|', '');

  return computeMalloyCompletions(input, position, root_schema);
};

describe('completions', () => {

  describe('source schema completions', () => {

  });
  
  it('returns items in the source schema after a where: keyword', () => {
    const text = `
      source: test_source is root_source extend {
        where: |
      }
    `;

    expect(getCompletions(text)).toEqual(['a', 'b']);
  });

  it('returns items in the view after a group_by: keyword', () => {
    const text = `
      source: test_source is root_source extend {

        view: v is {
          group_by: |
        }
      }
    `;

    expect(getCompletions(text)).toEqual(['a', 'b']);
  });

  it('returns items in the query view after an aggregate: keyword', () => {
    const text = `
      source: test_source is root_source extend {}

      run: test_source -> {
        aggregate: |
        group_by: b
      }
    `;

    expect(getCompletions(text)).toEqual(['a', 'b']);
  });
});
