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

export {RuntimeList, testRuntimeFor} from './runtimes';

export {allDatabaseTestSets} from './databases/shared/test_list';

export {exprSharedTests} from './databases/shared/expr.spec';
export {functionsSharedTests} from './databases/shared/functions.spec';
export {indexSharedTests} from './databases/shared/index.spec';
export {joinSharedTests} from './databases/shared/join.spec';
export {noModelSharedTests} from './databases/shared/nomodel.spec';
export {orderBySharedTests} from './databases/shared/orderby.spec';
export {problemsSharedTests} from './databases/shared/problems.spec';
export {sqlExpressionsSharedTests} from './databases/shared/sql_expressions.spec';
export {timeSharedTests} from './databases/shared/time.spec';
