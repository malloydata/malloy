enum ParseState {
  Normal,
  ReverseVirgule,
  Unicode,
}

// TODO this should probably live in it's own package, `malloy-common` or something
/**
 * Parses the interior of a string, doing all \ substitutions. In most cases
 * a lexical analyzer has already recognized this as a string. As a convenience,
 * strip off the quoting outer chartacters if asked, then parse the interior of
 * the string. The intention is to be compatible with JSON strings, in terms
 * of which \X substitutions are processed.
 * @param str is the string to parse
 * @param surround is the quoting character, default means quotes already stripped
 * @returns a string with the \ processing completed
 */
export function parseString(str: string, surround = ''): string {
  const inner =
    surround.length > 0 ? str.slice(surround.length, -surround.length) : str;
  let state = ParseState.Normal;
  let out = '';
  let unicode = '';
  for (const c of inner) {
    switch (state) {
      case ParseState.Normal: {
        if (c === '\\') {
          state = ParseState.ReverseVirgule;
        } else {
          out += c;
        }
        break;
      }
      case ParseState.ReverseVirgule: {
        if (c === 'u') {
          state = ParseState.Unicode;
          unicode = '';
          continue;
        }
        state = ParseState.Normal;
        if (c === 'b') {
          out += '\b';
        } else if (c === 'f') {
          out += '\f';
        } else if (c === 'n') {
          out += '\n';
        } else if (c === 'r') {
          out += '\r';
        } else if (c === 't') {
          out += '\t';
        } else {
          out += c;
        }
        break;
      }
      case ParseState.Unicode: {
        if ('ABCDEFabcdef0123456789'.includes(c)) {
          unicode += c;
          if (unicode.length === 4) {
            out += String.fromCharCode(parseInt(unicode, 16));
            state = ParseState.Normal;
          }
        } else {
          // Correct tokenization would mean this is "not possible"
          state = ParseState.Normal;
        }
      }
    }
  }
  return out;
}
