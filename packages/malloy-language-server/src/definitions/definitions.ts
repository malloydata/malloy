/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Location, Position, DefinitionLink} from 'vscode-languageserver';
import type {TextDocument} from 'vscode-languageserver-textdocument';
import type {TranslateCache} from '../translate_cache';

export async function getMalloyDefinitionReference(
  translateCache: TranslateCache,
  document: TextDocument,
  position: Position
): Promise<Location[] | DefinitionLink[]> {
  try {
    const model = await translateCache.translateWithCache(
      document.uri,
      document.languageId
    );
    if (!model) {
      return [];
    }
    const reference = model.getReference(position);
    const location = reference?.definition.location;
    if (location) {
      return [
        {
          uri: location.url,
          range: location.range,
        },
      ];
    } else {
      const importLocation = model.getImport(position);
      if (importLocation) {
        const documentStart = {
          start: {line: 0, character: 0},
          end: {line: 0, character: 0},
        };
        return [
          {
            originSelectionRange: importLocation.location.range,
            targetUri: importLocation.importURL,
            targetRange: documentStart,
            targetSelectionRange: documentStart,
          },
        ];
      }
    }
    return [];
  } catch (error) {
    return [];
  }
}
