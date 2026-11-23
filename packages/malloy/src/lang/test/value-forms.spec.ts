/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {exprToStr} from './expr-to-str';
import {BetaExpression} from './test-translator';
import {isGranularResult} from '../ast/types/granular-result';

/**
 * What an expression translates to, as one line: its type (with its
 * granularity), then `::` and the IR, then the codes of any warnings; or,
 * when it does not translate, `ERROR:` and the messages.
 */
function translated(src: string): string {
  const bx = new BetaExpression(src);
  bx.compile();
  const log = bx.logger.getLog();
  const errors = log.filter(m => m.severity !== 'warn');
  if (errors.length > 0) {
    return `ERROR: ${errors.map(m => m.message).join(' / ')}`;
  }
  const v = bx.generated();
  const type = isGranularResult(v) ? `${v.type}.${v.timeframe}` : v.type;
  const warns = log.filter(m => m.severity === 'warn').map(m => m.code);
  const warnText = warns.length > 0 ? `  [warns: ${warns.join(', ')}]` : '';
  return `${type} :: ${exprToStr(v.value, undefined)}${warnText}`;
}

/**
 * Each row is an expression in the field space of the translator tests
 * (`ai` a number, `astr` a string, `abool` a boolean, `ad` a date, `ats` a
 * timestamp, `atstz` a timestamptz, `aweird` a sql native) and what it
 * translates to.
 */
const rows: [string, string][] = [
  [
    "ats > (pick @2020 when astr = 'a' else @2021)",
    'boolean :: {ats > {case when {astr = {"a"}} then @2020-01-01 00:00:00 else @2021-01-01 00:00:00}}',
  ],
  [
    "ats = (pick @2020 when astr = 'a' else @2021)",
    'boolean :: {ats = {case when {astr = {"a"}} then @2020-01-01 00:00:00 else @2021-01-01 00:00:00}}',
  ],
  [
    'days(ats to pick @2020 when abool else @2021)',
    'number :: {ats timeDiff {case when abool then @2020-01-01 00:00:00 else @2021-01-01 00:00:00}}',
  ],
  [
    'ad ? (pick @2020 when abool else ad)',
    'boolean :: {{ad >= {case when abool then @2020-01-01 else ad}} and {{ad < {case when abool then @2021-01-01 else ad}} or {ad = {case when abool then @2020-01-01 else ad}}}}',
  ],
  [
    "ad ? (pick (pick @2020 when abool else ad) when astr = 'a' else @2021)",
    'boolean :: {{ad >= {case when {astr = {"a"}} then {case when abool then @2020-01-01 else ad} else @2021-01-01}} and {{ad < {case when {astr = {"a"}} then {case when abool then @2021-01-01 else ad} else @2022-01-01}} or {ad = {case when {astr = {"a"}} then {case when abool then @2020-01-01 else ad} else @2021-01-01}}}}',
  ],
  [
    'ad ? pick 1 when ad.month else 2',
    'number :: {case when {ad = {timeTrunc-month ad}} then 1 else 2}',
  ],
  [
    'ad ? pick 1 when ad.month | ad.year else 2',
    'number :: {case when {{ad = {timeTrunc-month ad}} or {ad = {timeTrunc-year ad}}} then 1 else 2}',
  ],
  [
    'ad ? pick 1 when @2020 else 2',
    'number :: {case when {{ad >= @2020-01-01} and {ad < @2021-01-01}} then 1 else 2}',
  ],
  [
    'ats ? (pick @2020 when abool else ad)',
    'ERROR: Cannot compare a timestamp to a date',
  ],
  ['ats ? ad.month', 'ERROR: Cannot compare a timestamp to a date'],
  [
    'ats ? (pick @2020 when abool else ats)',
    'boolean :: {{ats >= {case when abool then @2020-01-01 00:00:00 else ats}} and {{ats < {case when abool then @2021-01-01 00:00:00 else ats}} or {ats = {case when abool then @2020-01-01 00:00:00 else ats}}}}',
  ],
  ['ats > greatest(@2020, @2021)', 'boolean :: {ats > {?function_call}}'],
  ['greatest(@2020, @2021)', 'date :: {?function_call}'],
  ['greatest(@2020, ats)', 'timestamp :: {?function_call}'],
  ['greatest(ats, @2020)', 'timestamp :: {?function_call}'],
  ['coalesce(null, @2021)', 'date :: {?function_call}'],
  ['ifnull(ats, @2020)', 'timestamp :: {?function_call}'],
  ['nullif(@2020, ats)', 'timestamp :: {?function_call}'],
  [
    'greatest(@2020, atstz)',
    'ERROR: No matching overload for function greatest(date, timestamptz)',
  ],
  ['greatest(ad, @2020)', 'date :: {?function_call}'],
  ['ats > greatest(ad, @2020)', 'ERROR: Cannot compare a timestamp to a date'],
  ['greatest(@2020, null)', 'date :: {?function_call}'],
  ['greatest(ats.month, ats.year)', 'timestamp :: {?function_call}'],
  ['greatest(ats.month, ats.month)', 'timestamp :: {?function_call}'],
  ['greatest(ad.month, ad.month)', 'date :: {?function_call}'],
  [
    'greatest(null, atstz)',
    'ERROR: No matching overload for function greatest(null, timestamptz)',
  ],
  [
    'greatest(atstz, atstz)',
    'ERROR: No matching overload for function greatest(timestamptz, timestamptz)',
  ],
  ['coalesce(ats.month, ats.month)', 'timestamp :: {?function_call}'],
  ["concat('a', @2020)", 'string :: {?function_call}'],
  ['@2020 + 1', 'date.year :: {+year @2020-01-01 1}'],
  ['ats > @2020 + 1 year', 'ERROR: Cannot compare a timestamp to a date'],
  ['@2020 + @2021', "ERROR: Duration quantity needs number not 'date"],
  [
    '(pick @2020 when abool else @2021) + 1',
    'date.year :: {+year {case when abool then @2020-01-01 else @2021-01-01} 1}',
  ],
  [
    '(pick ad.month when abool else ad.year) + 1',
    "ERROR: The choices do not share a granularity, so there is no unit to offset by; write the unit, as in '+ 1 month'",
  ],
  [
    '(pick ats.month when abool else ats) + 1',
    "ERROR: The choices do not share a granularity, so there is no unit to offset by; write the unit, as in '+ 1 month'",
  ],
  ['ad.month + 1', 'date.month :: {+month {timeTrunc-month ad} 1}'],
  [
    'ats + 1',
    "ERROR: A timestamp with no granularity has no unit to offset by; write the unit, as in '+ 1 day'",
  ],
  [
    'atstz + 1',
    "ERROR: A timestamptz with no granularity has no unit to offset by; write the unit, as in '+ 1 day'",
  ],
  ['ad + 1', 'date :: {+day ad 1}'],
  ["ad + 'x'", "ERROR: Duration quantity needs number not 'string"],
  ["ats + 'x'", "ERROR: Can not offset time by 'string'"],
  [
    'ats ? @2020 | @2021',
    'boolean :: {{{ats >= @2020-01-01 00:00:00} and {ats < @2021-01-01 00:00:00}} or {{ats >= @2021-01-01 00:00:00} and {ats < @2022-01-01 00:00:00}}}',
  ],
  [
    'ats ? ats.month | ats.year',
    'boolean :: {{{ats >= {timeTrunc-month ats}} and {ats < {+month {timeTrunc-month ats} 1}}} or {{ats >= {timeTrunc-year ats}} and {ats < {+year {timeTrunc-year ats} 1}}}}',
  ],
  [
    'ad ? ad.month | @2003-01-01',
    'boolean :: {{{ad >= {timeTrunc-month ad}} and {ad < {+month {timeTrunc-month ad} 1}}} or {ad = @2003-01-01}}',
  ],
  [
    'ats = ats.month | ats.year',
    'boolean :: {{ats = {timeTrunc-month ats}} or {ats = {timeTrunc-year ats}}}  [warns: or-choices-only]',
  ],
  [
    'ats ? (pick @2020 when abool else @2021) | ats',
    'boolean :: {{{ats >= {case when abool then @2020-01-01 00:00:00 else @2021-01-01 00:00:00}} and {ats < {case when abool then @2021-01-01 00:00:00 else @2022-01-01 00:00:00}}} or {ats = ats}}',
  ],
  [
    'ad ? ad.month & ad.year',
    'boolean :: {{{ad >= {timeTrunc-month ad}} and {ad < {+month {timeTrunc-month ad} 1}}} and {{ad >= {timeTrunc-year ad}} and {ad < {+year {timeTrunc-year ad} 1}}}}',
  ],
  [
    'ats != (@2020 | @2021)',
    'boolean :: {{{ats < @2020-01-01 00:00:00} or {ats >= @2021-01-01 00:00:00}} or {{ats < @2021-01-01 00:00:00} or {ats >= @2022-01-01 00:00:00}}}  [warns: or-choices-only]',
  ],
  [
    'ats ? ats.month | > @2020',
    'boolean :: {{{ats >= {timeTrunc-month ats}} and {ats < {+month {timeTrunc-month ats} 1}}} or {ats >= @2021-01-01 00:00:00}}',
  ],
  ['ai ? 1 | 2 | 3', 'boolean :: {ai in {1,2,3}}'],
  ['ai ? 1 to 5 | 9', 'boolean :: {{{ai >= 1} and {ai < 5}} or {ai = 9}}'],
  ['ai ? (1 to 5)', 'boolean :: {{ai >= 1} and {ai < 5}}'],
  [
    'ats ? @2020 to @2021 | @2023',
    'boolean :: {{{ats >= @2020-01-01 00:00:00} and {ats < @2021-01-01 00:00:00}} or {{ats >= @2023-01-01 00:00:00} and {ats < @2024-01-01 00:00:00}}}',
  ],
  [
    'ats = (pick @2020 when abool else @2021) | (pick @2022 when abool else @2023)',
    'boolean :: {ats in {{case when abool then @2020-01-01 00:00:00 else @2021-01-01 00:00:00},{case when abool then @2022-01-01 00:00:00 else @2023-01-01 00:00:00}}}',
  ],
  [
    'ats ? @2020 for 3 days',
    'boolean :: {{ats >= @2020-01-01 00:00:00} and {ats < {+day @2020-01-01 00:00:00 3}}}',
  ],
  [
    'ad ? @2020 for 3 days',
    'boolean :: {{ad >= @2020-01-01} and {ad < {+day @2020-01-01 3}}}',
  ],
  // Today's behaviour, not a rule: the date value `ad` becomes a timestamp
  // here without a cast. Whether that should be refused is not decided.
  [
    'ad ? @2020 for 3 hours',
    'boolean :: {{{cast ad} >= @2020-01-01 00:00:00} and {{cast ad} < {+hour @2020-01-01 00:00:00 3}}}',
  ],
  [
    'ats ? (pick @2020 when abool else @2021) for 3 days',
    'boolean :: {{ats >= {case when abool then @2020-01-01 00:00:00 else @2021-01-01 00:00:00}} and {ats < {+day {case when abool then @2020-01-01 00:00:00 else @2021-01-01 00:00:00} 3}}}',
  ],
  // Today's behaviour, not a rule: #3085 says this cast of `atstz` is off by
  // the zone offset under a query time zone.
  [
    'atstz ? @2020 for 3 days',
    'boolean :: {{{cast atstz} >= @2020-01-01 00:00:00} and {{cast atstz} < {+day @2020-01-01 00:00:00 3}}}',
  ],
  ['atstz > @2020', 'boolean :: {atstz >= @2021-01-01 00:00:00}'],
  [
    'atstz ? @2020',
    'boolean :: {{atstz >= @2020-01-01 00:00:00} and {atstz < @2021-01-01 00:00:00}}',
  ],
  [
    'atstz = @2020-01-01',
    'boolean :: {{atstz >= @2020-01-01 00:00:00} and {atstz < @2020-01-02 00:00:00}}',
  ],
  [
    'atstz ? (pick @2020 when abool else @2021)',
    'boolean :: {{atstz >= {case when abool then @2020-01-01 00:00:00 else @2021-01-01 00:00:00}} and {atstz < {case when abool then @2021-01-01 00:00:00 else @2022-01-01 00:00:00}}}',
  ],
  ['hours(ats to atstz)', 'number :: {ats timeDiff atstz}'],
  ['hours(atstz to ats)', 'number :: {atstz timeDiff ats}'],
  ['days(@2020 to @2021)', 'number :: {@2020-01-01 timeDiff @2021-01-01}'],
  ['days(@2020 to ats)', 'number :: {@2020-01-01 00:00:00 timeDiff ats}'],
  ['days(ad to @2020)', 'number :: {ad timeDiff @2020-01-01}'],
  ['days(ats to ad)', 'ERROR: Cannot measure from timestamp to date'],
  [
    'days(@2020-03-04.month to ats)',
    'ERROR: Cannot measure from date to timestamp',
  ],
  [
    'atstz ? atstz.month',
    'boolean :: {{atstz >= {timeTrunc-month atstz}} and {atstz < {+month {timeTrunc-month atstz} 1}}}',
  ],
  [
    'ats > (case when abool then @2020 else @2021 end)',
    'boolean :: {ats > {case when abool then @2020-01-01 00:00:00 else @2021-01-01 00:00:00}}  [warns: sql-case]',
  ],
  [
    'ad ? (case when abool then @2020 else @2021-03 end)',
    'boolean :: {{ad >= {case when abool then @2020-01-01 else @2021-03-01}} and {ad < {case when abool then @2021-01-01 else @2021-04-01}}}  [warns: sql-case]',
  ],
  [
    'ats > (@2020 ?? @2021)',
    'boolean :: {ats > {@2020-01-01 00:00:00 coalesce @2021-01-01 00:00:00}}',
  ],
  [
    'ad ? (ad.month ?? ad.year)',
    'boolean :: {{ad >= {{timeTrunc-month ad} coalesce {timeTrunc-year ad}}} and {ad < {{+month {timeTrunc-month ad} 1} coalesce {+year {timeTrunc-year ad} 1}}}}',
  ],
  ['ad ?? null', 'ERROR: Mismatched types for coalesce (date, null)'],
  ['null ?? @2020', 'date.year :: @2020-01-01'],
  ['ats ?? @2020', 'timestamp :: {ats coalesce @2020-01-01 00:00:00}'],
  ['@2020 ?? ats', 'timestamp :: {@2020-01-01 00:00:00 coalesce ats}'],
  ['ad ?? ats', 'ERROR: Mismatched types for coalesce (date, timestamp)'],
  ['ai ?? 1.5', 'number :: {ai coalesce 1.5}'],
  ['badref ?? null', "ERROR: 'badref' is not defined"],
  [
    '@2020 = @2020',
    'boolean :: {{@2020-01-01 >= @2020-01-01} and {@2020-01-01 < @2021-01-01}}',
  ],
  [
    '@2020 ? @2020',
    'boolean :: {{@2020-01-01 >= @2020-01-01} and {@2020-01-01 < @2021-01-01}}',
  ],
  ['ats ? @2020.year', 'ERROR: Cannot compare a timestamp to a date'],
  ['ats > @2020.year', 'ERROR: Cannot compare a timestamp to a date'],
  [
    'ad ? @2020-03-04.month',
    'boolean :: {{ad >= {timeTrunc-month @2020-03-04}} and {ad < {+month {timeTrunc-month @2020-03-04} 1}}}',
  ],
  ['[@2020, @2021]', 'array :: [@2020-01-01, @2021-01-01]'],
  [
    'ats ? pick @2020 when abool else @2021',
    'boolean :: {{ats >= {case when abool then @2020-01-01 00:00:00 else @2021-01-01 00:00:00}} and {ats < {case when abool then @2021-01-01 00:00:00 else @2022-01-01 00:00:00}}}',
  ],
  [
    'ad ? pick @2020 when abool else @2021',
    'boolean :: {{ad >= {case when abool then @2020-01-01 else @2021-01-01}} and {ad < {case when abool then @2021-01-01 else @2022-01-01}}}',
  ],
  [
    "astr ? pick @2020 when 'a' else @2021",
    'date.year :: {case when {astr = {"a"}} then @2020-01-01 else @2021-01-01}',
  ],
  [
    'ats ? > @2020 & < @2022',
    'boolean :: {{ats >= @2021-01-01 00:00:00} and {ats < @2022-01-01 00:00:00}}',
  ],
  [
    'ats ? > (pick @2020 when abool else @2021)',
    'boolean :: {ats > {case when abool then @2020-01-01 00:00:00 else @2021-01-01 00:00:00}}',
  ],
  ['max(ats) > @2020', 'boolean :: {{aggregate ats} >= @2021-01-01 00:00:00}'],
  [
    'ats.month = @2020-03',
    'boolean :: {{{timeTrunc-month ats} >= @2020-03-01 00:00:00} and {{timeTrunc-month ats} < @2020-04-01 00:00:00}}',
  ],
  [
    'ad ? (pick @2020 when abool else null)',
    'boolean :: {{ad >= {case when abool then @2020-01-01 else {null}}} and {ad < {case when abool then @2021-01-01 else {null}}}}',
  ],
  [
    'ai ? pick 7 when abool else 8',
    'boolean :: {ai = {case when abool then 7 else 8}}',
  ],
  ['pick 7 when abool else 8.5', 'number :: {case when abool then 7 else 8.5}'],
  [
    'pick ai when abool else null',
    'number :: {case when abool then ai else {null}}',
  ],
  ['@2020::timestamp', 'timestamp :: {cast @2020-01-01}'],
  [
    'ats ? @2020-Q1',
    'boolean :: {{ats >= @2020-01-01 00:00:00} and {ats < @2020-04-01 00:00:00}}',
  ],
  [
    'ats ? @2020-01-01 10:00',
    'boolean :: {{ats >= @2020-01-01 10:00:00} and {ats < @2020-01-01 10:01:00}}',
  ],
  // Today's behaviour, not a rule: #3259 says a date tested against a
  // minute- or hour-resolution literal should be refused.
  [
    'ad ? @2020-01-01 10:00',
    'boolean :: {{ad >= @2020-01-01 10:00:00} and {ad < @2020-01-01 10:01:00}}',
  ],
  [
    'pick @2020 when abool else ats',
    'timestamp :: {case when abool then @2020-01-01 00:00:00 else ats}',
  ],
  [
    'pick @2020 when abool else 1',
    'ERROR: else type `number` does not match return type `date`',
  ],
  [
    'pick ats when abool else @2020',
    'timestamp :: {case when abool then ats else @2020-01-01 00:00:00}',
  ],
  [
    'pick ad.month when abool else ad.year',
    'date :: {case when abool then {timeTrunc-month ad} else {timeTrunc-year ad}}',
  ],
  [
    'pick ad.month when abool else ad.month',
    'date.month :: {case when abool then {timeTrunc-month ad} else {timeTrunc-month ad}}',
  ],
  [
    'pick ats.month when abool else null',
    'timestamp.month :: {case when abool then {timeTrunc-month ats} else {null}}',
  ],
  [
    'ad.month ?? ad.year',
    'date :: {{timeTrunc-month ad} coalesce {timeTrunc-year ad}}',
  ],
  [
    'ats.month ?? ats.month',
    'timestamp.month :: {{timeTrunc-month ats} coalesce {timeTrunc-month ats}}',
  ],
  ['@2020 in (ats)', 'boolean :: {@2020-01-01 in {ats}}  [warns: sql-in]'],
  [
    'ad in (@2020, @2021)',
    'boolean :: {ad in {@2020-01-01,@2021-01-01}}  [warns: sql-in]',
  ],
  [
    'ats in (@2020, @2021)',
    'boolean :: {ats in {@2020-01-01 00:00:00,@2021-01-01 00:00:00}}  [warns: sql-in]',
  ],
  [
    'ats in (@2020, ad)',
    'boolean :: {ats in {@2020-01-01 00:00:00,ad}}  [warns: sql-in]',
  ],
  ['lag(@2020)', 'date :: {?function_call}'],
  ['min(@2020)', 'date.year :: {aggregate @2020-01-01}'],
  ['max(ad.month)', 'date.month :: {aggregate {timeTrunc-month ad}}'],
  ['count(@2020)', 'number :: {aggregate @2020-01-01}'],
  ['xx!(@2020)', 'date :: xx({@2020-01-01})'],
  ['xx!(ats.month)', 'timestamp :: xx({{timeTrunc-month ats}})'],
  ['xx!(ad.month)', 'date :: xx({{timeTrunc-month ad}})'],
  ['xx!timestamp(@2020)', 'timestamp :: xx({@2020-01-01})'],
  [
    'ats > last_day!(@2020-03-04)',
    'ERROR: Cannot compare a timestamp to a date',
  ],
  ['max(ats) > max(@2020)', 'ERROR: Cannot compare a timestamp to a date'],
  [
    '(pick @2020 when abool else @2021-03).month',
    'date.month :: {timeTrunc-month {case when abool then @2020-01-01 else @2021-03-01}}',
  ],
  [
    'ats ? ats.month + 1',
    'boolean :: {{ats >= {+month {timeTrunc-month ats} 1}} and {ats < {+month {+month {timeTrunc-month ats} 1} 1}}}',
  ],
  ['ad ? ad.month + 1 day', 'boolean :: {ad = {+day {timeTrunc-month ad} 1}}'],
  [
    'ats ? now.month',
    'boolean :: {{ats >= {timeTrunc-month {now}}} and {ats < {+month {timeTrunc-month {now}} 1}}}',
  ],
  [
    'ats ? (pick ats.month when abool else ats.month)',
    'boolean :: {{ats >= {case when abool then {timeTrunc-month ats} else {timeTrunc-month ats}}} and {ats < {case when abool then {+month {timeTrunc-month ats} 1} else {+month {timeTrunc-month ats} 1}}}}',
  ],
  [
    'ats ? (pick ats.month when abool else ats.year)',
    'boolean :: {{ats >= {case when abool then {timeTrunc-month ats} else {timeTrunc-year ats}}} and {ats < {case when abool then {+month {timeTrunc-month ats} 1} else {+year {timeTrunc-year ats} 1}}}}',
  ],
  [
    'ad ? pick when < @2020 else @2021',
    'date :: {case when {ad < @2020-01-01} then ad else @2021-01-01}',
  ],
  [
    'pick aweird when abool else aweird',
    'sql native :: {case when abool then aweird else aweird}',
  ],
  [
    'pick aweird when abool else null',
    'sql native :: {case when abool then aweird else {null}}',
  ],
  ['aweird ?? aweird', 'sql native :: {aweird coalesce aweird}'],
  [
    'pick [1,2] when abool else [3]',
    'array :: {case when abool then [1, 2] else [3]}',
  ],
  [
    '(pick {a is 1} when abool else {a is 2}).a',
    "ERROR: Expected a timeframe after '.', such as `.month`; a field cannot be read from an expression",
  ],
  [
    'pick {a is 1} when abool else {b is 2}',
    'ERROR: else type `record` does not match return type `record`',
  ],
  [
    "astr ~ (pick r'a' when abool else r'b')",
    'boolean :: {astr regex-match {case when abool then /a/ else /b/}}',
  ],
  [
    "pick r'a' when abool else 'b'",
    'ERROR: else type `string` does not match return type `regular expression`',
  ],
  [
    "pick f'a' when abool else f'b'",
    'ERROR: Pick statments cannot have filter expression values',
  ],
  ["f'a' ?? f'b'", 'filter expression :: {a coalesce b}'],
  [
    "case when abool then f'a' else f'b' end",
    'ERROR: Case statements cannot have filter expression values',
  ],
  [
    "case when abool then 1 else 'a' end",
    'ERROR: Case else type string does not match return type number',
  ],
  [
    "case when abool then 1 when astr = 'a' then 2.5 end",
    'number :: {case when abool then 1 when {astr = {"a"}} then 2.5}  [warns: sql-case]',
  ],
  [
    'case when abool then ad.month else ad.year end',
    'date :: {case when abool then {timeTrunc-month ad} else {timeTrunc-year ad}}  [warns: sql-case]',
  ],
  [
    "case ai when 'a' then 1 end",
    'ERROR: Case when type string does not match value type number',
  ],
  [
    'case when ai then 1 end',
    'ERROR: Case when expression must be boolean, not number',
  ],
  [
    'pick 1 when ai else 2',
    "ERROR: when expression must be boolean, not number; to test a value against each 'when', apply the pick to the value with '?'",
  ],
  [
    "pick 1 when abool pick 'a' when abool else 2",
    'ERROR: pick type `string` does not match return type `number`',
  ],
  [
    "ai ? pick 'a' when 1 pick 2 when 3 else 'c'",
    'ERROR: pick type `number` does not match return type `string`',
  ],
  [
    "ai ? pick 'a' when 1 else 2",
    'ERROR: else type `number` does not match return type `string`',
  ],
  [
    "ai ? pick 'a' when 1",
    'ERROR: default type `number` does not match return type `string`',
  ],
  [
    "ai ? pick when 1 else 'x'",
    'ERROR: else type `string` does not match return type `number`',
  ],
  [
    'ats ? greatest(ats.month, ats.month)',
    'boolean :: {ats = {?function_call}}',
  ],
  [
    'ats ? coalesce(ats.month, ats.month)',
    'boolean :: {ats = {?function_call}}',
  ],
  ['year(@2020)', 'number :: {extract @2020-01-01}'],
  ['day_of_week(@2020)', 'number :: {extract @2020-01-01}'],
  ['@2020.quarter', 'date.quarter :: {timeTrunc-quarter @2020-01-01}'],
  ['@2020-03-04.week', 'date.week :: {timeTrunc-week @2020-03-04}'],
  [
    'ats.month = ats.month',
    'boolean :: {{timeTrunc-month ats} = {timeTrunc-month ats}}',
  ],
  ['ats ? ats', 'boolean :: {ats = ats}'],
  ['not @2020', "ERROR: 'not' Can't use type date"],
  ['-@2020', "ERROR: 'unary minus' Can't use type date"],
  ['@2020 * 2', "ERROR: The '*' operator requires a number, not a 'date'"],
  ['@2020 > 5', 'ERROR: Cannot compare a date to a number'],
  ["@2020 > 'a'", 'ERROR: Cannot compare a date to a string'],
  [
    'ats ? @2020 to @2021',
    'boolean :: {{ats >= @2020-01-01 00:00:00} and {ats < @2021-01-01 00:00:00}}',
  ],
  [
    'ats ? (pick @2020 when abool else @2021) to @2022',
    'boolean :: {{ats >= {case when abool then @2020-01-01 00:00:00 else @2021-01-01 00:00:00}} and {ats < @2022-01-01 00:00:00}}',
  ],
  ['ats ? ad to @2021', 'ERROR: Cannot compare a timestamp to a date'],
  ['ats ? @2020 to ad', 'ERROR: Cannot compare a timestamp to a date'],
  [
    'ai ? (pick 7 when abool else 8)',
    'boolean :: {ai = {case when abool then 7 else 8}}',
  ],
  [
    'ai = (pick 7 when abool else 8)',
    'boolean :: {ai = {case when abool then 7 else 8}}',
  ],
  [
    "astr ? pick 'x' when abool else 'y'",
    'boolean :: {astr = {case when abool then {"x"} else {"y"}}}',
  ],
  [
    'ad ? (pick ad when abool else ad)',
    'boolean :: {ad = {case when abool then ad else ad}}',
  ],
  [
    "ai ? pick 'big' when > 100 else 'small'",
    'string :: {case when {ai > 100} then {"big"} else {"small"}}',
  ],
  [
    "ai ? pick 'one' when 1 pick 'two' when 2 else 'many'",
    'string :: {case when {ai = 1} then {"one"} when {ai = 2} then {"two"} else {"many"}}',
  ],
  [
    "astr ? pick 'shipped' when 'will call' | 'shipped' pick 'ignore' when 'bad1' | 'bad2'",
    'string :: {case when {astr in {{"will call"},{"shipped"}}} then {"shipped"} when {astr in {{"bad1"},{"bad2"}}} then {"ignore"} else astr}',
  ],
  [
    "astr ? pick when 'good' | 'ok' else null",
    'string :: {case when {astr in {{"good"},{"ok"}}} then astr else {null}}',
  ],
  [
    "abool ? pick 'yes' when true else 'no'",
    'ERROR: Cannot compare a boolean to a string',
  ],
  [
    "abool ? pick 'yes' when = true else 'no'",
    'string :: {case when {abool = true} then {"yes"} else {"no"}}',
  ],
  [
    "abool ? pick 'same' when abool else 'different'",
    'ERROR: Cannot compare a boolean to a string',
  ],
  [
    'abool ? pick true when abool else false',
    'boolean :: {abool = {case when abool then true else false}}',
  ],
  [
    "ai ? pick 'small' when (pick 1 when abool else 2) else 'big'",
    'string :: {case when {ai = {case when abool then 1 else 2}} then {"small"} else {"big"}}',
  ],
  [
    "ad ? pick 'a' when (pick ad.month when abool else ad.year) else 'b'",
    'string :: {case when {{ad >= {case when abool then {timeTrunc-month ad} else {timeTrunc-year ad}}} and {ad < {case when abool then {+month {timeTrunc-month ad} 1} else {+year {timeTrunc-year ad} 1}}}} then {"a"} else {"b"}}',
  ],
  [
    'ai ? (pick 1 when abool else 2) | 3',
    'boolean :: {{ai = {case when abool then 1 else 2}} or {ai = 3}}',
  ],
  [
    'abool ? pick abool when = abool else abool',
    'boolean :: {case when {abool = abool} then abool else abool}',
  ],
  [
    'abool = (pick abool when abool else abool)',
    'boolean :: {abool = {case when abool then abool else abool}}',
  ],
  [
    "pick 'same' when (not abool) = (not abool) else 'different'",
    'string :: {case when {{not abool} = {not abool}} then {"same"} else {"different"}}',
  ],
  [
    'ad ? pick 1 when = ad.month else 2',
    'number :: {case when {ad = {timeTrunc-month ad}} then 1 else 2}',
  ],
  [
    'ad ? (pick ad.month when abool else ad.year)',
    'boolean :: {{ad >= {case when abool then {timeTrunc-month ad} else {timeTrunc-year ad}}} and {ad < {case when abool then {+month {timeTrunc-month ad} 1} else {+year {timeTrunc-year ad} 1}}}}',
  ],
  ['ad ? null', 'boolean :: {is-null ad}'],
  [
    'ats ? @2020-01-01 10:00[UTC]',
    'boolean :: {ats = @2020-01-01 10:00:00[UTC]}',
  ],
  ['ad = @2020', 'boolean :: {{ad >= @2020-01-01} and {ad < @2021-01-01}}'],
  ['ad = ad.year', 'boolean :: {ad = {timeTrunc-year ad}}'],
  [
    'ad ? ad.year',
    'boolean :: {{ad >= {timeTrunc-year ad}} and {ad < {+year {timeTrunc-year ad} 1}}}',
  ],
  [
    'lag(ats.month)',
    "ERROR: Parameter 1 ('value') of lag must be literal, constant or output, but received input",
  ],
  [
    'lag(ad.month)',
    "ERROR: Parameter 1 ('value') of lag must be literal, constant or output, but received input",
  ],
  [
    'ad ? max(ad.month)',
    'boolean :: {{ad >= {aggregate {timeTrunc-month ad}}} and {ad < {+month {aggregate {timeTrunc-month ad}} 1}}}',
  ],
  [
    'ats ? max(ats.month)',
    'boolean :: {{ats >= {aggregate {timeTrunc-month ats}}} and {ats < {+month {aggregate {timeTrunc-month ats}} 1}}}',
  ],
  [
    "ats > (astr ? pick @2020 when 'a' else @2021)",
    'boolean :: {ats > {case when {astr = {"a"}} then @2020-01-01 00:00:00 else @2021-01-01 00:00:00}}',
  ],
];

describe('time values, ranges and pick', () => {
  for (const [src, want] of rows) {
    test(src, () => {
      expect(translated(src)).toEqual(want);
    });
  }
});
