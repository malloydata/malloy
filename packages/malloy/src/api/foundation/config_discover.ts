/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {URLReader} from '../../runtime_types';

const SHARED_FILENAME = 'malloy-config.json';
const LOCAL_FILENAME = 'malloy-config-local.json';

export interface DiscoveredConfig {
  /** The URL of the config file that was found. If both shared and local
   * files were found at the same level, this is the local URL. */
  configURL: URL;
  /** The parsed POJO. If both shared and local were found, `connections`
   * is shallow-merged with the local file's entries winning. */
  pojo: Record<string, unknown>;
}

/**
 * Walk upward from `startURL` toward `ceilingURL`, looking for a
 * `malloy-config.json` (or `malloy-config-local.json`) at each directory
 * level. Returns the first match, or `null` if no config file is found
 * between `startURL` and `ceilingURL` (inclusive).
 *
 * `ceilingURL` is the host-supplied project root — discovery stops at that
 * level, and it is what `config.rootDirectory` binds to in the typical
 * overlay wiring. The config file's actual location is incidental and is
 * exposed separately as `configURL` for tools that care.
 *
 * URL-based, so it works in browser-safe environments through `URLReader`.
 */
export async function discoverConfig(
  startURL: URL,
  ceilingURL: URL,
  urlReader: URLReader
): Promise<DiscoveredConfig | null> {
  // Normalize both to directory form.
  let current = new URL('.', startURL);
  const ceiling = new URL('.', ceilingURL);

  // If we're not under (or at) the ceiling, there's nothing meaningful to
  // walk — bail.
  if (!isWithinOrEqual(current, ceiling)) return null;

  for (;;) {
    const found = await tryReadAtLevel(current, urlReader);
    if (found) return found;
    if (current.toString() === ceiling.toString()) break;
    const parent = new URL('..', current);
    // URL scheme roots (`file:///`, `http://host/`) return themselves when
    // you ask for their parent. Guard against the loop.
    if (parent.toString() === current.toString()) break;
    current = parent;
  }
  return null;
}

async function tryReadAtLevel(
  dirURL: URL,
  urlReader: URLReader
): Promise<DiscoveredConfig | null> {
  const sharedURL = new URL(SHARED_FILENAME, dirURL);
  const localURL = new URL(LOCAL_FILENAME, dirURL);

  const [sharedPOJO, localPOJO] = await Promise.all([
    tryReadJSON(sharedURL, urlReader),
    tryReadJSON(localURL, urlReader),
  ]);

  if (!sharedPOJO && !localPOJO) return null;

  if (sharedPOJO && localPOJO) {
    // Shallow-merge top-level keys, local wins. `connections` is the one
    // section we deep-merge by entry name (local winning) — the documented
    // shop workflow is shared credentials as env refs in git, local
    // overrides with literal values outside git.
    //
    // All other sections (virtualMap, manifestPath, includeDefaults) are
    // replaced wholesale when present in the local file. If you want to
    // augment a shared virtualMap from the local file, you have to copy
    // the shared entries into the local file explicitly.
    const sharedConns = isRecord(sharedPOJO['connections'])
      ? sharedPOJO['connections']
      : {};
    const localConns = isRecord(localPOJO['connections'])
      ? localPOJO['connections']
      : {};
    const merged: Record<string, unknown> = {
      ...sharedPOJO,
      ...localPOJO,
      connections: {...sharedConns, ...localConns},
    };
    return {configURL: localURL, pojo: merged};
  }

  if (localPOJO) return {configURL: localURL, pojo: localPOJO};
  // Narrowed: sharedPOJO is truthy here.
  return {configURL: sharedURL, pojo: sharedPOJO as Record<string, unknown>};
}

/**
 * Try to read and parse a config file at `url`.
 *
 * Two failure modes are distinguished:
 *   - URL read fails (file not present) → returns `null`, signalling the
 *     walker to keep going up.
 *   - Read succeeds but contents are unparseable or not a JSON object →
 *     throws. A matched-but-broken config file is a hard error; silently
 *     skipping it would hide user mistakes and quietly fall through to a
 *     grandparent config.
 */
async function tryReadJSON(
  url: URL,
  urlReader: URLReader
): Promise<Record<string, unknown> | null> {
  let contents: string;
  try {
    const result = await urlReader.readURL(url);
    contents = typeof result === 'string' ? result : result.contents;
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Malformed JSON in ${url.toString()}: ${msg}`);
  }
  if (!isRecord(parsed)) {
    throw new Error(
      `Config file ${url.toString()} must contain a JSON object at the top level`
    );
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWithinOrEqual(child: URL, ancestor: URL): boolean {
  return child.toString().startsWith(ancestor.toString());
}
