import type {Tag, TagError, SourceOrigin} from '@malloydata/malloy-tag';
import {TagParser} from '@malloydata/malloy-tag';
import type {Annotation, Note, DocumentLocation} from './model';
import type {LogMessage} from './lang';
import {parsePrefix} from './prefix';

export interface TagParseSpec {
  prefix?: RegExp;
}

/** One annotation and the route its prefix resolves to (`''` is MOTLY). */
export interface RoutedAnnotation {
  /** The annotation exactly as written — prefix + content. */
  rawText: string;
  /** Offset where the content begins; `rawText.slice(contentIndex)` is the content. */
  contentIndex: number;
  /** Where `rawText` begins in the source document. */
  at: DocumentLocation;
  /** The route this annotation's prefix resolves to. */
  route: string;
}

/** Every Note of an annotation, inherited first, in document order. */
function* notesInOrder(annote: Annotation): Generator<Note> {
  if (annote.inherits) yield* notesInOrder(annote.inherits);
  if (annote.blockNotes) yield* annote.blockNotes;
  if (annote.notes) yield* annote.notes;
}

/**
 * Collect annotations, using the shared prefix parser. With no `route`, returns
 * every annotation (the only way to reach one whose prefix is malformed). With a
 * `route`, returns only annotations on that route, excluding malformed prefixes.
 * Each result carries its own `route` either way.
 */
export function collectAnnotations(
  annote: Annotation | undefined,
  route?: string
): RoutedAnnotation[] {
  const result: RoutedAnnotation[] = [];
  for (const note of notesInOrder(annote ?? {})) {
    const parsed = parsePrefix(note.text);
    const matches =
      route === undefined ||
      (parsed.route === route && parsed.malformation !== 'malformed-route');
    if (matches) {
      result.push({
        rawText: note.text,
        contentIndex: parsed.contentIndex,
        at: note.at,
        route: parsed.route,
      });
    }
  }
  return result;
}

/**
 * Collect all matching Notes from an Annotation, walking the inherits
 * chain. Returns notes in inheritance order (inherited first).
 *
 * @deprecated RegExp prefix matching; use {@link collectAnnotations} with a route.
 */
function collectNotes(annote: Annotation, prefix?: RegExp): Note[] {
  const notes = [...notesInOrder(annote)];
  return prefix ? notes.filter(note => note.text.match(prefix)) : notes;
}

export function annotationToTaglines(
  annote: Annotation | undefined,
  prefix?: RegExp
): string[] {
  return collectNotes(annote || {}, prefix).map(n => n.text);
}

export interface MalloyTagParse {
  tag: Tag;
  log: LogMessage[];
}

/** Parse a run of annotation lines as MOTLY into one Tag, collecting errors. */
function parseTaglines(
  lines: ReadonlyArray<{text: string; at: DocumentLocation}>
): MalloyTagParse {
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
  annote: Annotation | undefined,
  route?: string
): MalloyTagParse;
/**
 * @deprecated Pass a route string. The RegExp `prefix` form cannot report
 * content offsets and matches against the whole annotation text.
 */
export function annotationToTag(
  annote: Annotation | undefined,
  spec: TagParseSpec
): MalloyTagParse;
export function annotationToTag(
  annote: Annotation | undefined,
  arg?: string | TagParseSpec
): MalloyTagParse {
  if (typeof arg === 'object') {
    const prefix = arg.prefix || /^##? /;
    return parseTaglines(collectNotes(annote ?? {}, prefix));
  }
  const matched = collectAnnotations(annote, arg ?? '');
  return parseTaglines(matched.map(a => ({text: a.rawText, at: a.at})));
}

function mapMalloyError(e: TagError, note: Note): LogMessage {
  // Calculate prefix length (same logic as stripPrefix in malloy-tag)
  let prefixLen = 0;
  if (note.text[0] === '#') {
    const skipTo = note.text.search(/[ \n]/);
    if (skipTo > 0) {
      prefixLen = skipTo;
    }
  }

  // Map error position to source location
  // e.line is 0-based line within the (stripped) input
  // e.offset is 0-based column within that line
  // TODO: For block annotations, lines > 0 have indentation stripped by
  // stripBlockIndent, so e.offset doesn't account for the removed columns.
  // This makes error squigglies misaligned on block annotation body lines.
  const line = note.at.range.start.line + e.line;
  const character =
    e.line === 0
      ? note.at.range.start.character + prefixLen + e.offset
      : e.offset;

  const loc = {line, character};
  return {
    code: 'tag-parse-error',
    severity: 'error',
    message: e.message,
    at: {
      url: note.at.url,
      range: {
        start: loc,
        end: loc,
      },
    },
  };
}
