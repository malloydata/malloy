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
): CompileQueryResponse {
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
  console.log(`TOOK: ${took}ms`);

  const {session_id, ...spreadedResponse} = response;
  const withNestResponse = convertToThrift(
    spreadedResponse,
    'CompileQueryResponse'
  ) as CompileQueryResponse;
  // TODO: Remove when session id is part of the response thrift.
  (withNestResponse as CompileQueryResponseWithSessionId).session_id =
    session_id;
  return withNestResponse;
}

function compileQueryStableInternal(
  serializedCompileQueryRequest: string
): string {
  const parsedRequest = JSON.parse(serializedCompileQueryRequest);
  const withNestResponse = compileQueryStableInternalObjRequest(parsedRequest);
  return JSON.stringify(withNestResponse);
}

// Compile Query.
function compileQueryStable(serializedCompileQueryRequest: string): string {
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

    return JSON.stringify(convertToThrift(response, 'CompileQueryResponse'));
  }
}

async function main() {
  const fs = require('fs');
  const filePath = process.argv[2];
  if (filePath === undefined) {
    console.log('Missing file path');
    return;
  }
  const fileContent = fs.readFileSync(filePath, 'utf8');
  console.log(`REQUEST ${fileContent.substring(0, 100)}`);

  const response = compileQueryStable(fileContent);

  console.log(`RESPONSE ${response.substring(0, 100)}`);
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  await wait(1000);
}

main();
