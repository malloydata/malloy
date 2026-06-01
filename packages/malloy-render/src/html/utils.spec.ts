/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {getColorScale} from './utils';

describe('getColorScale', () => {
  test('returns undefined when type is undefined', () => {
    expect(getColorScale(undefined, false)).toBeUndefined();
  });

  describe('without explicitTheme.mapColor', () => {
    test('ordinal non-rect uses the default blue gradient', () => {
      expect(getColorScale('ordinal', false)).toEqual({
        range: ['#C2D5EE', '#1A73E8'],
      });
    });

    test('ordinal rect-mark uses the default blue gradient (not the heatmap scheme)', () => {
      expect(getColorScale('ordinal', true)).toEqual({
        range: ['#C2D5EE', '#1A73E8'],
      });
    });

    test('quantitative non-rect uses the default blue gradient', () => {
      expect(getColorScale('quantitative', false)).toEqual({
        range: ['#C2D5EE', '#1A73E8'],
      });
    });

    test('quantitative rect-mark heatmap returns the orange/blue scheme', () => {
      expect(getColorScale('quantitative', true)).toEqual({
        range: ['#1A73E8', '#E8710A'],
      });
    });

    test('quantitative rect-mark heatmap with overlapping text returns the soft scheme', () => {
      expect(getColorScale('quantitative', true, true)).toEqual({
        range: ['#6BA4EE', '#EEA361'],
      });
    });

    test('temporal non-rect uses the default blue gradient', () => {
      expect(getColorScale('temporal', false)).toEqual({
        range: ['#C2D5EE', '#1A73E8'],
      });
    });

    test('temporal rect-mark uses the heatmap scheme', () => {
      expect(getColorScale('temporal', true)).toEqual({
        range: ['#1A73E8', '#E8710A'],
      });
    });

    test('nominal returns the 8-colour categorical palette', () => {
      const scale = getColorScale('nominal', false);
      expect(scale?.range).toHaveLength(8);
      expect(scale?.range[0]).toBe('#1A73E8');
    });
  });

  describe('with explicitTheme.mapColor (saturated)', () => {
    const theme = {mapColor: '#ff0000'};

    test('ordinal non-rect emits a 2-stop gradient ending in mapColor', () => {
      expect(getColorScale('ordinal', false, false, theme)).toEqual({
        range: ['#f5f5f5', '#ff0000'],
      });
    });

    test('quantitative non-rect emits a 2-stop gradient ending in mapColor', () => {
      expect(getColorScale('quantitative', false, false, theme)).toEqual({
        range: ['#f5f5f5', '#ff0000'],
      });
    });

    test('temporal non-rect emits a 2-stop gradient ending in mapColor', () => {
      expect(getColorScale('temporal', false, false, theme)).toEqual({
        range: ['#f5f5f5', '#ff0000'],
      });
    });

    test('ordinal rect-mark keeps the default ordinal range (mapColor ignored)', () => {
      // Heatmaps shouldn't pick up the choropleth gradient even when the
      // operator has a brand mapColor set, otherwise an ordinal heatmap
      // tile would render as a 2-stop gradient instead of its tuned scheme.
      expect(getColorScale('ordinal', true, false, theme)).toEqual({
        range: ['#C2D5EE', '#1A73E8'],
      });
    });

    test('quantitative rect-mark heatmap keeps the orange/blue scheme', () => {
      expect(getColorScale('quantitative', true, false, theme)).toEqual({
        range: ['#1A73E8', '#E8710A'],
      });
    });

    test('temporal rect-mark heatmap keeps the orange/blue scheme', () => {
      expect(getColorScale('temporal', true, false, theme)).toEqual({
        range: ['#1A73E8', '#E8710A'],
      });
    });

    test('nominal scales ignore mapColor entirely', () => {
      const scale = getColorScale('nominal', false, false, theme);
      expect(scale?.range).toHaveLength(8);
      expect(scale?.range).not.toContain('#ff0000');
    });
  });

  describe('with explicitTheme.mapColor (light / pastel)', () => {
    test('quantitative non-rect pairs a light mapColor with a dark neutral low for contrast', () => {
      // Plain `#f5f5f5` low against a near-white mapColor would produce
      // a near-monochrome gradient. The renderer picks a dark neutral
      // when mapColor luminance is high so the gradient stays readable.
      const scale = getColorScale('quantitative', false, false, {
        mapColor: '#e0eaff',
      });
      expect(scale?.range[0]).toBe('#3a3a3a');
      expect(scale?.range[1]).toBe('#e0eaff');
    });
  });

  describe('with malformed mapColor', () => {
    test('falls back to the default low when mapColor does not parse as hex', () => {
      // A non-hex value (e.g. `var(--my-colour)` or `rgb(...)`) is
      // passed through to Vega as-is, but luminance-based low picking
      // can't reason about it; the default light neutral is used.
      const scale = getColorScale('quantitative', false, false, {
        mapColor: 'var(--my-brand-colour)',
      });
      expect(scale?.range).toEqual(['#f5f5f5', 'var(--my-brand-colour)']);
    });
  });

  describe('with empty-string mapColor', () => {
    test('treats an empty mapColor as unset and uses the default gradient', () => {
      // An empty string is falsy, so it falls through the mapColor check
      // rather than producing a one-stop or malformed gradient.
      expect(
        getColorScale('quantitative', false, false, {mapColor: ''})
      ).toEqual({range: ['#C2D5EE', '#1A73E8']});
    });
  });
});
