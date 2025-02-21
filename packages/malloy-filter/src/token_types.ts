export interface Token {
  type: string;
  value: string;
  startIndex: number; // The start index of this token in the original string.
  endIndex: number; // The end index of this token in the original string.
  values?: Token[]; // Merged tokens can contain tokens.  Otherwise undefined.
}
