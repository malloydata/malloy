""" Malloy Language Runtime"""

import asyncio
import hashlib
import logging
from pydoc import doc
import grpc
import json
import re
from data.connection import ConnectionInterface
from data.bigquery.bq_connection import BigQueryConnection
from data.duckdb.duckdb_connection import DuckDbConnection
from services.v1 import compiler_pb2
from services.v1 import compiler_pb2_grpc
from pathlib import Path

logging.basicConfig(level=logging.DEBUG)


class MalloyRuntime:
    logger = logging.getLogger(__name__)
    ready_state = [grpc.ChannelConnectivity.READY]
    error_state = [grpc.ChannelConnectivity.TRANSIENT_FAILURE]

    def __init__(self, service=None):
        self._service = service
        self._sql = None

    def using_connection(self, connection: ConnectionInterface):
        self._connection = connection
        return self

    def load_model(self, source):
        self._base_dir = Path(source).resolve().parent
        self._source_name = Path(source).name
        self._source = source
        return self

    async def get_sql(self, query=None, named_query=None):
        try:
            self._sql = None
            await self._run_compile(query=query, named_query=named_query)
            if not self._sql:
                return None

            return self._sql
        except:
            self.logger.error("Failure running query", exc_info=1)
            return None

    async def run_query(self, query=None, named_query=None):
        try:
            sql = await self.get_sql(query=query, named_query=named_query)
            if sql is None:
                self.logger.error("Did not generate any sql", exc_info=1)
                return None

            self.logger.debug("Running query...")
            return self._connection.run_query(self._sql)
        except:
            self.logger.error("Failure running query", exc_info=1)
            return None

    async def _run_compile(self, query=None, named_query=None):
        self._service_ready = asyncio.Event()
        self._compile_completed = asyncio.Event()
        await asyncio.gather(
            self._spawn_service(),
            self.compile(named_query=named_query, query=query))

    async def compile(self, query=None, named_query=None):
        self._is_first_request_sent = False
        self._last_response = None
        self._seen_responses = []
        self._query = query
        self._named_query = named_query
        await self._service_ready.wait()
        try:
            if self._service is None:
                service = "localhost:14310"
            else:
                service = self._service
            async with grpc.aio.insecure_channel(service) as channel:
                try:
                    stub = compiler_pb2_grpc.CompilerStub(channel)
                    self._response_stream = stub.CompileStream(self)
                    state = channel.get_state()
                    while state not in self.ready_state and state not in self.error_state:
                        await channel.wait_for_state_change(state)
                        state = channel.get_state()

                    if state in self.ready_state:
                        await self._compile_completed.wait()
                    else:
                        raise asyncio.exceptions.CancelledError(
                            "Channel not in ready state", state)
                except:
                    self.logger.error("Failed during compile", exc_info=1)
                    self._compile_completed.set()
        except:
            self.logger.error("Failure initializing compiler", exc_info=1)
            self._compile_completed.set()

    def __aiter__(self):
        return self

    async def __anext__(self) -> compiler_pb2.CompileRequest:
        self.logger.debug("__anext__ called")
        request = await self._next_request()
        if (request is None):
            self.logger.info("No more requests, stopping iteration")
            self._compile_completed.set()
            raise StopAsyncIteration

        self.logger.debug("Sending data to compile service")
        self._last_response = None
        return request

    async def _next_request(self) -> compiler_pb2.CompileRequest:
        try:
            if not self._is_first_request_sent:
                self._is_first_request_sent = True
                self.logger.debug("Sending initial compile request")
                compile_request = compiler_pb2.CompileRequest(
                    type=compiler_pb2.CompileRequest.Type.COMPILE,
                    document=self._create_document(Path(self._source).name))

                if not self._named_query is None:
                    compile_request.named_query = self._named_query
                else:
                    compile_request.query = self._query
                return compile_request

            while self._last_response is None and not self._compile_completed.is_set(
            ):
                await self._next_response()

            request = self._generate_next_request()
            return request
        except:
            self.logger.error('Error generating next request', exc_info=1)
            self._compile_completed.set()
            return None

    async def _next_response(self) -> None:
        self.logger.debug("Awaiting response")
        try:
            self._last_response = await self._response_stream.read()
            if self._last_response is None:
                return

            self.logger.debug("Data received")
            last_response_hash = hashlib.md5(
                self._last_response.SerializeToString(
                    deterministic=True)).digest()

            if last_response_hash in self._seen_responses:
                self.logger.warn("Request loop detected, compile stopping")
                self._compile_completed.set()
                return

            self._seen_responses.append(last_response_hash)

            if self._last_response.type == compiler_pb2.CompilerRequest.Type.COMPLETE:
                self.logger.debug("received compile completion")
                self._sql = self._last_response.content
                self._compile_completed.set()
                return

            if self._last_response.type == compiler_pb2.CompilerRequest.Type.UNKNOWN:
                self.logger.error(self._last_response.content)
                self._compile_completed.set()
                return

            self.logger.debug("__Requesting__")
            self.logger.debug(self._last_response)
        except BaseException as ex:
            self._compile_completed.set()
            self.logger.error(ex)

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
                        self._connection.get_schema_for_tables(
                            self._last_response.table_schemas)))

        except Exception as ex:
            self.logger.error("Error generating next request", exc_info=1)
            self._compile_completed.set()

        return None

    service_listening = re.compile('^Server listening on (\d+)$')

    async def _spawn_service(self):
        if not self._service is None:
            self.logger.debug("Using existing service: {}".format(
                self._service))
            self._service_ready.set()
            return

        proc = await asyncio.create_subprocess_shell(
            './service/malloy-service-linux-x64',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT)
        try:
            while not self._compile_completed.is_set():
                line = await proc.stdout.readline()
                if not line is None:
                    sline = line.decode().rstrip()
                    self.logger.debug(sline)
                    if self.service_listening.match(sline):
                        self._service_ready.set()

        finally:
            proc.kill()

    async def _kill_service(self):
        if not self._service_process:
            return
        self._service_process.kill()


async def run4() -> None:
    # runtime = MalloyRuntime(service="localhost:14310").using_connection(
    #     DuckDbConnection(home_dir='../../samples/duckdb/faa')).load_model(
    #         '../../samples/duckdb/faa/7_sessionization.malloy')
    # data = await runtime.run_query('flights_sessionize')
    # if not data is None:
    #     print(data.df())

    # sql = await runtime.get_sql(named_query='flights_sessionize')
    # if not sql is None:
    #     print(sql)

    # sql = await runtime.get_sql(query="""
    # query: flights->{group_by: flight_num}
    # """)
    # if not sql is None:
    #     print(sql)

    # data = await runtime.run_query(query="""
    # query: flights->{group_by: flight_num}
    # """)
    # if not data is None:
    #     print(data.df())

    data = await MalloyRuntime().using_connection(
        BigQueryConnection()
    ).load_model('../../samples/bigquery/faa/flights.malloy').run_query(
        'sessionize_delta_southwest')

    if not data is None:
        print(data.to_dataframe())


if __name__ == '__main__':
    asyncio.run(run4())
