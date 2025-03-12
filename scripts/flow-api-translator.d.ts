declare module 'flow-api-translator' {
  function unstable_translateTSDefToFlowDef(file: string): Promise<string>;
}
