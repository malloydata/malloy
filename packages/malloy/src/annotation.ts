import type {TagError} from '@malloydata/malloy-tag';
import {Tag, TagParser} from '@malloydata/malloy-tag';
import type {Annotation, Note} from './model';
import type {LogMessage} from './lang';

export interface TagParseSpec {
  prefix?: RegExp;
  extending?: Tag;
}

export function annotationToTaglines(
  annote: Annotation | undefined,
  prefix?: RegExp
): string[] {
  annote ||= {};
  const tagLines = annote.inherits
    ? annotationToTaglines(annote.inherits, prefix)
    : [];
  function prefixed(na: Note[] | undefined): string[] {
    const ret: string[] = [];
    for (const n of na || []) {
      if (prefix === undefined || n.text.match(prefix)) {
        ret.push(n.text);
      }
    }
    return ret;
  }
  return tagLines.concat(prefixed(annote.blockNotes), prefixed(annote.notes));
}

export interface MalloyTagParse {
  tag: Tag;
  log: LogMessage[];
}

export function annotationToTag(
  annote: Annotation | undefined,
  spec: TagParseSpec = {}
): MalloyTagParse {
  let extending = spec.extending || new Tag();
  const prefix = spec.prefix || /^##? /;
  annote ||= {};
  const allErrs: LogMessage[] = [];
  if (annote.inherits) {
    const inherits = annotationToTag(annote.inherits, spec);
    allErrs.push(...inherits.log);
    extending = inherits.tag;
  }
  const allNotes: Note[] = [];
  if (annote.blockNotes) {
    allNotes.push(...annote.blockNotes);
  }
  if (annote.notes) {
    allNotes.push(...annote.notes);
  }
  const matchingNotes: Note[] = [];
  for (const note of allNotes) {
    if (note.text.match(prefix)) {
      matchingNotes.push(note);
    }
  }
  const session = new TagParser(extending);
  for (const note of matchingNotes) {
    const noteParse = session.parse(note.text);
    allErrs.push(
      ...noteParse.log.map((e: TagError) => mapMalloyError(e, note))
    );
  }
  extending = session.finish();
  // Validate references and add any warnings
  const refErrors = extending.validateReferences();
  for (const refError of refErrors) {
    allErrs.push({
      code: 'tag-reference-error',
      severity: 'warn',
      message: refError,
    });
  }
  return {tag: extending, log: allErrs};
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
