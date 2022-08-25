declare global {
    namespace jest {
        interface Matchers<R> {
            isSqlEq(): R;
        }
    }
}
export {};
