python3 -m grpc_tools.protoc -I../../packages/malloy-service/protos --python_out=. --grpc_python_out=. ../../packages/malloy-service/protos/services/v1/*.proto
