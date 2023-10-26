// Allow raw imports
declare module '*.malloy?raw' {
  const content: string;
  export default content;
}
