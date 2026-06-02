/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export interface PrettifyError {
  message: string;
  line: number;
  column: number;
}

export interface PrettifyResult {
  result: string;
  errors: PrettifyError[];
}
