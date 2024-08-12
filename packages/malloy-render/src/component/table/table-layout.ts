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

import {FieldRenderMetadata, RenderResultMetadata} from '../types';

type LayoutEntry = {
  metadata: FieldRenderMetadata;
  width: number | null;
  height: number | null;
};

export type TableLayout = Record<string, LayoutEntry>;

const NAMED_COLUMN_WIDTHS = {
  xs: 28,
  sm: 64,
  md: 128,
  lg: 256,
  xl: 384,
  '2xl': 512,
};

export function getTableLayout(metadata: RenderResultMetadata): TableLayout {
  const layout = {};

  for (const [key, fieldMeta] of Object.entries(metadata.fields)) {
    const field = fieldMeta.field;
    const layoutEntry: LayoutEntry = {
      metadata: fieldMeta,
      width: null,
      height: null,
    };
    const {tag} = field.tagParse();
    // Allow overriding size
    const textWidth = tag.text('width');
    if (textWidth && NAMED_COLUMN_WIDTHS[textWidth])
      layoutEntry.width = NAMED_COLUMN_WIDTHS[textWidth];
    else if (tag.numeric('width')) layoutEntry.width = tag.numeric('width')!;

    if (tag.numeric('height')) layoutEntry.height = tag.numeric('height')!;

    layout[key] = layoutEntry;
  }
  return layout;
}
