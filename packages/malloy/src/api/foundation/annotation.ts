/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Tag, TagError, SourceOrigin} from '@malloydata/malloy-tag';
import {TagParser} from '@malloydata/malloy-tag';
import type {AnnotationsDef, Note, DocumentLocation} from '../../model';
import type {LogMessage} from '../../lang';
import {parsePrefix} from '../../lang/annotation-prefix';

/**
 * @deprecated Argument shape for the deprecated RegExp form of
 * {@link annotationToTag}. The RegExp form cannot see multi-line
 * annotations (`#|`…`|#`). Pass a route string to `annotationToTag`
 * instead, or use the {@link Annotations} view on a tagged entity.
 */
export interface TagParseSpec {
  prefix?: RegExp;
}

/**
 * One annotation, returned by {@link Annotations.forRoute} — wraps an IR
 * note with its parsed route and prefix/content split. Carries the offsets
 * a caller needs to parse the payload (`.content`) with their own parser
 * and map parser errors back to source positions.
 *
 * Foundation-owned: not derived from the IR `Note` type, so IR can evolve
 * fields without breaking this public shape. Direct construction is
 * internal; reach instances via `Annotations.forRoute`.
 */
export class RoutedNote {
  /** @internal */
  constructor(
    private readonly _note: Note,
    public readonly route: string,
    public readonly contentIndex: number
  ) {}

  /** The annotation exactly as written — prefix + content. */
  get text(): string {
    return this._note.text;
  }

  /** Where this note starts in source. */
  get at(): DocumentLocation {
    return this._note.at;
  }

  /**
   * Multi-line annotations only (`#|`…`|#`). Number of leading-whitespace
   * characters stripped from each body line during the dedent pass (Python
   * `textwrap.dedent` semantics — longest common prefix across non-blank
   * body lines). Omitted for single-line annotations and for multi-line
   * annotations with no common indent.
   *
   * To map your parser's column numbers back to source:
   * `source_col = indentStripped + parser_col` for body lines; first-line
   * columns map straight through, offset by {@link contentIndex}.
   */
  get indentStripped(): number | undefined {
    return this._note.indentStripped;
  }

  /** The payload — `text.slice(contentIndex)`. The string to feed to
   *  your own parser. */
  get content(): string {
    return this._note.text.slice(this.contentIndex);
  }
}

/** Every Note of an annotation, inherited first, in document order. */
function* notesInOrder(annote: AnnotationsDef): Generator<Note> {
  if (annote.inherits) yield* notesInOrder(annote.inherits);
  if (annote.blockNotes) yield* annote.blockNotes;
  if (annote.notes) yield* annote.notes;
}

/**
 * Collect annotations, using the shared prefix parser.
 * - no `route`: every annotation, each carrying its own `route` (the only
 *   way to reach one whose prefix is malformed).
 * - a `route`: only annotations on that route; malformed prefixes excluded.
 */
export function collectAnnotations(
  annote: AnnotationsDef | undefined,
  route?: string
): RoutedNote[] {
  const matching: RoutedNote[] = [];
  for (const note of notesInOrder(annote ?? {})) {
    const parsed = parsePrefix(note.text);
    if (route === undefined) {
      matching.push(new RoutedNote(note, parsed.route, parsed.contentIndex));
    } else if (
      parsed.route === route &&
      parsed.malformation !== 'malformed-route'
    ) {
      matching.push(new RoutedNote(note, parsed.route, parsed.contentIndex));
    }
  }
  return matching;
}

/**
 * Collect all matching Notes from an AnnotationsDef, walking the inherits
 * chain. Returns notes in inheritance order (inherited first).
 *
 * @deprecated RegExp prefix matching; use {@link collectAnnotations} with a route.
 */
function collectNotes(annote: AnnotationsDef, prefix?: RegExp): Note[] {
  const notes = [...notesInOrder(annote)];
  return prefix ? notes.filter(note => note.text.match(prefix)) : notes;
}

/**
 * @deprecated The RegExp form cannot see multi-line annotations
 * (`#|`…`|#`). Use `new Annotations(annote).texts(route)` instead, or the
 * {@link Annotations} view on a tagged entity (`entity.annotations.texts(route)`).
 */
export function annotationToTaglines(
  annote: AnnotationsDef | undefined,
  prefix?: RegExp
): string[] {
  return collectNotes(annote || {}, prefix).map(n => n.text);
}

export interface MalloyTagParse {
  tag: Tag;
  log: LogMessage[];
}

/** Parse a run of Notes as MOTLY into one Tag, collecting errors. */
function parseTaglines(lines: ReadonlyArray<Note>): MalloyTagParse {
  const allErrs: LogMessage[] = [];
  const session = new TagParser();
  for (const line of lines) {
    const origin: SourceOrigin = {
      url: line.at.url,
      startLine: line.at.range.start.line,
      startColumn: line.at.range.start.character,
    };
    const noteParse = session.parseAnnotation(line.text, origin);
    allErrs.push(
      ...noteParse.log.map((e: TagError) => mapMalloyError(e, line))
    );
  }
  const tag = session.finish();
  for (const refError of tag.validateReferences()) {
    allErrs.push({
      code: 'tag-reference-error',
      severity: 'warn',
      message: refError,
    });
  }
  return {tag, log: allErrs};
}

/** Parse the annotations on `route` (default `''`, the MOTLY tag route) as MOTLY. */
export function annotationToTag(
  annote: AnnotationsDef | undefined,
  route?: string
): MalloyTagParse;
/**
 * @deprecated The RegExp `prefix` form cannot see multi-line annotations
 * (`#|`…`|#`) and cannot report content offsets for error mapping. Pass a
 * route string (the other overload), or use {@link Annotations.parseAsTag}
 * on a tagged entity.
 */
export function annotationToTag(
  annote: AnnotationsDef | undefined,
  spec?: TagParseSpec
): MalloyTagParse;
export function annotationToTag(
  annote: AnnotationsDef | undefined,
  arg?: string | TagParseSpec
): MalloyTagParse {
  if (typeof arg === 'object') {
    const prefix = arg.prefix || /^##? /;
    return parseTaglines(collectNotes(annote ?? {}, prefix));
  }
  const matched = collectAnnotations(annote, arg ?? '');
  return parseTaglines(
    matched.map(a => ({
      text: a.text,
      at: a.at,
      indentStripped: a.indentStripped,
    }))
  );
}

/**
 * The route-aware annotation API for a tagged entity.
 *
 * An annotation has a *prefix* (everything from `#`/`##` up to the first
 * whitespace) that resolves to a *route* — a namespace key. Built-in routes:
 * `''` (MOTLY tags, the human default), `!` (compiler flags), `@` (persistence
 * directives), `"` (doc-string markdown). Apps stake their own routes with
 * brackets: `#(myApp) ...` is route `myApp`. The grammar (forms, bracket
 * pairs, malformation warnings) lives in `lang/prefix.ts`.
 *
 * All annotation reading lives here, written once; each tagged class only has
 * to say *where* its annotation is (by handing it to the constructor). Unlike
 * the deprecated RegExp readers (`tagParse`/`getTaglines`), this sees multi-
 * line annotations.
 */
export class Annotations {
  constructor(private readonly annote: AnnotationsDef | undefined) {}

  /**
   * Raw annotation text strings (prefix + content) — all routes if `route` is
   * omitted, just that route's otherwise. The route-based successor to the
   * deprecated `getTaglines`. For source-mapped offsets (when parsing the
   * payload with your own parser), see {@link forRoute}.
   */
  texts(route?: string): string[] {
    return collectAnnotations(this.annote, route).map(a => a.text);
  }

  /**
   * Your route's notes as {@link RoutedNote}s — for callers that parse the
   * payload with their own parser (instead of MOTLY). Read `.content` to
   * feed your parser, and `.at` + `.indentStripped` to map your parser's
   * errors back to source. Malformed-prefix annotations are excluded.
   */
  forRoute(route: string): RoutedNote[] {
    return collectAnnotations(this.annote, route);
  }

  /** Parse a route's annotations as a MOTLY tag. Default `''` is the tag route. */
  parseAsTag(route = ''): MalloyTagParse {
    return annotationToTag(this.annote, route);
  }
}

function mapMalloyError(e: TagError, note: Note): LogMessage {
  // MOTLY reports `e.line` / `e.offset` into the *stripped* note text it
  // parsed. To map back to source:
  //   line 0 (opener line):    col = opener_col + prefix_len + e.offset
  //   line N>0 (body lines):   col = indentStripped + e.offset
  // `indentStripped` is the per-line dedent recorded on the Note by the
  // translator (uniform per block, so the same formula serves every body
  // line). Prefix length is everything before the separator, via parsePrefix.
  const line = note.at.range.start.line + e.line;
  const character =
    e.line === 0
      ? note.at.range.start.character + prefixLength(note.text) + e.offset
      : (note.indentStripped ?? 0) + e.offset;

  const loc = {line, character};
  return {
    code: 'tag-parse-error',
    severity: 'error',
    message: e.message,
    at: {
      url: note.at.url,
      range: {start: loc, end: loc},
    },
  };
}

/** Length of the annotation prefix per malloy-tag's `stripPrefix`: index of
 *  the first whitespace, or 0 if none. */
function prefixLength(text: string): number {
  const {contentIndex} = parsePrefix(text);
  return contentIndex === text.length ? 0 : contentIndex - 1;
}
