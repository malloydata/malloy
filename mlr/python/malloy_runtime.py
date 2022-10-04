""" Malloy Language Runtime"""

import grpc
import json
from data.bigquery import bq_utils
from services.v1 import compiler_pb2
from services.v1 import compiler_pb2_grpc
from pathlib import Path


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
        # By Name?
        query="sessionize"
        # By Malloy Query?
        #       query="""
        # query: sessionize is {
        #   group_by: flight_date is dep_time.day
        #   group_by: carrier
        #   aggregate: daily_flight_count is flight_count
        #   nest: per_plane_data is {
        #     top: 20
        #     group_by: tail_num
        #     aggregate: plane_flight_count is flight_count
        #     nest: flight_legs is {
        #       order_by: 2
        #       group_by:
        #         tail_num
        #         dep_minute is dep_time.minute
        #         origin_code
        #         dest_code is destination_code
        #         dep_delay
        #         arr_delay
        #     }
        #   }
        # }
        #       """
    )


def run():
    with grpc.insecure_channel('localhost:14310') as channel:
        stub = compiler_pb2_grpc.CompilerStub(channel)
        request = create_request()
        print("Sending request..")
        # print(request)
        try:
            response = stub.Compile(request)
            print("Received response: ")
            print(response.sql)
        except grpc.RpcError as ex:
            print(ex.details())


if __name__ == '__main__':
    run()
