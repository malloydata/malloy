""" Malloy Language Runtime"""

import asyncio
import collections
import threading
import hashlib
from pydoc import doc
import grpc
import json
import time
import pandas
from data.bigquery import bq_utils
from services.v1 import compiler_pb2
from services.v1 import compiler_pb2_grpc
from pathlib import Path
from typing import Iterator


def create_request():
    return compiler_pb2.CompileRequest(
        document=compiler_pb2.CompileDocument(
            url="mlr://flights.malloy",
            content=Path(
                '../../samples/bigquery/faa/flights.malloy').read_text()),
        references=[
            compiler_pb2.CompileDocument(
                url="mlr://flights.malloy/airports.malloy",
                content=Path(
                    '../../samples/bigquery/faa/airports.malloy').read_text())
        ],
        schema=json.dumps(
            bq_utils.get_schema_for_tables([
                "malloy-data.faa.airports", "malloy-data.faa.carriers",
                "malloy-data.faa.aircraft_models", "malloy-data.faa.aircraft",
                "malloy-data.faa.flights"
            ])),
        query="sessionize_delta_southwest")


def run1():
    print("Run started")
    start = time.perf_counter()
    with grpc.insecure_channel('localhost:14310') as channel:
        stub = compiler_pb2_grpc.CompilerStub(channel)
        stub_creation = time.perf_counter()
        request = create_request()
        request_creation = time.perf_counter()
        print("Sending request..")
        # print(request)
        try:
            response = stub.Compile(request)
            compile_response_received = time.perf_counter()
            print("Received response...")
            results = bq_utils.run_query(response.sql).to_dataframe()

            print(results['per_plane_data'][0][0]['tail_num'])
            query_completed = time.perf_counter()
            print(results)
        except grpc.RpcError as ex:
            print(ex.details())

        print("Performance stats:")
        print("channel/stub creation: {} s".format(stub_creation - start))
        print("request creation: {} s".format(request_creation -
                                              stub_creation))
        print("compile time: {} s".format(compile_response_received -
                                          request_creation))
        print("query time: {} s".format(query_completed -
                                        compile_response_received))


class SchemaProvider:

    def get_schema_for_tables(tables) -> dict[str, dict]:
        pass


class QueryRunner:

    def run_query(sql) -> pandas.DataFrame:
        pass


class BigQueryConnection(SchemaProvider, QueryRunner):

    def get_schema_for_tables(tables) -> dict[str, dict]:
        return bq_utils.get_schema_for_tables(tables)

    def run_query(sql) -> pandas.DataFrame:
        return bq_utils.run_query().to_dataframe()


class MalloyLanguageRuntime:

    def __init__(self,
                 schemaProvder=None,
                 queryRunner=None,
                 connection=BigQueryConnection()):
        self.schemaProvider = schemaProvder or connection
        self.queryRunner = queryRunner or connection

    def loadModelFromFile(self, filePath):
        with grpc.insecure_channel('localhost:14310') as channel:
            stub = compiler_pb2_grpc.CompilerStub(channel)
            try:
                request = self._create_request(
                    document=self._create_document(filePath))
                print(request)
                stub.Compile(request)
            except grpc.RpcError as ex:
                print("caught exception")
                print(ex.details())

        return self

    def _create_request(self,
                        document,
                        references=None,
                        schema=None) -> compiler_pb2.CompileRequest:
        request = compiler_pb2.CompileRequest(document=document)

        return request

    def _create_document(self,
                         filePath,
                         basePath=None) -> compiler_pb2.CompileDocument:
        document = compiler_pb2.CompileDocument()
        document.url = "mlr://{}".format(Path(filePath).resolve())
        document.content = Path(filePath).read_text()
        return document


def run():

    MalloyLanguageRuntime().loadModelFromFile(
        '../../samples/bigquery/faa/flights.malloy')


class CompileClient(object):

    def __init__(self):
        print('Init CompileClient')
        self._stop_event = threading.Event()
        self._request_condition = threading.Condition()
        self._response_condition = threading.Condition()
        self._requests = collections.deque()
        self._last_request = None
        self._expected_responses = collections.deque()
        self._responses = {}

    def _next(self):
        print("_next called")
        with self._request_condition:
            print("_next with self._request_condition")
            while not self._requests and not self._stop_event.is_set():
                self._request_condition.wait()
            if (len(self._requests) > 0):
                return self._requests.popleft()
            else:
                raise StopIteration()

    def next(self):
        print("next called")
        return self._next()

    def __next__(self):
        print("__next__ called")
        return self._next()

    def add_response(self, response):
        print("add_response called")
        with self._response_condition:
            request = self._expected_responses.popleft()
            self._responses[request] = response
            self._response_condition.notify_all()

    def add_request(self, request):
        print("add_request called")
        with self._request_condition:
            self._requests.append(request)
            with self._response_condition:
                self._expected_responses.append('another message')
            self._request_condition.notify()

    def close(self):
        print("close called")
        self._stop_event.set()
        with self._request_condition:
            self._request_condition.notify()
            print("self._request_condition.notify()")

    def compile(self, to_compile):
        print("compile called")
        self.add_request(to_compile)
        with self._response_condition:
            while True:
                self._response_condition.wait()
                if ('another message' in self._responses):
                    print("compile returning")
                    return self._responses['another message']


def _run_compile(address, compile_client):
    with grpc.insecure_channel(address) as channel:
        stub = compiler_pb2_grpc.CompilerStub(channel)
        responses = stub.CompileStream(compile_client)
        for response in responses:
            compile_client.add_response(response)


def run2() -> None:
    print("Run started")
    compile_client = CompileClient()
    client_thread = threading.Thread(target=_run_compile,
                                     args=('localhost:14310', compile_client))
    client_thread.start()

    request = compiler_pb2.CompileRequest()
    compile_client.compile(request)

    compile_client.close()
    print("Client thread alive? {}".format(client_thread.is_alive()))
    client_thread.join()


def compiler_request_handler(
        response_iterator: Iterator[compiler_pb2.CompilerRequest]) -> None:
    for response in response_iterator:
        print(response.type == compiler_pb2.CompilerRequest.Type.IMPORT)


class StreamingCompiler:

    def __init__(self, source):
        self._request_condition = threading.Condition()
        self._response_condition = threading.Condition()
        self._is_compile_complete = threading.Event()
        self._source = source
        self._next_request = compiler_pb2.CompileRequest()
        self._next_request.document.CopyFrom(
            compiler_pb2.CompileDocument(url="mlr://flights.malloy",
                                         content=Path(
                                             self._source).read_text()))

    def __iter__(self) -> compiler_pb2.CompileRequest:
        print("__iter__ called")
        raise NotImplemented()

    def __next__(self) -> compiler_pb2.CompileRequest:
        print("__next__ called")
        with self._request_condition:
            while not self._is_compile_complete.is_set():
                print("Going to wait for request condition")
                self._request_condition.wait()
                print("request condition met")
                if self._next_request != None:
                    print("returning next request")
                    request = self._next_request
                    self._next_request = None
                    return request

                print("No more requests, stopping stream")
                raise StopIteration()

    def compile(self) -> None:
        print("compile called")
        with grpc.insecure_channel("localhost:14310") as channel:
            stub = compiler_pb2_grpc.CompilerStub(channel)
            self._response_iterator = stub.CompileStream(self)
            self._listen_for_responses()

    def _listen_for_responses(self) -> None:
        print("listen for responses called")
        with self._request_condition:
            self._request_condition.notify()

            with self._response_condition:
                print("Going to wait for response condition")
                self._response_condition.wait()
                print("response condition met")
                for response in self._response_iterator:
                    print("Response type: {}".format(response.type))


def run3() -> None:
    print("run3 started")
    compiler = StreamingCompiler('../../samples/bigquery/faa/flights.malloy')
    compile_thread = threading.Thread(target=compiler.compile)
    compile_thread.start()
    compile_thread.join()


class AsyncCompiler:

    def load_model(self, source):
        self._base_dir = Path(source).resolve().parent
        self._source_name = Path(source).name
        self._source = source
        return self

    async def run_query(self, query):
        await self.compile(query)
        if not self._sql:
            return None

        print('Running query')
        return bq_utils.run_query(self._sql).to_dataframe()

    async def compile(self, query):
        self._compile_completed = asyncio.Event()
        self._is_first_request_sent = False
        self._last_response = None
        self._seen_responses = []
        self._query = query
        async with grpc.aio.insecure_channel("localhost:14310") as channel:
            stub = compiler_pb2_grpc.CompilerStub(channel)
            self._response_stream = stub.CompileStream(self)
            await self._compile_completed.wait()

    def __aiter__(self):
        return self

    async def __anext__(self) -> compiler_pb2.CompileRequest:
        print("__anext__ called")
        request = await self._next_request()
        if (request is None):
            print("No more requests, stopping iteration")
            self._compile_completed.set()
            raise StopAsyncIteration
        print("Sending data to compile service")
        self._last_response = None
        return request

    async def _next_request(self) -> compiler_pb2.CompileRequest:
        if not self._is_first_request_sent:
            self._is_first_request_sent = True
            print("Sending initial compile request")
            return compiler_pb2.CompileRequest(
                type=compiler_pb2.CompileRequest.Type.COMPILE,
                document=self._create_document(Path(self._source).name),
                query=self._query)

        while self._last_response is None and not self._compile_completed.is_set(
        ):
            await self._next_response()

        request = self._generate_next_request()
        return request

    async def _next_response(self) -> None:
        print("Awaiting response")
        try:
            self._last_response = await self._response_stream.read()
            print("Data received")
            last_response_hash = hashlib.md5(
                self._last_response.SerializeToString(
                    deterministic=True)).digest()

            if last_response_hash in self._seen_responses:
                print("Request loop detected, compile stopping")
                self._compile_completed.set()
                return

            self._seen_responses.append(last_response_hash)

            if self._last_response.type == compiler_pb2.CompilerRequest.Type.COMPLETE:
                print("received compile completion")
                self._sql = self._last_response.content
                self._compile_completed.set()
                return

            print("__Requesting__")
            print(self._last_response)
        except BaseException as ex:
            self._compile_completed.set()
            print(ex)

    def _create_document(self, path) -> compiler_pb2.CompileDocument:
        filePath = path
        if (path != self._source_name):
            filePath = path.removeprefix(
                self._source_name +
                "/")  # Might be a bit hacky to remove "/" this way

        return compiler_pb2.CompileDocument(url="mlr://{}".format(path),
                                            content=Path(
                                                self._base_dir,
                                                filePath).read_text())

    def _generate_next_request(self) -> compiler_pb2.CompileRequest:
        if self._compile_completed.is_set():
            return None

        if self._last_response is None:
            return None

        if self._last_response.type == compiler_pb2.CompilerRequest.Type.UNKNOWN:
            return None

        try:
            if self._last_response.type == compiler_pb2.CompilerRequest.Type.IMPORT:
                request = compiler_pb2.CompileRequest(
                    type=compiler_pb2.CompileRequest.Type.REFERENCES)
                imports = []
                for url in self._last_response.import_urls:
                    imports.append(self._create_document(url))
                request.references.extend(imports)
                return request

            if self._last_response.type == compiler_pb2.CompilerRequest.Type.TABLE_SCHEMAS:
                return compiler_pb2.CompileRequest(
                    type=compiler_pb2.CompileRequest.Type.TABLE_SCHEMAS,
                    schema=json.dumps(
                        bq_utils.get_schema_for_tables(
                            self._last_response.table_schemas)))

        except BaseException as ex:
            print("I Failed")
            print(ex)

        return None


async def run4() -> None:
    malloy = AsyncCompiler()
    malloy.load_model('../../samples/bigquery/faa/flights.malloy')
    data = await malloy.run_query("sessionize_delta_southwest")
    print(data)


if __name__ == '__main__':
    asyncio.run(run4())
