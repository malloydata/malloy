#!/bin/bash

MALLOY_PROTO_SRC=./src/protos
MALLOY_PROTO_DIST=./dist/protos
JS_PLUGIN=../../node_modules/.bin/grpc_tools_node_protoc_plugin
TS_PLUGIN=../../node_modules/.bin/protoc-gen-ts
GRPC_TOOLS_NODE_PROTOC=../../node_modules/.bin/grpc_tools_node_protoc

rm -rf ${MALLOY_PROTO_DIST}
mkdir -p ${MALLOY_PROTO_DIST}

rm -rf ${MALLOY_PROTO_SRC}
mkdir -p ${MALLOY_PROTO_SRC}

# js output
${GRPC_TOOLS_NODE_PROTOC} \
  --js_out=import_style=commonjs,binary:${MALLOY_PROTO_DIST} \
  -I ./protos \
  protos/*.proto

# grpc service output
# ${GRPC_TOOLS_NODE_PROTOC} \
#   --grpc_out=grpc_js:${MALLOY_PROTO_DEST} \
#   -I ./protos \
#   protos/*.proto

# TS type definition output (src)
${GRPC_TOOLS_NODE_PROTOC} \
  --plugin=protoc-gen-ts=${TS_PLUGIN} \
  --ts_out=${MALLOY_PROTO_SRC} \
  -I ./protos \
  protos/*.proto

# TS type definition output (dist)
${GRPC_TOOLS_NODE_PROTOC} \
  --plugin=protoc-gen-ts=${TS_PLUGIN} \
  --ts_out=${MALLOY_PROTO_DIST} \
  -I ./protos \
  protos/*.proto
