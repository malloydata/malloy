/*
 *
 * A script to generate the Monarch syntax highlighting grammar
 * from the TextMate grammar
 *
 * Current limitations:
 * 1. The TextMate grammar must
 *     - be written in TextMate 1.5.x
 *     - define all repository keys in snake case (current version only supports snake, but kebab is maintaiable too)
 *     - supply regex match strings that, barring a top-level (?i) flag, are semantically identical, valid regex in JS
 *     - supply regex that contain exactly as many top-level capture groups as there could be captures (Monarch requirement)
 *     - use (?:) to prevent capturing inner regex groups, which is the same in both regex dialects (Monarch requirement)
 *     - have unique values for the name field on begin/end rules
 * 2. While TextMate support multiple token classes per pattern via begin/end, caputres, and name fields,
 *     Monarch only support one token class per pattern. This script takes a specificity-first approach to
 *     mapping many tokens to one. That is:
 *        a. Begin and end tokens will be always applied to begin and end patterns first
 *        b. If no begin/end tokens are defined, the captures field will be used to highlight begin and end patterns
 *        c. If no captures tokens are provided, the name field will be used to style both the begin/end patterns and everything in between
 *            (In begin/end rules, the name is applied to everything between begin/end by default, but in non-begin/end rules,
 *             the captures field overrides the provided name)
 * 3. Only one level of language embedding is currently supported. In future versions, each
 *     Malloy context will always need to be one nesting level away from another Malloy
 *     context. This is driven by the absence of grammar self-references in Monarch that
 *     only allow us to pop the current Malloy context, not push a new one.
 *
 */

import {readFileSync, writeFileSync, appendFileSync} from 'fs';
const util = require('util');

// TextMate typings, not all of which are exported by vscode-textmate
namespace TextMate {
  // TODO: Convert namespace to imports
  export type RegExpString = string;

  export type ScopeName = string;

  export type IncludeString = string;

  export interface IRawGrammar {
    repository: IRawRepository;
    readonly scopeName: ScopeName;
    readonly patterns: IRawRule[];
    readonly injections?: {[expression: string]: IRawRule};
    readonly injectionSelector?: string;

    readonly fileTypes?: string[];
    readonly name?: string;
    readonly firstLineMatch?: string;
  }

  export type IRawRepository = IRawRepositoryMap;

  export interface IRawRepositoryMap {
    [name: string]: IRawRule;
  }

  export interface IRawRule {
    readonly include?: IncludeString;

    readonly name?: ScopeName;
    readonly contentName?: ScopeName;

    readonly match?: RegExpString;
    readonly captures?: IRawCaptures;
    readonly begin?: RegExpString;
    readonly beginCaptures?: IRawCaptures;
    readonly end?: RegExpString;
    readonly endCaptures?: IRawCaptures;
    readonly while?: RegExpString;
    readonly whileCaptures?: IRawCaptures;
    readonly patterns?: IRawRule[];

    readonly repository?: IRawRepository;

    readonly applyEndPatternLast?: boolean;
  }

  export type IRawCaptures = IRawCapturesMap;

  export interface IRawCapturesMap {
    [captureId: string]: IRawRule;
  }
}

// Monaco typings, some of which were modified for this script
namespace Monaco {
    // TODO: Convert namespace to imports
  export interface IMonarchLanguage {
    /**
     * map from string to ILanguageRule[]
     */
    tokenizer: {
        [name: string]: IMonarchLanguageRule[];
    };
    /**
     * is the language case insensitive?
     */
    ignoreCase?: boolean;
    /**
     * is the language unicode-aware? (i.e., /\u{1D306}/)
     */
    unicode?: boolean;
    /**
     * if no match in the tokenizer assign this token class (default 'source')
     */
    defaultToken?: string;
    /**
     * for example [['{','}','delimiter.curly']]
     */
    brackets?: IMonarchLanguageBracket[];
    /**
     * start symbol in the tokenizer (by default the first entry is used)
     */
    start?: string;
    /**
     * attach this to every token class (by default '.' + name)
     */
    tokenPostfix?: string;
    /**
     * include line feeds (in the form of a \n character) at the end of lines
     * Defaults to false
     */
    includeLF?: boolean;
    /**
     * Other keys that can be referred to by the tokenizer.
     */
    [key: string]: any;
  }

  /**
  * A rule is either a regular expression and an action
  * 		shorthands: [reg,act] == { regex: reg, action: act}
  *		and       : [reg,act,nxt] == { regex: reg, action: act{ next: nxt }}
  */
  export type IShortMonarchLanguageRule1 = [string, IMonarchLanguageAction];

  export type IShortMonarchLanguageRule2 = [string, IMonarchLanguageAction, string];

  export interface IExpandedMonarchLanguageRule {
    /**
     * match tokens
     */
    regex?: string | RegExp;
    /**
     * action to take on match
     */
    action?: IMonarchLanguageAction;
    /**
     * or an include rule. include all rules from the included state
     */
    include?: string;
  }

  export type IMonarchLanguageRule = IShortMonarchLanguageRule1 | IShortMonarchLanguageRule2 | IExpandedMonarchLanguageRule;

  /**
  * An action is either an array of actions...
  * ... or a case statement with guards...
  * ... or a basic action with a token value.
  */
  export type IShortMonarchLanguageAction = string;

  export interface IExpandedMonarchLanguageAction {
    /**
     * array of actions for each parenthesized match group
     */
    group?: IMonarchLanguageAction[];
    /**
     * map from string to ILanguageAction
     */
    cases?: Object;
    /**
     * token class (ie. css class) (or "@brackets" or "@rematch")
     */
    token?: string;
    /**
     * the next state to push, or "@push", "@pop", "@popall"
     */
    next?: string;
    /**
     * switch to this state
     */
    switchTo?: string;
    /**
     * go back n characters in the stream
     */
    goBack?: number;
    /**
     * @open or @close
     */
    bracket?: string;
    /**
     * switch to embedded language (using the mimetype) or get out using "@pop"
     */
    nextEmbedded?: string;
    /**
     * log a message to the browser console window
     */
    log?: string;
  }

  export type IMonarchLanguageAction = IShortMonarchLanguageAction | IExpandedMonarchLanguageAction | (IShortMonarchLanguageAction | IExpandedMonarchLanguageAction)[];

  /**
  * This interface can be shortened as an array, ie. ['{','}','delimiter.curly']
  */
  export interface IMonarchLanguageBracket {
    /**
     * open bracket
     */
    open: string;
    /**
     * closing bracket
     */
    close: string;
    /**
     * token class
     */
    token: string;
  }
}

const ARGV_IN = 2;
const ARGV_OUT = 3;
const DEFAULT_TOKEN = '';
const IGNORE_CASE = true;
const ROOT_REFERENCE = 'root';
const CAPTURE_OVERRIDE_KEY = '0';
const CASE_IGNORE_FLAG = '(?i)';
const SOURCE_PREFIX = 'source.';
const END_STATE_SUFFIX = '_end';
const MONARCH_POP = '@pop';
const EXPANSION_INDEX = 1;
const REGEXP_INDEX = 0;

// TODO: Move to config file with other constants (platform dependent)?
const TOKENS_MAP = {};

export type RegExpString = string;
export type MonarchIncludeString = string;
export type ReferenceString = string;
export type LanguageId = string;
export type TokenInfo = TextMate.ScopeName | TextMate.IRawCaptures;
export type PrimitiveLanguageAction = Monaco.IShortMonarchLanguageAction | Monaco.IShortMonarchLanguageAction[];
export type ActionArray = (Monaco.IShortMonarchLanguageAction | Monaco.IExpandedMonarchLanguageAction)[];

interface TextMateBeginEndRule extends TextMate.IRawRule {
  readonly begin: TextMate.RegExpString;
  readonly end: TextMate.RegExpString;
  readonly patterns?: TextMate.IRawRule[];
}

type MonacoTokenizer = {
  [name: ReferenceString]: Monaco.IMonarchLanguageRule[];
};

function flattenRepositories(root: TextMate.IRawRepository, references: TextMate.IRawRepository) {
  for (const [key, value] of Object.entries(root)) {
    references[key] = value;
    if (value.repository) {
      flattenRepositories(value.repository, references);
    }
  }
}

function textmateToMonarchInclude(includeString: TextMate.IncludeString) {
  return includeString.replace('#', '@');
}

function includeToReference(includeString: MonarchIncludeString) {
  return includeString.slice(1);
}

function cleanMatchString(matchString: TextMate.RegExpString) {
  if (matchString.startsWith(CASE_IGNORE_FLAG)) {
    return matchString.slice(CASE_IGNORE_FLAG.length);
  } else {
    return matchString;
  }
}

function serializeRegex(match: RegExpString) {
  let serializedMatch = match.replaceAll('/', '\\/');
  // if (serializedMatch === '\\n') {
  //   serializedMatch = '\\\\n';
  // }
  return  '/' + serializedMatch + '/';
}

function numRegexGroups(regex: RegExpString) {
  // courtesty of https://stackoverflow.com/questions/16046620/regex-to-count-the-number-of-capturing-groups-in-a-regex
  const regexGroups = new RegExp(regex.toString() + '|').exec('');
  if (regexGroups) {
    return regexGroups.length - 1;
  } else {
    return 0;
  }
}

function translateToken(token: TextMate.ScopeName) {
  return token in TOKENS_MAP ? TOKENS_MAP[token] : token;
}

function generateCaptureTokens(
  match: RegExpString,
  captures: TextMate.IRawCaptures): Monaco.IShortMonarchLanguageAction[]
{
    const numGroups = numRegexGroups(match);
    const tokens: Monaco.IShortMonarchLanguageAction[] = new Array(numGroups).fill(DEFAULT_TOKEN);
    for (const [key, subpattern] of Object.entries(captures)) {
      const i = +key - 1;
      if (subpattern.name)
        tokens[i] = translateToken(subpattern.name);
    }
    return tokens;
}

function searchSourceInclude(pattern: TextMate.IRawRule) {
  if (pattern.patterns) {
    for (const subpattern of pattern.patterns) {
      if (subpattern.include?.startsWith(SOURCE_PREFIX)) {
        return subpattern.include.slice(SOURCE_PREFIX.length);
      }
    }
  }
}

function generateTokens(
  matchString: RegExpString,
  tokenInfo: TokenInfo
): PrimitiveLanguageAction
{
  if (typeof tokenInfo === 'string') {
    return translateToken(tokenInfo);
  } else if (tokenInfo[CAPTURE_OVERRIDE_KEY]?.name) {
    return translateToken(tokenInfo[CAPTURE_OVERRIDE_KEY].name);
  } else {
    return generateCaptureTokens(matchString, tokenInfo);
  }
}

function generateRule(
  match: TextMate.RegExpString,
  tokenInfo: TokenInfo,
  actionExpansion?: Partial<Monaco.IExpandedMonarchLanguageAction>): Monaco.IMonarchLanguageRule
{
  const cleanedMatch = cleanMatchString(match);
  if (!actionExpansion) {
    return [serializeRegex(cleanedMatch), generateTokens(cleanedMatch, tokenInfo)];
  } else {
    const tokens = generateTokens(cleanedMatch, tokenInfo);
    if (typeof tokens === 'string') {
      return [
        serializeRegex(cleanedMatch),
        {
          ...actionExpansion,
          token: tokens,
        },
      ]
    } else {
      const newToken = tokens[tokens.length - 1];
      const newTokens: ActionArray = tokens;
      newTokens[newTokens.length - 1] = {
        ...actionExpansion,
        token: newToken,
      };
      return [
        serializeRegex(cleanedMatch),
        newTokens
      ];
    }
  }
}

function generateBeginEndRule(
  p: TextMateBeginEndRule,
  tokenizer: MonacoTokenizer,
  currentRef: ReferenceString,
  references: TextMate.IRawRepository,
  embeddedLanguage?: LanguageId)
{
  const state = tokenizer[currentRef];
  const beginTokenInfo: TokenInfo = p.beginCaptures ? p.beginCaptures : (p.captures ? p.captures : (p.name ? p.name : DEFAULT_TOKEN));
  const endTokenInfo: TokenInfo = p.endCaptures ? p.endCaptures : (p.captures ? p.captures : (p.name ? p.name : DEFAULT_TOKEN));
  if (embeddedLanguage) {
    const ref = embeddedLanguage + END_STATE_SUFFIX;
    const beginRule = generateRule(p.begin, beginTokenInfo, {next: '@' + ref, nextEmbedded: embeddedLanguage});
    const endRule = generateRule(p.end, endTokenInfo, {next: MONARCH_POP, nextEmbedded: MONARCH_POP});
    state.push(beginRule);
    if (!tokenizer[ref]) {
      tokenizer[ref] = [endRule];
    }
  } else {
    const newRef = p.name ? nameToNewRef(p.name) : currentRef + END_STATE_SUFFIX;
    const beginRule = generateRule(p.begin, beginTokenInfo, {next: '@' + newRef});
    const endRule = generateRule(p.end, endTokenInfo, {next: MONARCH_POP});
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
        tokenizer[newRef].push([serializeRegex('[^' + cleanMatchString(ignoreChars) + ']+'), p.name]);
        tokenizer[newRef].push([serializeRegex('[' + cleanMatchString(ignoreChars) + ']'), p.name]);
      }
    }
  }
}

function getIgnoreString(tokenizer: MonacoTokenizer, currentRef: ReferenceString,) {
  let ignoreString = '';
  const ignoreChars: Set<string> = new Set();
  getIgnoreChars(tokenizer, currentRef, ignoreChars);
  for (let char of ignoreChars) {
    ignoreString += char;
  }
  return ignoreString;
}

function getIgnoreChars(tokenizer: MonacoTokenizer, currentRef: ReferenceString, ignoreChars: Set<string>) {
  const state = tokenizer[currentRef];
  for (const rule of state) {
    if (Array.isArray(rule)) {
      const beginChar = rule[REGEXP_INDEX][1] === '\\' ? rule[REGEXP_INDEX].slice(1, 3) : rule[REGEXP_INDEX][1];
      if (!ignoreChars.has(beginChar)) {
        ignoreChars.add(beginChar);
      }
    } else {
      const expandedRule: Monaco.IExpandedMonarchLanguageRule = rule;
      if (expandedRule.include) {
        getIgnoreChars(tokenizer, includeToReference(expandedRule.include), ignoreChars);
      }
    }
  }
}

function nameToNewRef(name: TextMate.ScopeName) {
  return name.replaceAll('.', '_').replaceAll('-', '_') + END_STATE_SUFFIX;
}

function generateMonarchRules(
  scope: TextMate.IRawRule,
  references: TextMate.IRawRepository,
  tokenizer: MonacoTokenizer,
  currentRef: ReferenceString)
{
  const state = tokenizer[currentRef];
  const patterns = scope.patterns ? scope.patterns : [scope];
  for (const pattern of patterns) {
    if (pattern.include) {
      state.push({
        include: textmateToMonarchInclude(pattern.include),
      });
      const ref = includeToReference(pattern.include);
      tokenizer[ref] = [];
      generateMonarchRules(references[ref], references,tokenizer, ref);
    } else if (pattern.begin && pattern.end) {
      const embeddedLanguage = searchSourceInclude(pattern);
      // TODO: Write a custom guard for TextMateBeginEndRule
      generateBeginEndRule(pattern as TextMateBeginEndRule, tokenizer, currentRef, references, embeddedLanguage);
    } else if (pattern.match) {
      const tokenInfo = pattern.captures ? pattern.captures : (pattern.name ? pattern.name : DEFAULT_TOKEN);
      const rule = generateRule(pattern.match, tokenInfo);
      state.push(rule);
    }
  }
}

export function generateMonarchGrammar() {
  // TODO: Validate command line args
  const textmateSrc = readFileSync(process.argv[ARGV_IN], 'utf-8');
  const textmateParse: TextMate.IRawGrammar = JSON.parse(textmateSrc);
  const references: TextMate.IRawRepository = {};
  flattenRepositories(textmateParse.repository, references);
  const monarch: Monaco.IMonarchLanguage = {
    defaultToken: DEFAULT_TOKEN,
    // TODO: Determine monarch.tokenPostfix from input filename
    includeLF: true,
    tokenPostfix: '.malloy',
    ignoreCase: IGNORE_CASE,
    tokenizer: {
      root: [],
    },
  };
  generateMonarchRules(
    {
      patterns: textmateParse.patterns
    },
    references,
    monarch.tokenizer,
    ROOT_REFERENCE,
  );
  writeOutput(process.argv[ARGV_OUT], monarch);
}

function writeOutput(filename: string, monarch: Monaco.IMonarchLanguage) {
  writeFileSync(filename, `
const monarch = {
includeLF: ${monarch.includeLF},
defaultToken: '${monarch.defaultToken}',
tokenPostfix: '${monarch.tokenPostfix}',
ignoreCase: ${monarch.ignoreCase},
tokenizer: {
`, 'utf-8');
  for (const [key, rules] of Object.entries(monarch.tokenizer)) {
    appendFileSync(filename, `\t${key}: [\n`, 'utf-8');
    for (const rule of rules) {
      if (!Array.isArray(rule)) {
        appendFileSync(filename, `${util.inspect(rule, {depth: null})},\n`, 'utf-8');
      }
      else {
        appendFileSync(filename, `[\n`, 'utf-8');
        appendFileSync(filename, `${rule[0]},\n`, 'utf-8');
        appendFileSync(filename, `${util.inspect(rule[1], {depth: null})},\n`, 'utf-8');
        appendFileSync(filename, `],\n`, 'utf-8');
      }
    }
    appendFileSync(filename, `],\n`, 'utf-8');
  }
  appendFileSync(filename, `}\n};`, 'utf-8');
}

generateMonarchGrammar();
