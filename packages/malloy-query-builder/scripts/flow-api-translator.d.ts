declare module 'flow-api-translator' {
  async function unstable_translateTSDefToFlowDef(file: string): Promise<string>;
}
