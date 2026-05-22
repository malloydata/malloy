/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TagParseSpec, MalloyTagParse, Annotations} from './annotation';

/**
 * Interface for objects that have Malloy tag annotations.
 * This is part of the runtime API - objects returned from the Malloy
 * runtime implement this interface to expose their tag metadata.
 */
export interface Taggable {
  /**
   * Route-aware annotation access. Unlike `tagParse`/`getTaglines`, this sees
   * block annotations (`#|`…`|#`).
   */
  readonly annotations: Annotations;
  /**
   * @deprecated The RegExp form cannot see block annotations (`#|`…`|#`) and
   * cannot report content offsets for error mapping. Use
   * `annotations.parseAsTag(route)` instead.
   */
  tagParse: (spec?: TagParseSpec) => MalloyTagParse;
  /**
   * @deprecated The RegExp form cannot see block annotations. Use
   * `annotations.texts(route)` (raw strings) or `annotations.forRoute(route)`
   * (objects with offsets) instead.
   */
  getTaglines: (prefix?: RegExp) => string[];
}
