/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import {VegaJSON} from './vega-types';

const grayMedium = '#727883';
const gridGray = '#E5E7EB';

export const baseSpec = (): VegaJSON => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  config: {
    axisY: {
      gridColor: gridGray,
      tickColor: gridGray,
      domain: false,
      labelFont: 'Inter, sans-serif',
      labelFontSize: 10,
      labelFontWeight: 'normal',
      labelColor: grayMedium,
      labelPadding: 5,
      titleColor: grayMedium,
      titleFont: 'Inter, sans-serif',
      titleFontSize: 12,
      titleFontWeight: 'bold',
      titlePadding: 10,
      labelOverlap: false,
    },
    axisX: {
      gridColor: gridGray,
      tickColor: gridGray,
      tickSize: 0,
      domain: false,
      labelFont: 'Inter, sans-serif',
      labelFontSize: 10,
      labelFontWeight: 'normal',
      labelPadding: 5,
      labelColor: grayMedium,
      titleColor: grayMedium,
      titleFont: 'Inter, sans-serif',
      titleFontSize: 12,
      titleFontWeight: 'bold',
      titlePadding: 10,
    },
    view: {
      strokeWidth: 0,
    },
  },
  params: [],
  padding: 0,
  autosize: {
    type: 'none',
    resize: true,
    contains: 'content',
  },
  // for vega-lite, if width/height is not specificed in spec it will try to autosize. Set values to prevent
  width: 1,
  height: 1,
  data: {
    values: [],
  },
  layer: [],
});
