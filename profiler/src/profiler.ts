/* eslint-disable no-console */
import {API} from '@malloydata/malloy';
import type {
  CompileQueryResponse,
  CompileQueryRequest,
} from '@malloydata/malloy-interfaces';
import {
  convertFromThrift,
  convertToThrift,
} from '@malloydata/malloy-interfaces';

type CompileQueryRequestWithSessionId = CompileQueryRequest & {
  session_id?: string;
};

type CompileQueryResponseWithSessionId = CompileQueryResponse & {
  session_id?: string;
};

function compileQueryStableInternalObjRequest(
  parsedRequest: CompileQueryRequestWithSessionId
): {response: CompileQueryResponse; time: number} {
  const sessionId = parsedRequest.session_id;
  delete parsedRequest.session_id;
  const request = convertFromThrift(
    parsedRequest,
    'CompileQueryRequest'
  ) as CompileQueryRequest;

  const now = Date.now();
  const response = API.sessioned.compileQuery(request, {
    ttl: {
      seconds: 300,
    },
    session_id: sessionId,
  });
  const end = Date.now();
  const took = end - now;

  const {session_id, ...spreadedResponse} = response;
  const withNestResponse = convertToThrift(
    spreadedResponse,
    'CompileQueryResponse'
  ) as CompileQueryResponse;
  // TODO: Remove when session id is part of the response thrift.
  (withNestResponse as CompileQueryResponseWithSessionId).session_id =
    session_id;
  return {response: withNestResponse, time: took};
}

function compileQueryStableInternal(serializedCompileQueryRequest: string): {
  response: string;
  time: number;
} {
  const parsedRequest = JSON.parse(serializedCompileQueryRequest);
  const {response, time} = compileQueryStableInternalObjRequest(parsedRequest);
  return {response: JSON.stringify(response), time};
}

// Compile Query.
export function compileQueryStable(serializedCompileQueryRequest: string): {
  response: string;
  time: number | undefined;
} {
  try {
    return compileQueryStableInternal(serializedCompileQueryRequest);
  } catch (e) {
    const response: CompileQueryResponse = {
      logs: [
        {
          message: `Failed to compile Query ${
            e instanceof Error
              ? `${e.message} ${e.stack ?? ''}`
              : JSON.stringify(e)
          }`,
          severity: 'error',
          // TODO: location should be optional.
          url: '',
          range: {
            start: {
              line: 0,
              character: 0,
            },
            end: {
              line: 0,
              character: 0,
            },
          },
        },
      ],
    };

    return {
      response: JSON.stringify(
        convertToThrift(response, 'CompileQueryResponse')
      ),
      time: undefined,
    };
  }
}
