import { LogMessage } from "./lang";

/**
 * A Malloy error, which may contain log messages produced during compilation.
 */
export class MalloyError extends Error {
  /**
   * An array of log messages produced during compilation.
   */
  public readonly log: LogMessage[];

  constructor(message: string, log: LogMessage[] = []) {
    super(message);
    this.log = log;
  }
}

abstract class ResponseBase<T> {
  abstract isError(): this is ErrorResponse<T>;
  abstract map<O>(map: (result: T) => O): Response<O>;
  abstract mapAsync<O>(
    map: (result: T) => O | Promise<O>
  ): Promise<Response<O>>;
  abstract flatMapAsync<O>(
    map: (result: T) => Response<O> | Promise<Response<O>>
  ): Promise<Response<O>>;
  abstract unwrap(): T;

  isSuccess(): this is SuccessResponse<T> {
    return !this.isError();
  }
}

export class SuccessResponse<T> extends ResponseBase<T> {
  isError(): this is ErrorResponse<T> {
    return false;
  }

  constructor(public result: T, public logs: LogMessage[]) {
    super();
  }

  map<O>(map: (result: T) => O): Response<O> {
    return new SuccessResponse(map(this.result), this.logs);
  }

  async mapAsync<O>(map: (result: T) => O | Promise<O>): Promise<Response<O>> {
    return new SuccessResponse(await map(this.result), this.logs);
  }

  async flatMapAsync<O>(
    map: (result: T) => Response<O> | Promise<Response<O>>
  ): Promise<Response<O>> {
    const outResponse = await map(this.result);
    if (outResponse.isError()) {
      return new ErrorResponse([...this.logs, ...outResponse.logs]);
    }

    return new SuccessResponse(outResponse.result, [
      ...this.logs,
      ...outResponse.logs,
    ]);
  }

  unwrap(): T {
    return this.result;
  }
}

export class ErrorResponse<T> extends ResponseBase<T> {
  result = undefined;
  constructor(public logs: LogMessage[]) {
    super();
  }

  isError(): this is ErrorResponse<T> {
    return true;
  }

  map<O>(_: (result: T) => O): Response<O> {
    return new ErrorResponse(this.logs);
  }

  async mapAsync<O>(_: (result: T) => O | Promise<O>): Promise<Response<O>> {
    return Promise.resolve(new ErrorResponse(this.logs));
  }

  async flatMapAsync<O>(
    _: (result: T) => Response<O> | Promise<Response<O>>
  ): Promise<Response<O>> {
    return Promise.resolve(new ErrorResponse(this.logs));
  }

  unwrap(): T {
    const firstError = this.logs.find(
      (message) => message.severity === "error"
    );
    throw new MalloyError(
      firstError?.message || "An unknown error occured",
      this.logs
    );
  }
}

export type Response<T> = SuccessResponse<T> | ErrorResponse<T>;
