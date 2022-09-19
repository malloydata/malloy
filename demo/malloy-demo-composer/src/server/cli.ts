import { exec } from "child_process";
import { Command } from "commander";

const program = new Command();

program
  .name("malloy-composer-cli")
  .description("CLI tool for Malloy Composer server")
  .version("0.0.1")
  .option("-p, --port <integer>", "Port for server to listen on", "4000")
  .option("-h, --host <string>", "Hostname for server to bind to", "localhost");

program.parse();

let composerProcess = exec("node ./dist/server/server.js", {
  env: {
    ...process.env,
    PORT: `${program.opts().port}`,
    HOST: `${program.opts().host}`,
  },
});

composerProcess.stdout?.pipe(process.stdout);
composerProcess.stderr?.pipe(process.stderr);
