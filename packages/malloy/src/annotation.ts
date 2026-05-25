import type {Tag, TagError, SourceOrigin} from '@malloydata/malloy-tag';
import {TagParser} from '@malloydata/malloy-tag';
import type {AnnotationsDef, Note, DocumentLocation} from './model';
import type {LogMessage} from './lang';
import {parsePrefix} from './prefix';

/**
 * @deprecated Argument shape for the deprecated RegExp form of
 * {@link annotationToTag}. The RegExp form cannot see block annotations
 * (`#|`…`|#`). Pass a route string to `annotationToTag` instead, or use the
 * {@link Annotations} view on a tagged entity.
 */
export interface TagParseSpec {
  prefix?: RegExp;
}

/** One annotation, unparsed — its raw text and where its content begins. */
export interface AnnotationText {
  /** The annotation exactly as written — prefix + content. */
  rawText: string;
  /** Offset where the content begins; `rawText.slice(contentIndex)` is the content. */
  contentIndex: number;
  /** Where `rawText` begins in the source document. */
  at: DocumentLocation;
  /**
   * For block annotations: characters of leading whitespace removed from
   * each body line by the translator's dedent pass. A BYO parser that wants
   * source-mapped error columns adds this to the parser's reported column for
   * body lines (`source_col = indentStripped + parser_col`).
   */
  indentStripped?: number;
}

/** An {@link AnnotationText} that also carries its route (`''` is MOTLY). */
export interface RoutedAnnotation extends AnnotationText {
  route: string;
}

/** Every Note of an annotation, inherited first, in document order. */
function* notesInOrder(annote: AnnotationsDef): Generator<Note> {
  if (annote.inherits) yield* notesInOrder(annote.inherits);
  if (annote.blockNotes) yield* annote.blockNotes;
  if (annote.notes) yield* annote.notes;
}

/**
 * Collect annotations, using the shared prefix parser.
 * - no `route`: every annotation, each carrying its own `route` (the only way
 *   to reach one whose prefix is malformed).
 * - a `route`: only annotations on that route, `route` omitted from each result
 *   (you passed it); malformed prefixes excluded.
 */
export function collectAnnotations(
  annote: AnnotationsDef | undefined
): RoutedAnnotation[];
export function collectAnnotations(
  annote: AnnotationsDef | undefined,
  route: string
): AnnotationText[];
export function collectAnnotations(
  annote: AnnotationsDef | undefined,
  route?: string
): RoutedAnnotation[] | AnnotationText[] {
  if (route === undefined) {
    return Array.from(notesInOrder(annote ?? {}), note => {
      const {route: noteRoute, contentIndex} = parsePrefix(note.text);
      return {
        rawText: note.text,
        contentIndex,
        at: note.at,
        route: noteRoute,
        indentStripped: note.indentStripped,
      };
    });
  }
  const matching: AnnotationText[] = [];
  for (const note of notesInOrder(annote ?? {})) {
    const parsed = parsePrefix(note.text);
    if (parsed.route === route && parsed.malformation !== 'malformed-route') {
      matching.push({
        rawText: note.text,
        contentIndex: parsed.contentIndex,
        at: note.at,
        indentStripped: note.indentStripped,
      });
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
 * @deprecated The RegExp form cannot see block annotations (`#|`…`|#`). Use
 * `new Annotations(annote).texts(route)` instead, or the {@link Annotations}
 * view on a tagged entity (`entity.annotations.texts(route)`).
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
 * @deprecated The RegExp `prefix` form cannot see block annotations
 * (`#|`…`|#`) and cannot report content offsets for error mapping. Pass a route
 * string (the other overload), or use {@link Annotations.parseAsTag} on a
 * tagged entity.
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
      text: a.rawText,
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
 * pairs, malformation warnings) lives in `./prefix.ts`.
 *
 * All annotation reading lives here, written once; each tagged class only has
 * to say *where* its annotation is (by handing it to the constructor). Unlike
 * the deprecated RegExp readers (`tagParse`/`getTaglines`), this sees block
 * annotations.
 */
export class Annotations {
  constructor(private readonly annote: AnnotationsDef | undefined) {}

  /**
   * Raw annotation text strings (prefix + content) — all routes if `route` is
   * omitted, just that route's otherwise. The route-based successor to the
   * deprecated `getTaglines`. For source-mapped offsets (bring-your-own
   * parsers), see {@link forRoute}.
   */
  texts(route?: string): string[] {
    const items =
      route === undefined
        ? collectAnnotations(this.annote)
        : collectAnnotations(this.annote, route);
    return items.map(a => a.rawText);
  }

  /**
   * Your route's annotations as objects (`rawText` + `contentIndex` + `at`) —
   * the bring-your-own-parser door. A non-MOTLY app (e.g. JSON on its own
   * route) reads these to slice the content (`rawText.slice(contentIndex)`)
   * itself and map its parser's errors back to source via `at`. Malformed-prefix
   * annotations are excluded.
   */
  forRoute(route: string): AnnotationText[] {
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
