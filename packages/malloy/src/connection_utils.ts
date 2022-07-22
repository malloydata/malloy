/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
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
        resolve({ done: true, isError: true, error });
      },
      (data) => {
        resolve({
          done: false,
          value: data,
          isError: false,
          next: new Promise((res) => {
            resolve = res;
          }),
        });
      },
      () => {
        resolve({ done: true, isError: false });
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
