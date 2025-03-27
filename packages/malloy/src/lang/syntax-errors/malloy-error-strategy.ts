/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {DefaultErrorStrategy} from 'antlr4ts';

/**
 * Custom error strategy for the Malloy Parser.
 *
 * This class does not currently override default ANTLR error handling.
 *
 * For more details, read the documentation in DefaultErrorStrategy.d.ts
 * or reference the superclass at:
 * https://github.com/tunnelvisionlabs/antlr4ts/blob/master/src/DefaultErrorStrategy.ts
 */
export class MalloyErrorStrategy extends DefaultErrorStrategy {}
