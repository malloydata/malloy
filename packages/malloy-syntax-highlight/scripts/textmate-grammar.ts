/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * The shape of a TextMate grammar `.json` file, as the Monarch generator reads it.
 *
 * vscode-textmate declares equivalent types but exports none of them, so this is
 * the contract the generator owns: it describes the file on disk, not the
 * library's internal parse tree, and stays valid whatever vscode-textmate does
 * with its own types.
 *
 * Deliberately a subset — only the fields the generator reads. Adding a field
 * here means the generator learned to handle it.
 */

/** A TextMate scope name, e.g. `keyword.control.malloy`. */
export type ScopeName = string;

/** An Oniguruma pattern, in TextMate's own regexp dialect. */
export type RegExpString = string;

/** A reference to another rule: `#name`, `$self`, `$base`, or a scope name. */
export type IncludeString = string;

/** Scope names to apply to a match's capture groups, keyed by group number. */
export interface IRawCaptures {
  [captureId: string]: IRawRule;
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

export interface IRawRepository {
  [name: string]: IRawRule;
}

export interface IRawGrammar {
  readonly scopeName: ScopeName;
  readonly patterns: IRawRule[];
  repository: IRawRepository;
  readonly injections?: {[expression: string]: IRawRule};
  readonly injectionSelector?: string;
  readonly fileTypes?: string[];
  readonly name?: string;
  readonly firstLineMatch?: string;
}
