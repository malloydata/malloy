import {ESLintUtils, AST_NODE_TYPES, TSESTree} from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  () => 'https://github.com/malloydata/malloy/main/package/malloy-lint'
);

const rule: ReturnType<typeof createRule> = createRule({
  create(context) {
    const sourceCode = context.getSourceCode();

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
    ): TSESTree.TypeNode | undefined {
      if (parent?.type === AST_NODE_TYPES.VariableDeclarator) {
        return parent.id.typeAnnotation?.typeAnnotation;
      }
      if (parent?.type === AST_NODE_TYPES.PropertyDefinition) {
        return parent.typeAnnotation?.typeAnnotation;
      }
      return undefined;
    }

    function isRecordWithStringKey(
      typeAnnotation: TSESTree.TypeNode | undefined
    ): boolean {
      if (typeAnnotation?.type === AST_NODE_TYPES.TSTypeReference) {
        if (
          typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier &&
          typeAnnotation.typeName.name === 'Record'
        ) {
          const key = typeAnnotation.typeParameters?.params[0];
          return key?.type === AST_NODE_TYPES.TSStringKeyword;
        }
      }
      return false;
    }

    return {
      ObjectExpression(node) {
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
