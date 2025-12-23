import {RESERVED_WORDS} from './reserved_words';

function shouldQuoteIdentifier(name: string) {
  const containsFunnyCharacters = !name.match(/^[A-Za-z_][A-Za-z_0-9]*$/);
  const isReserved = RESERVED_WORDS.includes(name.toLowerCase());
  return containsFunnyCharacters || isReserved;
}

export function maybeQuoteIdentifier(name: string): string {
  if (shouldQuoteIdentifier(name)) {
    return `\`${name}\``;
  }
  return name;
}
