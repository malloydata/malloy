import {
  getAutocompleteSuggestions,
  MalloyData,
} from '../completions/malloy-completions';

describe('completions', () => {
  beforeAll(() => {});

  /**
   * Tests for the `malloyStatement` grammar rule. Whenever the cursor position is
   * outside of any malloyStatement, these are the recommendations.
   * defineSourceStatement | defineQuery | importStatement | runStatement | docAnnotations | ignoredObjectAnnotations | experimentalStatementForTesting
   * tokens: SOURCE, QUERY, IMPORT, RUN,
   * plus: ANNOTATION (#) or  DOC_ANNOTATION (##)
   */
  describe('malloyStatement', () => {
    test('blank file', () => {
      const completions = getAutocompleteSuggestions('', {
        line: 1,
        character: 1,
      });

      expect(completions.map(c => c.text)).toEqual([
        'source',
        'import',
        'query',
        'run',
        '#',
        '##',
      ]);
    });
  });

  describe('source extend', () => {
    describe('order_by', () => {
      test('', () => {
        const malloyData: MalloyData = {schemas: {}};
      });
    });
  });

  // The available tags are not actually defined in the Malloy langauge grammar,
  // but a useful auto-complete tool should provide common options
  describe('tags', () => {
    test('Basic tag options', () => {
      const completions = getAutocompleteSuggestions('#', {
        line: 1,
        character: 1,
      });

      // This is a list of the literals defined in 'data_styles.ts'
      expect(completions.map(c => c.text)).toEqual([
        'table',
        'dashboard',
        'text',
        'currency',
        'image',
        'time',
        'json',
        'single_value',
        'list',
        'list_detail',
        'cartesian_chart',
        'bar_chart',
        'scatter_chart',
        'line_chart',
        'point_map',
        'segment_map',
        'shape_map',
        'number',
        'percent',
        'boolean',
        'sparkline',
        'bytes',
        'url',
        'vega',
      ]);
    });
  });
});
