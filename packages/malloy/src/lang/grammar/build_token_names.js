/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Reconstructs the spelling of Malloy's keyword tokens from the marked section
// of MalloyLexer.g4, so parse errors can say `aggregate:` instead of the
// SHOUTING symbolic name ANTLR gives keywords built from letter fragments
// (`AGGREGATE: A G G R E G A T E SPACE_CHAR* ':'`). The trailing colon is part
// of the rule, so it comes through for free.
//
// Membership is declared, not guessed: every rule inside the section must
// reconstruct to a clean keyword, or the build FAILS. Keep anything fancier
// (literals, patterns, punctuation) outside the markers.

/* eslint-disable no-console */

const {readFileSync, writeFileSync} = require('fs');
const path = require('path');

const grammarDir = __dirname;
const lexerFile = path.join(grammarDir, 'MalloyLexer.g4');
const outFile = path.join(
  path.dirname(grammarDir),
  'lib',
  'Malloy',
  'keyword-display-names.ts'
);

// Markers must stand alone on their own comment line, so a passing prose
// mention of the marker name never gets mistaken for the delimiter.
const BEGIN = /^[ \t]*\/\/[ \t]*KEYWORDS-BEGIN[ \t]*$/m;
const END = /^[ \t]*\/\/[ \t]*KEYWORDS-END[ \t]*$/m;

function fail(message) {
  console.error(`build_token_names: ${message}`);
  process.exit(1);
}

function keywordSection(grammarText) {
  const begin = grammarText.match(BEGIN);
  const end = grammarText.match(END);
  if (!begin || !end || end.index < begin.index) {
    fail(
      'could not find // KEYWORDS-BEGIN .. // KEYWORDS-END in MalloyLexer.g4'
    );
  }
  // Drop comments so only grammar rules remain. No keyword body contains a
  // block comment or a `;`, so a plain split is safe within the section.
  return grammarText
    .slice(begin.index + begin[0].length, end.index)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

// Break a keyword rule body into atoms. Returns null for anything the scanner
// cannot classify, which the caller turns into a hard failure.
function tokenizeBody(body) {
  const atoms = [];
  let i = 0;
  const n = body.length;
  while (i < n) {
    const c = body[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      let raw = '';
      while (j < n && body[j] !== "'") {
        if (body[j] === '\\') {
          raw += body[j + 1];
          j += 2;
        } else {
          raw += body[j];
          j++;
        }
      }
      if (j >= n) return null;
      atoms.push({kind: 'literal', text: raw});
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(body[j])) j++;
      atoms.push({kind: 'name', text: body.slice(i, j)});
      i = j;
      continue;
    }
    if ('?*'.includes(c)) {
      atoms.push({kind: 'quant', text: c});
      i++;
      continue;
    }
    return null;
  }
  return atoms;
}

// A single-letter `name` is a case-insensitive letter fragment; `SPACE_CHAR` is
// the inter-token whitespace fragment; one-char literals carry `_` and `:`.
function roleOf(atom) {
  if (atom.kind === 'name') {
    if (atom.text.length === 1) return 'letter';
    if (atom.text === 'SPACE_CHAR') return 'spaceChar';
    return 'other';
  }
  if (atom.kind === 'literal') {
    return atom.text.length === 1 ? 'oneCharLiteral' : 'other';
  }
  if (atom.kind === 'quant') return 'quant';
  return 'other';
}

function reconstruct(name, body) {
  const atoms = tokenizeBody(body);
  if (atoms === null) {
    fail(`rule ${name}: cannot parse body — unrecognized grammar syntax`);
  }
  const roles = atoms.map(roleOf);
  const bad = atoms.find((_, k) => roles[k] === 'other');
  if (bad) {
    fail(
      `rule ${name}: unexpected '${bad.text}' in keyword section — keep ` +
        'non-keyword rules outside KEYWORDS-BEGIN..KEYWORDS-END'
    );
  }
  // A letter (or SPACE_CHAR) immediately followed by `?`/`*` is optional and
  // dropped (handles plurals like `DAYS?`); SPACE_CHAR is never part of the
  // spelling; one-char literals contribute `_` and `:`.
  let word = '';
  for (let k = 0; k < atoms.length; k++) {
    const role = roles[k];
    const optional = roles[k + 1] === 'quant';
    if (role === 'quant' || role === 'spaceChar' || optional) continue;
    if (role === 'letter') word += atoms[k].text.toLowerCase();
    else if (role === 'oneCharLiteral') word += atoms[k].text;
  }
  if (!/^[a-z][a-z0-9_]*:?$/.test(word)) {
    fail(`rule ${name}: reconstructed "${word}" is not a clean keyword`);
  }
  return word;
}

function extractKeywords(grammarText) {
  const section = keywordSection(grammarText);
  const result = {};
  for (const rawRule of section.split(';')) {
    const rule = rawRule.trim();
    if (rule === '') continue;
    const colon = rule.indexOf(':');
    if (colon < 0) {
      fail(`malformed entry in keyword section: "${rule}"`);
    }
    const name = rule.slice(0, colon).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      fail(`keyword section contains a non-token-name rule head: "${name}"`);
    }
    result[name] = reconstruct(name, rule.slice(colon + 1));
  }
  return result;
}

const grammarText = readFileSync(lexerFile, 'utf-8');
const table = extractKeywords(grammarText);
const names = Object.keys(table).sort();
if (names.length === 0) fail('no keywords harvested — is the section empty?');

const lines = names.map(n => `  ${n}: ${JSON.stringify(table[n])},`);
const banner = `/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// GENERATED by src/lang/grammar/build_token_names.js from the
// KEYWORDS-BEGIN..KEYWORDS-END section of MalloyLexer.g4. Do not edit by hand.
// Maps a keyword token's symbolic name to the spelling a user types (including
// the trailing colon for statement keywords), for parser error messages.
// Run \`npm run codegen\` to regenerate.

export const KEYWORD_DISPLAY_NAMES: Record<string, string> = {
${lines.join('\n')}
};
`;

writeFileSync(outFile, banner);
console.log(
  `build_token_names: wrote ${names.length} keyword names to ${path.relative(
    process.cwd(),
    outFile
  )}`
);
