declare module 'duckdb' {
  /**
   * Scalar result value type
   */
  type Scalar = boolean | number | string | null;

  /**
   * All result value types
   */
  type Value = Scalar | Record<string, Value> | Array<Value> | null;

  /**
   * Result row
   */
  type Row = Record<string, Value>;

  /**
   * Instance that represents either an on disk or in memory database.
   */
  class Database {
    /**
     * Default connection used by {@link Database.all()}, {@link Database.each()},
     * {@link Database.prepare()}, {@link Database.run()},
     * {@link Database.register()}, and {@link Database.unregister()}.
     * Created the first time one of those methods is used.
     */
    default_connection: Connection | undefined;

    /**
     * Create a new database instance, either from a file or in memory. If an
     * error occurs during creation, it is passed to the callback.
     *
     *
     * @param path Path to database file, or ':memory:' for an in memory database.
     * @param callback Passed errors that occur during database creation.
     */
    constructor(path: string, callback?: (err: Error) => void);

    /**
     * Create a new database instance, either from a file or in memory, with
     * the specified access mode. If an error occurs during creation, it is passed
     * to the callback
     *
     * @param path Path to database file, or ':memory:' for an in memory database.
     * @param mode Either OPEN_READONLY or OPEN_READWRITE
     * @param callback Passed errors that occur during database creation.
     */
    constructor(
      path: string,
      mode: OPEN_READONLY | OPEN_READWRITE,
      callback?: (err: Error) => void
    );

    /**
     * Execute a query using the default connection and invoke a callback with
     * an array of results.
     *
     * @param sql SQL query to execute
     * @param params Query parameters
     * @param callback Callback to receive results or error.
     */
    all(
      sql: string,
      ...params: Scalar[],
      callback?: (error: Error, result: Row[]) => void
    ): Database;

    /**
     * Execute a query using the default connection and invoke a callback with
     * an array of results.
     *
     * @param sql SQL query to execute
     * @param callback Callback to receive results or error.
     */
    all(
      sql: string,
      callback?: (error: Error, result: Row[]) => void
    ): Database;

    /**
     * Execute a query using the default connection and invoke a callback for
     * each row.
     *
     * @param sql SQL query to execute
     * @param params Query parameters
     * @param callback Callback to receive row or error
     */
    each(
      sql: string,
      ...params: Scalar[],
      callback?: (error: Error, result: Row) => void
    ): Database;

    /**
     * Execute a query using the default connection and invoke a callback for
     * each row.
     *
     * @param sql SQL query to execute
     * @param callback Callback to receive row or error
     */
    each(sql: string, callback?: (error: Error, result: Row) => void): Database;

    /**
     * Create a prepared query using the default connection.
     *
     * @param sql SQL query to prepare
     * @param params Query parameters
     * @param callback Callback to receive error.
     *
     */
    prepare(
      sql: string,
      ...params: Scalar[],
      callback?: (error: Error) => void
    ): Statement;

    /**
     * Alias for {@link Database.exec()}. Execute a query without returning
     * results.
     *
     * @param sql SQL query to execute
     * @param params Query parameters
     * @param callback Callback to receive error
     */
    run(
      sql: string,
      ...params: Scalar[],
      callback?: (error: Error) => void
    ): Database;

    /**
     * Alias for {@link Database.exec()}. Execute a query without returning
     * results.
     *
     * @param sql SQL query to execute
     * @param callback Callback to receive error
     */
    run(sql: string, callback?: (error: Error) => void): Database;

    /**
     * Execute a query without returning results.
     *
     * @param sql SQL query to execute
     * @param params Query parameters
     * @param callback Callback to receive error
     */
    exec(
      sql: string,
      ...params: Scalar[],
      callback?: (error: Error) => void
    ): Database;

    /**
     * Execute a query without returning results.
     *
     * @param sql SQL query to execute
     * @param callback Callback to receive error
     */
    exec(sql: string, callback?: (error: Error) => void): Database;

    /**
     * Registers a user defined function for the default connection.
     *
     * @param name UDF name
     * @param returnType SQL return type
     * @param udf User defined function
     * @param callback Callback to receive error
     */
    register(
      name: string,
      returnType: string,
      udf: (...args: unknown[]) => Scalar,
      callback?: (error: Error) => void
    ): Database;

    /**
     * Unregisters a user defined function for the default connection.
     *
     * @param name UDF name
     * @param callback Callback to receive error
     */
    unregister(name: string, callback?: (error: Error) => void): Database;

    /**
     * Creates a new database connection. Shorthand for
     * `new Connection(database)`
     *
     * @return New database connection
     */
    connect(): Connection;

    /**
     * Closes the database.
     *
     * @param callback Callback to receive error
     */
    close(callback?: (err: Error, database: Database) => void): Database;

    /**
     * Serialize
     */

    serialize(callback?: () => void): Database;

    /**
     * Parallelize
     */

    parallelize(callback?: () => void): Database;
  }

  /**
   * An instance of a database connection.
   */
  class Connection {
    /**
     * Constructor for a new database connection.
     *
     * @param db Database to create connection with.
     * @param callback
     */
    constructor(db: Database, callback?: () => void);

    /**
     * Execute a SQL query and invoke a callback with an array of results.
     *
     * @param sql SQL query to execute
     * @param params SQL parameters
     * @param callback Callback to receive results or error.
     */
    all(
      sql: string,
      ...params: Scalar[],
      callback?: (error: Error, result: Row[]) => void
    ): Statement;

    /**
     * Execute a SQL query and invoke a callback with an array of results.
     *
     * @param sql SQL query to execute
     * @param callback Callback to receive results or error.
     */
    all(
      sql: string,
      callback?: (error: Error, result: Row[]) => void
    ): Statement;

    /**
     * Execute a SQL query and invoke a callback for each row.
     *
     * @param sql SQL query to execute
     * @param params Query parameters
     * @param callback Callback to receive row or error.
     */
    each(
      sql: string,
      ...params: Scalar[],
      callback?: (error: Error, result: Row) => void
    ): Statement;

    /**
     * Execute a SQL query and invoke a callback for each row.
     *
     * @param sql SQL query to execute
     * @param callback Callback to receive row or error.
     */
    each(
      sql: string,
      callback?: (error: Error, result: Row) => void
    ): Statement;

    /**
     * Create a prepared query.
     *
     * @param sql SQL query to prepare
     * @param callback Callback to receive error.
     *
     */
    prepare(sql: string, callback?: (error: Error) => void): Statement;

    /**
     * Execute a SQL query without returning results.
     *
     * @param sql SQL query to execute
     * @param params Query parameters
     * @param callback Callback to receive error.
     */
    run(
      sql: string,
      ...params: Scalar[],
      callback?: (error: Error) => void
    ): Statement;

    /**
     * Execute a SQL query without returning results.
     *
     * @param sql SQL query to execute
     * @param callback Callback to receive error.
     */
    run(sql: string, callback?: (error: Error) => void): Statement;

    /**
     * Execute a query and return an iterable result set.
     * @param sql SQL query to execute
     * @param params Query parameters
     */
    stream(sql: string, ...params: Scalar[]): Iterable<Promise<Row>>;

    /**
     * Registers a user defined function.
     *
     * @param name UDF name
     * @param returnType SQL return type
     * @param udf User defined function
     * @param callback Callback to receive error
     */
    register(
      name: string,
      returnType: string,
      udf: (...args: unknown[]) => Scalar,
      callback?: (error: Error) => void
    ): Database;

    /**
     * Unregisters a user defined function.
     *
     * @param name UDF name
     * @param callback Callback to receive error
     */
    unregister(name: string, callback?: (error: Error) => void): Database;

    /**
     * Interrupt (currently not implemented)
     */
    interrupt(): Database;
  }

  /**
   * An instance of a SQL query
   */
  class Statement {
    /**
     * Construct a SQL query to execute against a connection.
     *
     * @param connection Connection to execute query against
     * @param sql SQL query to prepare
     */
    constructor(connection: Connection, sql: string);

    /**
     * Execute a SQL query and return all results as an array to the
     * provided callback.
     *
     * @param params Values with which to execute.
     * @param callback Callback to receive results or error.
     */
    all(
      ...params: Scalar[],
      callback?: (error: Error, result: Row[]) => void
    ): Statement;

    /**
     * Execute a SQL query and invoke a callback for each row.
     *
     * @param params Values with which to execute.
     * @param callback Callback to receive row or error.
     */
    each(
      ...params: Scalar[],
      callback?: (error: Error, result: Row) => void
    ): Statement;

    /**
     * Execute a SQL query without returning results.
     *
     * @param params Values with which to execute.
     * @param callback Callback to receive error.
     */
    run(...params: Scalar[], callback?: (error: Error) => void): Statement;

    /**
     * Execute a query without returning results.
     *
     * @param params Values with which to execute.
     * @param callback Callback to receive error.
     */
    exec(...params: Scalar[], callback?: (error: Error) => void): Statement;

    /**
     * Execute a query and return an iterable result set.

    * @param params Values with which to execute.
     */
    stream(...params: Scalar[]): Iterable<Promise<Row>>;

    /**
     * Release prepared SQL query after use.
     */
    finalize(): void;
  }

  export const ERROR: number;
  export const OPEN_READONLY: Number;
  export const OPEN_READWRITE: Number;
}
