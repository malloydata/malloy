import type {Tag, TagError} from '@malloydata/malloy-tag';
import {TagParser} from '@malloydata/malloy-tag';
import type {Annotation, Note} from './model';
import type {LogMessage} from './lang';

export interface TagParseSpec {
  prefix?: RegExp;
}

/**
 * Collect all matching Notes from an Annotation, walking the inherits
 * chain. Returns notes in inheritance order (inherited first).
 */
function collectNotes(annote: Annotation, prefix?: RegExp): Note[] {
  const inherited = annote.inherits
    ? collectNotes(annote.inherits, prefix)
    : [];
  const allNotes: Note[] = [];
  if (annote.blockNotes) {
    allNotes.push(...annote.blockNotes);
  }
  if (annote.notes) {
    allNotes.push(...annote.notes);
  }
  if (prefix) {
    const matching = allNotes.filter(note => note.text.match(prefix));
    return inherited.concat(matching);
  }
  return inherited.concat(allNotes);
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

// TODO: Error location mapping currently works by post-hoc mapping
// parse errors back to source locations using the Note's `at` field.
// The proper approach is to pass source location information into the
// MOTLY parser session so that errors come back with correct locations
// directly, eliminating the need for this remapping step.

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
    const noteParse = session.parse(note.text);
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
  // Calculate prefix length (same logic as parseTagLine)
  let prefixLen = 0;
  if (note.text[0] === '#') {
    const skipTo = note.text.indexOf(' ');
    if (skipTo > 0) {
      prefixLen = skipTo;
    }
  }

  // Map error position to source location
  // e.line is 0-based line within the (stripped) input
  // e.offset is 0-based column within that line
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
