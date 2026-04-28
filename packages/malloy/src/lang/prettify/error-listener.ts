/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  ANTLRErrorListener,
  RecognitionException,
  Recognizer,
} from 'antlr4ts';
import type {PrettifyError} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
export class CollectingErrorListener implements ANTLRErrorListener<any> {
  errors: PrettifyError[] = [];
  syntaxError<T>(
    _recognizer: Recognizer<T, any>,
    _offendingSymbol: T | undefined,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: RecognitionException | undefined
  ): void {
    this.errors.push({message: msg, line, column: charPositionInLine});
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
