import * as grpc from "@grpc/grpc-js";
import CompilerHandler from "./services/v1/compiler_handler";

const PORT = process.env.PORT || 14310;
const HOST = process.env.HOST || "0.0.0.0";

export function startServer(listeningPort = PORT): grpc.Server {
  const grpcServer = new grpc.Server();

  // @ts-ignore see: https://github.com/agreatfool/grpc_tools_node_protoc_ts/blob/master/doc/server_impl_signature.md
  grpcServer.addService(CompilerHandler.service, CompilerHandler.handler);

  grpcServer.bindAsync(
    `${HOST}:${listeningPort}`,
    grpc.ServerCredentials.createInsecure(),
    (err: Error | null, port: number) => {
      if (err != null) {
        return console.error(err);
      }

      console.log(`Server listening on ${port}`);
      grpcServer.start();
    }
  );

  return grpcServer;
}

startServer();

process.on("uncaughtException", (ex) => {
  console.error(ex);
});

process.on("unhandledRejection", (ex) => {
  console.error(ex);
});
