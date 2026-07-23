#!/usr/bin/env node

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

const args = process.argv.slice(2);

if (args[0] === 'check') {
  // One-shot diagnostic mode
  const files = [];
  let format = 'text';
  let globalConfigDir;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      format = args[i + 1];
      i++;
    } else if (args[i] === '--global-config-dir' && args[i + 1]) {
      globalConfigDir = args[i + 1];
      i++;
    } else if (!args[i].startsWith('-')) {
      files.push(args[i]);
    }
  }

  if (files.length === 0) {
    console.error('Usage: malloy-language-server check <file.malloy> [file2.malloy ...] [--format text|json] [--global-config-dir <path>]');
    process.exit(1);
  }

  const {check} = require('../dist/check');
  check(files, {format, globalConfigDir}).then((exitCode) => {
    process.exit(exitCode);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  // Long-lived LSP server mode (stdio)
  const {createConnection, ProposedFeatures} = require('vscode-languageserver/node');
  const {createServer, CommonConnectionManager, NodeURLReader} = require('../dist/index');
  const os = require('os');
  const {pathToFileURL} = require('url');

  // Try to load backends (optional)
  try { require('@malloydata/malloy-connections'); } catch {}
  try { require('@malloydata/db-publisher'); } catch {}

  const {ConnectionFactory} = require('../dist/common/connections/types');

  const connection = createConnection(ProposedFeatures.all);
  const urlReader = new NodeURLReader();
  const connectionManager = new CommonConnectionManager(
    {}, // Empty factory — backends registered via side-effect imports above
    {
      expandHome: (path) => path.replace(/^~/, os.homedir()),
      pathToFileURL: (path) => pathToFileURL(path),
    }
  );
  connectionManager.setURLReader(urlReader);

  // Parse optional flags
  let globalConfigDir;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--global-config-dir' && args[i + 1]) {
      globalConfigDir = args[i + 1];
      i++;
    }
  }
  if (globalConfigDir) {
    connectionManager.setGlobalConfigDirectory(globalConfigDir);
  } else if (process.env['MALLOY_GLOBAL_CONFIG_DIR']) {
    connectionManager.setGlobalConfigDirectory(process.env['MALLOY_GLOBAL_CONFIG_DIR']);
  }

  createServer(connection, connectionManager, {urlReader});
}
