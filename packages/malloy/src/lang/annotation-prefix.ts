/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * The result of parsing an annotation's leading prefix.
 *
 * An annotation is `prefix sep content`. `parsePrefix` splits the captured
 * annotation text at the first whitespace, strips the sigil (`#`/`##` plus an
 * optional block `|`), and classifies the routing into one of three forms.
 * `route` is one field; `contentIndex` and `malformation` are equally why this
 * routine exists.
 */
export interface ParsedPrefix {
  /** The route the prefix resolves to. `''` is the MOTLY (empty) route. */
  route: string;
  /**
   * Offset into the annotation text where the content begins;
   * `text.slice(contentIndex)` is the content, with the single separator
   * character excluded.
   */
  contentIndex: number;
  /**
   * Set iff the prefix is not a well-formed route. The annotation is still
   * stored and reachable via the all-routes API; this only drives a warning.
   * - `malformed-route`: not one of the three forms — a bare word, an unclosed
   *   or mismatched bracket, an empty bracketed name, or trailing junk.
   * - `reserved-route`: a punct-only (sigil) routing that Malloy has not
   *   claimed; the punct-only namespace is reserved for Malloy's own use.
   */
  malformation?: 'malformed-route' | 'reserved-route';
}

/**
 * Punct-only (sigil) routes are reserved for Malloy's own use. This is the
 * closed, enumerated set the compiler claims; any other punct-only routing
 * warns `reserved-route`. The set being closed is what makes the warning
 * possible — the compiler knows its own complete sigil vocabulary.
 */
const CLAIMED_SIGILS = new Set(['!', '@', '"', ':']);

/** Bracket pairs an app route may use, as [open, close] — the single source. */
const BRACKET_PAIRS: [string, string][] = [
  ['(', ')'],
  ['<', '>'],
  ['[', ']'],
  ['{', '}'],
];

/** Two views of BRACKET_PAIRS: open->close for lookup, all halves for membership. */
const OPEN_TO_CLOSE = new Map(BRACKET_PAIRS);
const BRACKETS = new Set(BRACKET_PAIRS.flat());

/** Letter, number, or underscore — the "word" characters. */
const WORDISH = /[\p{L}\p{N}_]/u;

/**
 * Parse the leading prefix of a captured annotation.
 *
 * `text` is the entire annotation as the lexer captured it, marker included: a
 * single line `#... content`, or a block `#|...\n<body>` whose body the lexer
 * has already de-indented and whose closer it has removed. This routine never
 * parses the content — it returns where the content begins.
 *
 * The prefix runs from the marker to the **first whitespace**; that boundary
 * never moves (no bracket or quote changes it, so a route can never contain
 * whitespace). After stripping the sigil (`^##?\|?`), the routing matches one
 * of three forms:
 *
 *   1. empty                 -> route `''`        (MOTLY, the human default)
 *   2. PUNCT+ (no bracket)   -> sigil route       (reserved; unclaimed warns)
 *   3. OPEN ... CLOSE        -> route = bracketed text (opaque app route)
 *
 * Anything else is `malformed-route`. Bracket pairs are `()`, `<>`, `[]`, `{}`;
 * the route is everything up to the matching close (first close wins, no
 * nesting), taken literally — no character classification, so `#(bar-chart)`,
 * `#(https://x/y)`, and `#(v1.2.3)` are all just their bracketed text.
 */
export function parsePrefix(text: string): ParsedPrefix {
  // 1. Split prefix from content at the first whitespace. The single separator
  //    character is excluded from the content.
  //    `\r` is in the class because Windows line endings put a `\r` right before
  //    the `\n` at every line end (the lexer keeps `\r` out of line *content*),
  //    so on a content-less prefix like `#(docs)\r\n` the `\r` must not be pulled
  //    into the routing. We split on it rather than mutating the text, so source
  //    offsets stay intact for error mapping; any line-ending bytes remain in the
  //    content, which is faithful to source and harmless to payload parsers.
  const boundary = text.search(/[ \t\r\n]/);
  const prefix = boundary === -1 ? text : text.slice(0, boundary);
  const contentIndex = boundary === -1 ? text.length : boundary + 1;

  // 2. Strip the sigil: one or two '#', then an optional block '|'.
  const sigil = /^(#{1,2})(\|?)/.exec(prefix);
  if (!sigil) {
    // A captured annotation always starts with '#'; if it somehow does not,
    // there is no route to speak of — likely a compiler bug upstream.
    return {route: prefix, contentIndex, malformation: 'malformed-route'};
  }
  const routing = prefix.slice(sigil[0].length);

  // Form 1: empty routing -> the MOTLY namespace.
  if (routing === '') {
    return {route: '', contentIndex};
  }

  // Form 3: opens with a bracket -> route is the text up to the matching close.
  // A non-undefined close both proves routing[0] is an open bracket and gives
  // us its partner in one lookup.
  const close = OPEN_TO_CLOSE.get(routing[0]);
  if (close !== undefined) {
    const closeIdx = routing.indexOf(close, 1);
    const malformed =
      closeIdx === -1 || // unclosed
      closeIdx !== routing.length - 1 || // trailing junk after the close
      closeIdx === 1; // empty bracketed text: `#()`
    if (malformed) {
      return {route: routing, contentIndex, malformation: 'malformed-route'};
    }
    return {route: routing.slice(1, closeIdx), contentIndex};
  }

  // Form 2: pure punctuation (no word chars, no brackets) -> sigil route.
  const isPurePunct = [...routing].every(
    c => !WORDISH.test(c) && !BRACKETS.has(c)
  );
  if (isPurePunct) {
    return {
      route: routing,
      contentIndex,
      malformation: CLAIMED_SIGILS.has(routing) ? undefined : 'reserved-route',
    };
  }

  // Otherwise: a bare word, or mixed text with no brackets.
  return {route: routing, contentIndex, malformation: 'malformed-route'};
}
