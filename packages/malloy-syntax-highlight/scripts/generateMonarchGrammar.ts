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
const M_ROOT_REFERENCE = 'root';
const M_POP = '@pop';
const M_REGEXP_INDEX = 0;
const M_TOKENS_INDEX = 1;
const TM_CAPTURE_OVERRIDE_KEY = '0';
const TIGNORE_CASE_FLAG = '(?i)';
const TM_SOURCE_PREFIX = 'source.';
const DEFAULT_TOKEN = '';
const IGNORE_CASE = true;
const END_STATE_SUFFIX = '_end';

// TODO: Move to config file with other constants (platform dependent)?
const TOKENS_MAP = {};

function instanceOfTextMateBeginEndRule(
  object: any
): object is TextMateBeginEndRule {
  return 'begin' in object && 'end' in object;
}

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

function textmateToMonarchInclude(includeString: TextMate.IncludeString) {
  return includeString.replace('#', '@').replaceAll('-', '_');
}

function repositoryToReference(repositoryKey: TextMateRepositoryKey) {
  return repositoryKey.replaceAll('-', '_');
}

function includeToReference(includeString: TextMate.IncludeString) {
  return includeString.slice(1).replaceAll('-', '_');
}

function cleanMatchString(matchString: TextMate.RegExpString) {
  if (matchString.startsWith(TIGNORE_CASE_FLAG)) {
    return matchString.slice(TIGNORE_CASE_FLAG.length);
  } else {
    return matchString;
  }
}

function serializeRegex(match: MonarchRegExpString) {
  let serializedMatch = match.replaceAll('/', '\\/');
  return '/' + serializedMatch + '/';
}

function numRegexGroups(regex: MonarchRegExpString) {
  // courtesty of https://stackoverflow.com/questions/16046620/regex-to-count-the-number-of-capturing-groups-in-a-regex
  const regexGroups = new RegExp(regex.toString() + '|').exec('');
  if (regexGroups) {
    return regexGroups.length - 1;
  } else {
    return 0;
  }
}

function translateToken(token: TextMateScopeName) {
  return token in TOKENS_MAP ? TOKENS_MAP[token] : token.replaceAll('-', '.');
}

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

function searchSourceInclude(pattern: TextMate.IRawRule) {
  if (pattern.patterns) {
    for (const subpattern of pattern.patterns) {
      if (subpattern.include?.startsWith(TM_SOURCE_PREFIX)) {
        return subpattern.include.slice(TM_SOURCE_PREFIX.length);
      }
    }
  }
}

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

function getIgnoreString(
  tokenizer: MonarchTokenizer,
  currentRef: ReferenceString
) {
  let ignoreString = '';
  const ignoreChars: Set<string> = new Set();
  getIgnoreChars(tokenizer, currentRef, ignoreChars);
  for (let char of ignoreChars) {
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

function nameToNewRef(name: TextMateScopeName) {
  return name.replaceAll('.', '_').replaceAll('-', '_') + END_STATE_SUFFIX;
}

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

export function generateMonarchGrammar() {
  // TODO: Validate command line args
  const textmateSrc = readFileSync(process.argv[ARGV_IN], 'utf-8');
  const textmateParse: TextMate.IRawGrammar = JSON.parse(textmateSrc);
  const references: TextMateRepositoryMap = {};
  flattenRepositories(textmateParse.repository, references);
  const monarch: Monarch.IMonarchLanguage = {
    defaultToken: DEFAULT_TOKEN,
    // TODO: Determine monarch.tokenPostfix from input filename
    tokenPostfix: '.malloy',
    ignoreCase: IGNORE_CASE,
    includeLF: true,
    tokenizer: {
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

function writeOutput(filename: string, monarch: Monarch.IMonarchLanguage) {
  writeFileSync(
    filename,
    `
export default {
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
        appendFileSync(filename, `[\n`, 'utf-8');
        appendFileSync(filename, `${rule[M_REGEXP_INDEX]},\n`, 'utf-8');
        appendFileSync(
          filename,
          `${inspect(rule[M_TOKENS_INDEX], {depth: null})},\n`,
          'utf-8'
        );
        appendFileSync(filename, `],\n`, 'utf-8');
      }
    }
    appendFileSync(filename, `],\n`, 'utf-8');
  }
  appendFileSync(filename, `}\n};`, 'utf-8');
}

generateMonarchGrammar();
