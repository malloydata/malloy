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

import {TestTranslator, markSource} from './test-translator';

test('model annotations can be retrieved', () => {
  const src = markSource`${'## foo'}`;
  const doc = new TestTranslator(src.code);
  const {modelAnnotation} = doc.modelAnnotation();
  expect(modelAnnotation?.notes?.length).toBe(1);
  const notes = modelAnnotation?.notes ?? [];
  expect(notes[0].text).toBe('## foo');
  expect(notes[0].at).toMatchObject(src.locations[0]);
});

test('does not explode if bad parse', () => {
  const src = markSource`
    ${'## foo'}
    asd afsjei ; duavby {{}}}
  `;
  const doc = new TestTranslator(src.code);
  const response = doc.modelAnnotation();
  expect(response.modelAnnotation).toBe(undefined);
  expect(response.final).toBe(true);
});
