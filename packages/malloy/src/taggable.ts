/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TagParseSpec, MalloyTagParse} from './annotation';

/**
 * Interface for objects that have Malloy tag annotations.
 * This is part of the runtime API - objects returned from the Malloy
 * runtime implement this interface to expose their tag metadata.
 */
export interface Taggable {
  tagParse: (spec?: TagParseSpec) => MalloyTagParse;
  getTaglines: (prefix?: RegExp) => string[];
}
