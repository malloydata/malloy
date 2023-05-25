/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
  ESLintUtils,
  AST_NODE_TYPES,
  TSESTree,
  ParserServices,
} from '@typescript-eslint/utils';
import ts from 'typescript';
import * as tsutils from 'tsutils';

const createRule = ESLintUtils.RuleCreator(
  () => 'https://github.com/malloydata/malloy/main/package/malloy-lint'
);

const rule: ReturnType<typeof createRule> = createRule({
  create(context) {
    const sourceCode = context.getSourceCode();

    return {
      ObjectExpression(node) {
        let parserServices: ParserServices;
        let checker: ts.TypeChecker;
        try {
          parserServices = ESLintUtils.getParserServices(context);
          checker = parserServices.program.getTypeChecker();
        } catch {
          // Parser services are not available, probably JS
          return;
        }

        function getQuotedKey(key: TSESTree.Literal | TSESTree.Identifier) {
          if (key.type === 'Literal' && typeof key.value === 'string') {
            // If the key is already a string literal, don't replace the quotes with double quotes.
            return sourceCode.getText(key);
          }

          // Otherwise, the key is either an identifier or a number literal.
          return `"${key.type === 'Identifier' ? key.name : key.value}"`;
        }

        function checkOmittedQuotes(node: TSESTree.ObjectLiteralElement) {
          if (node.type === AST_NODE_TYPES.Property) {
            const key = node.key;
            if (
              !(node.method || node.computed || node.shorthand) &&
              !(key.type === 'Literal' && typeof key.value === 'string')
            ) {
              const quotableKey = key as TSESTree.Literal | TSESTree.Identifier;
              context.report({
                node,
                messageId: 'quoteKey',
                data: {
                  property:
                    quotableKey.type === 'Identifier'
                      ? quotableKey.name
                      : quotableKey.value,
                },
                fix: fixer =>
                  fixer.replaceText(quotableKey, getQuotedKey(quotableKey)),
              });
            }
          }
        }

        function getTypeAnnotation(
          parent: TSESTree.Node | undefined
        ): ts.Type | undefined {
          if (!parent) {
            return undefined;
          }

          const originalNode = parserServices.esTreeNodeToTSNodeMap.get(parent);
          const nodeType = checker.getTypeAtLocation(originalNode);

          if (tsutils.isPropertyDeclaration(originalNode)) {
            return nodeType;
          }
          if (tsutils.isVariableDeclaration(originalNode)) {
            return nodeType;
          }
          return undefined;
        }

        function isRecordWithStringKey(
          typeAnnotation: ts.Type | undefined
        ): boolean {
          if (!typeAnnotation) {
            return false;
          }
          const keyType = checker.getIndexInfoOfType(
            typeAnnotation,
            ts.IndexKind.String
          )?.keyType;
          if (keyType) {
            return tsutils.isTypeFlagSet(keyType, ts.TypeFlags.String);
          }
          return false;
        }

        const typeAnnotation = getTypeAnnotation(node.parent);
        if (isRecordWithStringKey(typeAnnotation)) {
          for (const prop of node.properties) {
            checkOmittedQuotes(prop);
          }
        }
      },
    };
  },
  name: 'quote-string-properties',
  meta: {
    docs: {
      description: 'Keys for Record<string, any> types should be quoted',
      recommended: 'error',
    },
    messages: {
      quoteKey: 'This key should be quoted',
    },
    type: 'suggestion',
    schema: [],
    fixable: 'code',
  },
  defaultOptions: [],
});

export default rule;
