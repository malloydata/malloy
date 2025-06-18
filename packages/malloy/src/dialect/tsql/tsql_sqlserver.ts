import type {
  RegexLiteralNode,
  RegexMatchExpr,
  StringLiteralNode,
} from '../../model/malloy_types';
import {TSQLBase} from './tsql_base';

export class TSQLSQLServer extends TSQLBase {
  name = 'tsql-sqlserver';

  sqlRegexpMatch(df: RegexMatchExpr): string {
    const exprSql = df.kids.expr.sql;
    const regexOperandNode = df.kids.regex;

    if (
      regexOperandNode.node === 'stringLiteral' ||
      regexOperandNode.node === 'regexpLiteral'
    ) {
      let rawRegexValue: string | undefined;

      if (regexOperandNode.node === 'stringLiteral') {
        rawRegexValue = (regexOperandNode as StringLiteralNode).literal;
      } else {
        rawRegexValue = (regexOperandNode as RegexLiteralNode).literal;
      }

      const hasStartAnchor = rawRegexValue.startsWith('^');
      const hasEndAnchor = rawRegexValue.endsWith('$');

      let core = rawRegexValue;
      if (hasStartAnchor) core = core.slice(1);
      if (hasEndAnchor) core = core.slice(0, -1);
      core = core.replace(/[()]/g, '');

      rawRegexValue = core
        .split('|')
        .map(
          part =>
            `${hasStartAnchor ? '^' : ''}${part}${hasEndAnchor ? '$' : ''}`
        )
        .join('|');

      if (rawRegexValue === '') {
        return `${exprSql} = ''`;
      }
      if (rawRegexValue === null || rawRegexValue === undefined) {
        return '1=0';
      }

      const subPatterns = rawRegexValue.split('|');
      const conditions: string[] = [];

      for (const subPattern of subPatterns) {
        let currentPattern = subPattern.trim();
        if (currentPattern === '') {
          conditions.push(`${exprSql} = ''`);
          continue;
        }

        let anchoredStart = false;
        if (currentPattern.startsWith('^')) {
          currentPattern = currentPattern.substring(1);
          anchoredStart = true;
        }
        let anchoredEnd = false;
        if (currentPattern.endsWith('$')) {
          currentPattern = currentPattern.substring(
            0,
            currentPattern.length - 1
          );
          anchoredEnd = true;
        }

        if (currentPattern === '') {
          conditions.push(`${exprSql} = ''`);
          continue;
        }

        currentPattern = currentPattern.replace(/\\%/g, '[%]');
        currentPattern = currentPattern.replace(/\\_/g, '[_]');

        currentPattern = currentPattern.replace(/\\d/g, '[0-9]');
        currentPattern = currentPattern.replace(/\\w/g, '[a-zA-Z0-9_]');
        currentPattern = currentPattern.replace(/\\s/g, '[ \t\r\n\f\v]');
        currentPattern = currentPattern.replace(/\\D/g, '[^0-9]');
        currentPattern = currentPattern.replace(/\\W/g, '[^a-zA-Z0-9_]');

        if (!anchoredStart && !currentPattern.startsWith('%')) {
          currentPattern = '%' + currentPattern;
        }
        if (!anchoredEnd && !currentPattern.endsWith('%')) {
          currentPattern = currentPattern + '%';
        }

        const sqlSafePattern = currentPattern.replace(/'/g, "''");
        const sqlLiteral = `N'${sqlSafePattern}'`;
        conditions.push(`PATINDEX(${sqlLiteral}, ${exprSql}) > 0`);
      }

      if (conditions.length === 0) {
        return '1=0';
      }
      return conditions.join(' OR ');
    } else {
      const patternSql = regexOperandNode.sql;
      if (!patternSql) {
        return '1=0';
      }
      return `PATINDEX(${patternSql}, ${exprSql}) > 0`;
    }
  }
}
