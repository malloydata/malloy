/// <reference types="jest" />

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace jest {
  interface It {
    when: (condition: boolean) => It;
  }
}
