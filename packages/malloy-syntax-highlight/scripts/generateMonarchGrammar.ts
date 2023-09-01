import {readFileSync, writeFileSync, appendFileSync} from 'fs';
import {inspect} from 'util';
import {languages as Monarch} from 'monaco-editor';
import {ScopeName as TextMateScopeName} from 'vscode-textmate/release/theme';

import * as TextMate from 'vscode-textmate/release/rawGrammar';

export type MonarchRegExpString = string;
export type MonarchIncludeString = string;
export type MonarchTokenizer = {
  [name: ReferenceString]: Monarch.IMonarchLanguageRule[];
};
export type MonarchPrimitiveAction =
  | Monarch.IShortMonarchLanguageAction
  | Monarch.IShortMonarchLanguageAction[];
export type MonarchActions = (
  | Monarch.IShortMonarchLanguageAction
  | Monarch.IExpandedMonarchLanguageAction
)[];

export type TextMateRepositoryKey = string;
export type TextMateTokenInfo = TextMateScopeName | TextMate.IRawCaptures;
export interface TextMateRepositoryMap {
  [name: string]: TextMate.IRawRule;
}
interface TextMateBeginEndRule extends TextMate.IRawRule {
  readonly begin: TextMate.RegExpString;
  readonly end: TextMate.RegExpString;
  readonly patterns?: TextMate.IRawRule[];
}

export type ReferenceString = string;
export type LanguageId = string;

const ARGV_IN = 2;
const ARGV_OUT = 3;
const DEFAULT_TOKEN = '';
const IGNORE_CASE = true;
const END_STATE_SUFFIX = '_end';
// Constants implicitly defined by Monarch
const M_ROOT_REFERENCE = 'root';
const M_POP = '@pop';
const M_REGEXP_INDEX = 0;
const M_TOKENS_INDEX = 1;
// Constants implicitly defined by TextMate
const TM_CAPTURE_OVERRIDE_KEY = '0';
const TIGNORE_CASE_FLAG = '(?i)';
const TM_SOURCE_PREFIX = 'source.';

const TOKENS_MAP = {
  'punctuation.definition.comment.begin': 'comment.block',
  'punctuation.definition.comment': 'comment.line',
  'punctuation.definition.comment.end': 'comment.block',
  'punctuation.definition.string.begin': 'string.quoted',
  'punctuation.definition.string.end': 'string.quoted',
};

/** Custom guard to check if a rule has begin/end fields */
function instanceOfTextMateBeginEndRule(
  object: any
): object is TextMateBeginEndRule {
  return 'begin' in object && 'end' in object;
}

/** Build a flattened map of repository key to their definitions */
function flattenRepositories(
  root: TextMateRepositoryMap,
  references: TextMateRepositoryMap
) {
  for (const [key, value] of Object.entries(root)) {
    references[repositoryToReference(key)] = value;
    if (value.repository) {
      flattenRepositories(value.repository, references);
    }
  }
}

/*
 * Transforms TextMate include strings to Monarch include strings
 * Assumes that TextMate repository keys use kebab or snake case
 */
function textmateToMonarchInclude(includeString: TextMate.IncludeString) {
  return includeString.replace('#', '@').replaceAll('-', '_');
}

/*
 * Translates a TextMate repository key to snake case for consumption
 * within the script, as all TextMate repository references and Monarch state
 * references use snake case
 */
function repositoryToReference(repositoryKey: TextMateRepositoryKey) {
  return repositoryKey.replaceAll('-', '_');
}

/** Retrieves the snake case reference key from a TextMate include string */
function includeToReference(includeString: TextMate.IncludeString) {
  return includeString.slice(1).replaceAll('-', '_');
}

/*
 * Removes the top-level Oniguruma case-insensitive flag if present as
 * our Monarch definition defaults to case-insensitive behavior
 */
function cleanMatchString(matchString: TextMate.RegExpString) {
  if (matchString.startsWith(TIGNORE_CASE_FLAG)) {
    return matchString.slice(TIGNORE_CASE_FLAG.length);
  } else {
    return matchString;
  }
}

/*
 * Serialize regex so that later calls to fs.writeFile write what would be a valid regex definition in .js/.ts files
 * This is a workaround to JSON.stringify not natively handling regex serialization
 */
function serializeRegex(match: MonarchRegExpString) {
  const serializedMatch = match.replaceAll('/', '\\/');
  return '/' + serializedMatch + '/';
}

/** Returns the number of outermost regex groups in a regex */
function numRegexGroups(regex: MonarchRegExpString) {
  // courtesty of https://stackoverflow.com/questions/16046620/regex-to-count-the-number-of-capturing-groups-in-a-regex
  const regexGroups = new RegExp(regex.toString() + '|').exec('');
  if (regexGroups) {
    return regexGroups.length - 1;
  } else {
    return 0;
  }
}

/*
 * Translates thematically meaningless tokens to thematically meaningful tokens
 * May also be used for environment-to-environment mappings
 */
function translateToken(token: TextMateScopeName) {
  return token in TOKENS_MAP ? TOKENS_MAP[token] : token.replaceAll('-', '.');
}

/** Returns a Monarch token info for TextMate rules with captures or beginCaptures and endCaptures */
function generateCaptureTokens(
  match: MonarchRegExpString,
  captures: TextMate.IRawCaptures
): Monarch.IShortMonarchLanguageAction[] {
  const numGroups = numRegexGroups(match);
  const tokens: Monarch.IShortMonarchLanguageAction[] = new Array(
    numGroups
  ).fill(DEFAULT_TOKEN);
  for (const [key, subpattern] of Object.entries(captures)) {
    const i = +key - 1;
    if (subpattern.name) tokens[i] = translateToken(subpattern.name);
  }
  return tokens;
}

/** Returns whether a TextMate rule embeds another language */
function searchSourceInclude(pattern: TextMate.IRawRule) {
  if (pattern.patterns) {
    for (const subpattern of pattern.patterns) {
      if (subpattern.include?.startsWith(TM_SOURCE_PREFIX)) {
        return subpattern.include.slice(TM_SOURCE_PREFIX.length);
      }
    }
  }
}

/** Returns Monarch token info for any TextMate rule */
function generateTokens(
  matchString: MonarchRegExpString,
  tokenInfo: TextMateTokenInfo
): MonarchPrimitiveAction {
  if (typeof tokenInfo === 'string') {
    return translateToken(tokenInfo);
  } else if (tokenInfo[TM_CAPTURE_OVERRIDE_KEY]?.name) {
    return translateToken(tokenInfo[TM_CAPTURE_OVERRIDE_KEY].name);
  } else {
    return generateCaptureTokens(matchString, tokenInfo);
  }
}

/** Returns a Monarch rule given its TextMate counterpart */
function generateRule(
  match: TextMate.RegExpString,
  tokenInfo: TextMateTokenInfo,
  actionExpansion?: Partial<Monarch.IExpandedMonarchLanguageAction>
): Monarch.IMonarchLanguageRule {
  const cleanedMatch = cleanMatchString(match);
  if (!actionExpansion) {
    return [
      serializeRegex(cleanedMatch),
      generateTokens(cleanedMatch, tokenInfo),
    ];
  } else {
    const tokens = generateTokens(cleanedMatch, tokenInfo);
    if (typeof tokens === 'string') {
      return [
        serializeRegex(cleanedMatch),
        {
          ...actionExpansion,
          token: tokens,
        },
      ];
    } else {
      const newToken = tokens[tokens.length - 1];
      const newTokens: MonarchActions = tokens;
      newTokens[newTokens.length - 1] = {
        ...actionExpansion,
        token: newToken,
      };
      return [serializeRegex(cleanedMatch), newTokens];
    }
  }
}

/** Parses a begin/end rule */
function generateBeginEndRule(
  p: TextMateBeginEndRule,
  tokenizer: MonarchTokenizer,
  currentRef: ReferenceString,
  references: TextMateRepositoryMap,
  embeddedLanguage?: LanguageId
) {
  const state = tokenizer[currentRef];
  const beginTextMateTokenInfo: TextMateTokenInfo = p.beginCaptures
    ? p.beginCaptures
    : p.captures
    ? p.captures
    : p.name
    ? p.name
    : DEFAULT_TOKEN;
  const endTextMateTokenInfo: TextMateTokenInfo = p.endCaptures
    ? p.endCaptures
    : p.captures
    ? p.captures
    : p.name
    ? p.name
    : DEFAULT_TOKEN;
  if (embeddedLanguage) {
    const ref = embeddedLanguage + END_STATE_SUFFIX;
    const beginRule = generateRule(p.begin, beginTextMateTokenInfo, {
      next: '@' + ref,
      nextEmbedded: embeddedLanguage,
    });
    const endRule = generateRule(p.end, endTextMateTokenInfo, {
      next: M_POP,
      nextEmbedded: M_POP,
    });
    state.push(beginRule);
    if (!tokenizer[ref]) {
      tokenizer[ref] = [endRule];
    }
  } else {
    const newRef = p.name
      ? nameToNewRef(p.name)
      : currentRef + END_STATE_SUFFIX;
    const beginRule = generateRule(p.begin, beginTextMateTokenInfo, {
      next: '@' + newRef,
    });
    const endRule = generateRule(p.end, endTextMateTokenInfo, {next: M_POP});
    state.push(beginRule);
    tokenizer[newRef] = [endRule];
    if (p.patterns) {
      for (const pattern of p.patterns) {
        generateMonarchRules(pattern, references, tokenizer, newRef);
      }
    }
    if (p.name) {
      const ignoreChars = getIgnoreString(tokenizer, newRef);
      if (ignoreChars.length !== 0) {
        tokenizer[newRef].push([
          serializeRegex('[^' + cleanMatchString(ignoreChars) + ']+'),
          translateToken(p.name),
        ]);
        tokenizer[newRef].push([
          serializeRegex('[' + cleanMatchString(ignoreChars) + ']'),
          translateToken(p.name),
        ]);
      }
    }
  }
}

/**
 * Returns a list of the beginning characters for a Monarch state's subrules
 * This function's return value is used to generate two new subrule for a state:
 *  - one that applies default styling to everything between begin/end rules except these character
 *  - one that finally applies default styling to these characters
 * This prevents Monarch from getting stuck in a given state which would would happen if we used .* to style
 * everything between begin/end rules
 */
function getIgnoreString(
  tokenizer: MonarchTokenizer,
  currentRef: ReferenceString
) {
  let ignoreString = '';
  const ignoreChars: Set<string> = new Set();
  getIgnoreChars(tokenizer, currentRef, ignoreChars);
  for (const char of ignoreChars) {
    ignoreString += char;
  }
  return ignoreString;
}

function getIgnoreChars(
  tokenizer: MonarchTokenizer,
  currentRef: ReferenceString,
  ignoreChars: Set<string>
) {
  const state = tokenizer[currentRef];
  for (const rule of state) {
    if (Array.isArray(rule)) {
      const beginChar =
        typeof rule[M_REGEXP_INDEX] === 'string' &&
        rule[M_REGEXP_INDEX][1] === '\\'
          ? rule[M_REGEXP_INDEX].slice(1, 3)
          : rule[M_REGEXP_INDEX][1];
      if (!ignoreChars.has(beginChar)) {
        ignoreChars.add(beginChar);
      }
    } else {
      const expandedRule: Monarch.IExpandedMonarchLanguageRule = rule;
      if (expandedRule.include) {
        getIgnoreChars(
          tokenizer,
          includeToReference(expandedRule.include),
          ignoreChars
        );
      }
    }
  }
}

/**
 * Returns a new reference representing the key for the new Monarch state that the current
 * Monarch state's rules will send the tokenizer to when parsed
 */
function nameToNewRef(name: TextMateScopeName) {
  return name.replaceAll('.', '_').replaceAll('-', '_') + END_STATE_SUFFIX;
}

/** Returns a new Monarch grammar generated by walking the
 * TextMate rule tree and parsing each rule
 */
function generateMonarchRules(
  scope: TextMate.IRawRule,
  references: TextMateRepositoryMap,
  tokenizer: MonarchTokenizer,
  currentRef: ReferenceString
) {
  const state = tokenizer[currentRef];
  const patterns = scope.patterns ? scope.patterns : [scope];
  for (const pattern of patterns) {
    if (pattern.include) {
      state.push({
        include: textmateToMonarchInclude(pattern.include),
      });
      const ref = includeToReference(pattern.include);
      tokenizer[ref] = [];
      generateMonarchRules(references[ref], references, tokenizer, ref);
    } else if (instanceOfTextMateBeginEndRule(pattern)) {
      const embeddedLanguage = searchSourceInclude(pattern);
      generateBeginEndRule(
        pattern,
        tokenizer,
        currentRef,
        references,
        embeddedLanguage
      );
    } else if (pattern.match) {
      const tokenInfo = pattern.captures
        ? pattern.captures
        : pattern.name
        ? pattern.name
        : DEFAULT_TOKEN;
      const rule = generateRule(pattern.match, tokenInfo);
      state.push(rule);
    }
  }
}

/** Generates and writes a Monarch grammar output file from a TextMate grammar file */
export function generateMonarchGrammar() {
  // TODO: Validate command line args
  const textmateSrc = readFileSync(process.argv[ARGV_IN], 'utf-8');
  const textmateParse: TextMate.IRawGrammar = JSON.parse(textmateSrc);
  const references: TextMateRepositoryMap = {};
  flattenRepositories(textmateParse.repository, references);
  const monarch: Monarch.IMonarchLanguage = {
    'defaultToken': DEFAULT_TOKEN,
    // TODO: Determine monarch.tokenPostfix from input filename
    'tokenPostfix': '.malloy',
    'ignoreCase': IGNORE_CASE,
    'includeLF': true,
    'tokenizer': {
      root: [],
    },
  };
  generateMonarchRules(
    {
      patterns: textmateParse.patterns,
    },
    references,
    monarch.tokenizer,
    M_ROOT_REFERENCE
  );
  writeOutput(process.argv[ARGV_OUT], monarch);
}

/** Write the generated Monarch object to a file on disk */
function writeOutput(filename: string, monarch: Monarch.IMonarchLanguage) {
  writeFileSync(
    filename,
    `
import {languages as Monaco} from 'monaco-editor';

export const monarch: Monaco.IMonarchLanguage = {
includeLF: ${monarch.includeLF},
defaultToken: '${monarch.defaultToken}',
tokenPostfix: '${monarch.tokenPostfix}',
ignoreCase: ${monarch.ignoreCase},
tokenizer: {
`,
    'utf-8'
  );
  for (const [key, rules] of Object.entries(monarch.tokenizer)) {
    appendFileSync(filename, `\t${key}: [\n`, 'utf-8');
    for (const rule of rules) {
      if (!Array.isArray(rule)) {
        appendFileSync(filename, `${inspect(rule, {depth: null})},\n`, 'utf-8');
      } else {
        appendFileSync(filename, '[\n', 'utf-8');
        appendFileSync(filename, `${rule[M_REGEXP_INDEX]},\n`, 'utf-8');
        appendFileSync(
          filename,
          `${inspect(rule[M_TOKENS_INDEX], {depth: null})},\n`,
          'utf-8'
        );
        appendFileSync(filename, '],\n', 'utf-8');
      }
    }
    appendFileSync(filename, '],\n', 'utf-8');
  }
  appendFileSync(filename, '}\n};', 'utf-8');
}

generateMonarchGrammar();
