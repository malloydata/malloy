/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
