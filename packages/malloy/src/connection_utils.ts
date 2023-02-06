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

type YieldDone = { done: true; isError: false };
type YieldError = { done: true; isError: true; error: Error };
type YieldNext<T> = {
  done: false;
  isError: false;
  next: Promise<YieldSomething<T>>;
  value: T;
};

type YieldSomething<T> = YieldDone | YieldError | YieldNext<T>;

export async function* toAsyncGenerator<T>(
  startStreaming: (
    onError: (error: Error) => void,
    onData: (data: T) => void,
    onEnd: () => void
  ) => void
): AsyncIterableIterator<T> {
  let done = false;
  function getResults(
    startStreaming: (
      onError: (error: Error) => void,
      onData: (data: T) => void,
      onEnd: () => void
    ) => void
  ): Promise<YieldSomething<T>> {
    let resolve: (result: YieldSomething<T>) => void;
    const promise = new Promise<YieldSomething<T>>((res) => {
      resolve = res;
    });
    startStreaming(
      (error) => {
        resolve({ "done": true, "isError": true, error });
      },
      (data) => {
        resolve({
          "done": false,
          "value": data,
          "isError": false,
          "next": new Promise((res) => {
            resolve = res;
          })
        });
      },
      () => {
        resolve({ "done": true, "isError": false });
      }
    );
    return promise;
  }
  let next = getResults(startStreaming);
  while (!done) {
    const result = await next;
    if (result.done) {
      done = true;
      if (result.isError) {
        throw result.error;
      }
      break;
    } else {
      next = result.next;
      yield result.value;
    }
  }
}
