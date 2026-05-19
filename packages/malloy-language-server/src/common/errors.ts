/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export const errorMessage = (error: unknown): string => {
  let message = '';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = error as any;
    if (typeof obj.message === 'string' && obj.message) {
      message = obj.message;
    } else if (typeof obj.data === 'string' && obj.data) {
      message = obj.data;
    } else {
      try {
        message = JSON.stringify(error);
      } catch {
        // ignore
      }
    }
  }
  if (!message) {
    console.error('Unknown error object:', error);
    message = 'Something went wrong';
  }
  return message;
};
