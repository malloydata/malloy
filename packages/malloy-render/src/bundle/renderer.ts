/*
 * Copyright 2024 Google LLC
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

import type {ResultJSON} from '@malloydata/malloy';
import {Result, PreparedResult} from '@malloydata/malloy';
import {HTMLView} from '../html/html_view';

export async function renderMalloyResults(
  queryResult,
  totalRows,
  preparedResult
) {
  try {
    let preparedResultObj: PreparedResult;
    if (
      preparedResult._modelDef !== undefined &&
      preparedResult._rawQuery !== undefined
    ) {
      // prepared result is safely typecasted.
      preparedResultObj = preparedResult;
    } else if (
      preparedResult.inner !== undefined &&
      preparedResult.modelDef !== undefined
    ) {
      // prepared result is raw json.
      preparedResultObj = PreparedResult.fromJson({
        query: preparedResult.inner,
        modelDef: preparedResult.modelDef,
      });
    } else {
      throw new Error('preparedResult has missing properties.');
    }
    const malloyRes: ResultJSON = {
      queryResult: {
        ...preparedResultObj._rawQuery,
        result: queryResult,
        totalRows: totalRows,
      },
      modelDef: preparedResultObj._modelDef,
    };
    const result = Result.fromJSON(malloyRes);
    const htmlView = new HTMLView(document).render(result, {
      dataStyles: {},
      isDrillingEnabled: false,
    });
    return await htmlView;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error rendering results:', error);
    const span = document.createElement('span');
    span.textContent = 'Unable to render malloy results.';
    return span;
  }
}
