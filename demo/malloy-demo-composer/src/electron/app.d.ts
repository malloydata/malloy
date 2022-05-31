export interface MalloyElectronAPI {
  analyses: (thePath?: string) => Promise<explore.Directory>;
  analysis: (path: string) => Promise<explore.Directory>;
  models: () => Promise<explore.Model[]>;
  schema: (analysis: Analysis) => Promise<{
    schema: Schema;
    modelDef: ModelDef;
    malloy: string;
  }>;
  runQuery: (
    query: string,
    queryName: string,
    analysis: Analysis
  ) => Promise<ResultJSON>;
  saveField: (
    type: "query" | "dimension" | "measure",
    field: FieldDef,
    name: string,
    analysis: Analysis
  ) => Promise<Analysis>;
  search: (
    source: StructDef,
    searchTerm: string,
    fieldPath?: string
  ) => Promise<SearchIndexResult[] | undefined>;
  topValues: (source: StructDef) => Promise<SearchValueMapResult[] | undefined>;
  openDirectory: () => Promise<string | undefined>;
}

declare global {
  interface Window {
    malloy: MalloyElectronAPI;
  }
}
