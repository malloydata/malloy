import type {Tag, TagError, SourceOrigin} from '@malloydata/malloy-tag';
import {TagParser} from '@malloydata/malloy-tag';
import type {Annotation, Note, DocumentLocation} from './model';
import type {LogMessage} from './lang';
import {parsePrefix} from './prefix';

export interface TagParseSpec {
  prefix?: RegExp;
}

/** One annotation addressed to a requested route, in inheritance order. */
export interface AnnotationText {
  /** The annotation exactly as written — prefix + content. */
  rawText: string;
  /** Offset where the content begins; `rawText.slice(contentIndex)` is the content. */
  contentIndex: number;
  /** Where `rawText` begins in the source document. */
  at: DocumentLocation;
}

/** An {@link AnnotationText} that also carries its own route (`''` is MOTLY). */
export interface RoutedAnnotation extends AnnotationText {
  route: string;
}

/** Every Note of an annotation, inherited first, in document order. */
function* notesInOrder(annote: Annotation): Generator<Note> {
  if (annote.inherits) yield* notesInOrder(annote.inherits);
  if (annote.blockNotes) yield* annote.blockNotes;
  if (annote.notes) yield* annote.notes;
}

/**
 * Collect annotations by route, using the shared prefix parser.
 * - no route: every annotation, each carrying its own `route` — the only way to
 *   reach an annotation whose prefix is malformed.
 * - a route: only annotations on that route, `route` omitted from each result
 *   (the caller passed it). Malformed-prefix annotations are never returned here.
 */
export function collectAnnotations(
  annote: Annotation | undefined
): RoutedAnnotation[];
export function collectAnnotations(
  annote: Annotation | undefined,
  route: string
): AnnotationText[];
export function collectAnnotations(
  annote: Annotation | undefined,
  route?: string
): RoutedAnnotation[] | AnnotationText[] {
  const notes = notesInOrder(annote ?? {});
  if (route === undefined) {
    return Array.from(notes, note => {
      const {route: noteRoute, contentIndex} = parsePrefix(note.text);
      return {rawText: note.text, contentIndex, at: note.at, route: noteRoute};
    });
  }
  const matching: AnnotationText[] = [];
  for (const note of notes) {
    const parsed = parsePrefix(note.text);
    if (parsed.route === route && parsed.malformation !== 'malformed-route') {
      matching.push({
        rawText: note.text,
        contentIndex: parsed.contentIndex,
        at: note.at,
      });
    }
  }
  return matching;
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

export function annotationToTag(
  annote: Annotation | undefined,
  spec: TagParseSpec = {}
): MalloyTagParse {
  const prefix = spec.prefix || /^##? /;
  annote ||= {};
  const notes = collectNotes(annote, prefix);
  const allErrs: LogMessage[] = [];
  const session = new TagParser();
  for (const note of notes) {
    const origin: SourceOrigin = {
      url: note.at.url,
      startLine: note.at.range.start.line,
      startColumn: note.at.range.start.character,
    };
    const noteParse = session.parseAnnotation(note.text, origin);
    allErrs.push(
      ...noteParse.log.map((e: TagError) => mapMalloyError(e, note))
    );
  }
  const tag = session.finish();
  const refErrors = tag.validateReferences();
  for (const refError of refErrors) {
    allErrs.push({
      code: 'tag-reference-error',
      severity: 'warn',
      message: refError,
    });
  }
  return {tag, log: allErrs};
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
