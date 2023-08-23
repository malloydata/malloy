export interface GoldenTestConfig {
  language: {
    id: string;
    scopeName: string;
    path: string;
    embeddedLanguages?: [
      {
        id: string;
        scopeName: string;
        path: string;
      }
    ];
  };
  theme: {
    id: string;
    path: string;
  };
}

export interface RelaxedToken {
  startIndex: number;
  type: string | string[];
  color?: string;
}

export interface TestItem {
  line: string;
  tokens: RelaxedToken[];
}
