const BYTE_SUFFIXES = ["k", "m", "g", "t", "p"];
const BYTE_MATCH = /^(?<bytes>\d+)((?<suffix>[kmgtp])((?<iec>i)?b)?)?$/i;

export const convertToBytes = (bytes: string): string => {
  const match = BYTE_MATCH.exec(bytes);
  if (match?.groups?.suffix) {
    const value =
      +match.groups.bytes *
      Math.pow(
        1024,
        BYTE_SUFFIXES.indexOf(match.groups.suffix.toLowerCase()) + 1
      );
    return `${value}`;
  }
  return bytes;
};
