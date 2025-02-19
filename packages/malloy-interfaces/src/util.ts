import {RESERVED_WORDS} from './reserved_words';

function shouldQuoteIdentifier(name: string) {
  const containsFunnyCharacters = !name.match(/^[A-Za-z_][A-Za-z_0-9]*$/);
  const isReserved = RESERVED_WORDS.includes(name.toLowerCase());
  return containsFunnyCharacters || isReserved;
}

export function maybeQuoteIdentifier(name: string): string {
  const path = name.split('.');
  for (let i = 0; i < path.length; i++) {
    if (shouldQuoteIdentifier(path[i])) {
      path[i] = `\`${path[i]}\``;
    }
  }
  return path.join('.');
}
