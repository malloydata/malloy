/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {URLReader} from '../../runtime_types';
import {MalloyConfig} from './config';
import {contextOverlay} from './config_overlays';
import type {ConfigOverlays} from './config_overlays';

const SHARED_FILENAME = 'malloy-config.json';
const LOCAL_FILENAME = 'malloy-config-local.json';

/**
 * Walk upward from `startURL` toward `ceilingURL`, looking for a
 * `malloy-config.json` (or `malloy-config-local.json`) at each directory
 * level. On a hit, build a `MalloyConfig` from the parsed POJO with a
 * `config` overlay carrying `rootDirectory` (the ceiling) and `configURL`
 * (the actual location of the file that matched). Returns `null` if no
 * config file is found between `startURL` and `ceilingURL` (inclusive).
 *
 * `ceilingURL` is the host-supplied project root — discovery stops at that
 * level, and it is what `config.rootDirectory` binds to in the typical
 * overlay wiring. The matched config file's actual location rides on
 * `config.configURL` so that `MalloyConfig.manifestURL` can resolve
 * `MANIFESTS/malloy-manifest.json` relative to the file the config came
 * from (not the project root).
 *
 * Callers can inspect what discovery found via `readOverlay` on the
 * returned config:
 *
 *   const config = await discoverConfig(startURL, ceilingURL, urlReader);
 *   config?.readOverlay('config', 'rootDirectory')  // the ceiling URL
 *   config?.readOverlay('config', 'configURL')       // the matched file URL
 *
 * Hosts that want to layer additional overlays on top of discovery's
 * `config` overlay (e.g. a `session` overlay for per-request data) pass
 * them via `extraOverlays`. The merge is plain object-spread: extras with
 * the same key as discovery's entries replace them wholesale. In
 * particular, passing `{config: myConfigOverlay}` will clobber the
 * `rootDirectory` + `configURL` discovery built — callers who want to
 * extend discovery's `config` should read the keys back off and re-include
 * them, or skip `discoverConfig` and build `MalloyConfig` directly.
 *
 * URL-based, so it works in browser-safe environments through `URLReader`.
 */
export async function discoverConfig(
  startURL: URL,
  ceilingURL: URL,
  urlReader: URLReader,
  extraOverlays?: ConfigOverlays
): Promise<MalloyConfig | null> {
  // Normalize both to directory form.
  let current = new URL('.', startURL);
  const ceiling = new URL('.', ceilingURL);

  // If we're not under (or at) the ceiling, there's nothing meaningful to
  // walk — bail.
  if (!isWithinOrEqual(current, ceiling)) return null;

  for (;;) {
    const found = await tryReadAtLevel(current, urlReader);
    if (found) return buildConfig(found, ceilingURL, extraOverlays);
    if (current.toString() === ceiling.toString()) break;
    const parent = new URL('..', current);
    // URL scheme roots (`file:///`, `http://host/`) return themselves when
    // you ask for their parent. Guard against the loop.
    if (parent.toString() === current.toString()) break;
    current = parent;
  }
  return null;
}

interface DiscoveryHit {
  configURL: URL;
  pojo: Record<string, unknown>;
}

function buildConfig(
  hit: DiscoveryHit,
  ceilingURL: URL,
  extraOverlays: ConfigOverlays | undefined
): MalloyConfig {
  const discoveryOverlays: ConfigOverlays = {
    config: contextOverlay({
      rootDirectory: ceilingURL.toString(),
      configURL: hit.configURL.toString(),
    }),
  };
  const merged: ConfigOverlays = {...discoveryOverlays, ...extraOverlays};
  return new MalloyConfig(hit.pojo, merged);
}

async function tryReadAtLevel(
  dirURL: URL,
  urlReader: URLReader
): Promise<DiscoveryHit | null> {
  const sharedURL = new URL(SHARED_FILENAME, dirURL);
  const localURL = new URL(LOCAL_FILENAME, dirURL);

  const [sharedPOJO, localPOJO] = await Promise.all([
    tryReadJSON(sharedURL, urlReader),
    tryReadJSON(localURL, urlReader),
  ]);

  // Local supersedes shared entirely when both exist — no merging of any
  // kind. The person writing a local file is responsible for including
  // everything they need.
  if (localPOJO) return {configURL: localURL, pojo: localPOJO};
  if (sharedPOJO) return {configURL: sharedURL, pojo: sharedPOJO};
  return null;
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
