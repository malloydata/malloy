/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import type {Tag} from '@malloydata/malloy-tag';
import {TagParser} from '@malloydata/malloy-tag';
import {parsePrefix} from '../lang/annotation-prefix';

// ============================================================================
// Helpers for the stable (Thrift-derived) wire shape: `Malloy.Annotation[]`.
//
// API consumers (render, query-builder, downstream SDKs that target the
// stable interface) read annotation arrays off projected stable types
// (`Malloy.Result`, `Malloy.FieldInfo`, etc.) and want low-ceremony reads —
// no source offsets, no view class. These helpers consume that array shape
// directly, using the shared `parsePrefix` for route resolution.
// ============================================================================

/**
 * The route a stable {@link Malloy.Annotation} belongs to (`''` for MOTLY
 * tags, `!` for compiler flags, `myApp` for an app's claimed route, etc.).
 * Returns `undefined` if the annotation's prefix is malformed.
 */
export function routeOf(a: Malloy.Annotation): string | undefined {
  const parsed = parsePrefix(a.value);
  if (parsed.malformation === 'malformed-route') return undefined;
  return parsed.route;
}

/**
 * The payload of a stable {@link Malloy.Annotation} — the text after the
 * prefix and separator (`'name=foo'` for `'#(filter) name=foo'`,
 * `'tag'` for `'# tag\n'`). Returns the empty string for an annotation
 * that has no content.
 */
export function payloadOf(a: Malloy.Annotation): string {
  return a.value.slice(parsePrefix(a.value).contentIndex);
}

/**
 * Filter `annotations` to just those on `route`, in input order.
 * Annotations with malformed prefixes are excluded.
 */
export function annotationsForRoute(
  annotations: Malloy.Annotation[] | undefined,
  route: string
): Malloy.Annotation[] {
  if (!annotations) return [];
  return annotations.filter(a => {
    const parsed = parsePrefix(a.value);
    return parsed.route === route && parsed.malformation !== 'malformed-route';
  });
}

/**
 * Parse a stable `Malloy.Annotation[]`'s `route` annotations as MOTLY into
 * one Tag. The stable counterpart to `Annotations.parseAsTag` — consumes
 * the flat wire shape, no source offsets.
 */
export function tagFromAnnotations(
  annotations: Malloy.Annotation[] | undefined,
  route: string
): Tag {
  const session = new TagParser();
  for (const a of annotationsForRoute(annotations, route)) {
    session.parseAnnotation(a.value);
  }
  return session.finish();
}
