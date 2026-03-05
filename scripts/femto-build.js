/*
 * femto-build: A tiny content-hash-based build caching tool.
 *
 * Solves the problem of expensive codegen steps (ANTLR, nearley, peggy,
 * vite, flow types) running on every build even when inputs haven't
 * changed. Unlike Make/ninja (timestamp-based, breaks on git ops) or
 * Turborepo (global hash invalidation in monorepos), this uses SHA-256
 * content hashing with no external build tools.
 *
 * Each package that needs caching has a codegen-config.json with named
 * targets. Each target has input globs and a list of commands:
 *
 *   {
 *     "codegen": {
 *       "inputs": ["src/grammar/*.g4"],
 *       "commands": ["mkdir -p out", "antlr4ts -o out Lexer.g4"]
 *     },
 *     "flow": {
 *       "inputs": ["dist/*.d.ts"],
 *       "commands": ["ts-node ../../scripts/gen-flow.ts"]
 *     }
 *   }
 *
 * Usage: node femto-build.js <target>
 *
 * Digest is stored as .<target>.digest in the package directory.
 * If inputs haven't changed, commands are skipped entirely.
 */

/* eslint-disable n/no-process-exit, n/no-extraneous-require, no-empty */
const {createHash} = require('crypto');
const {readFileSync, writeFileSync, existsSync, unlinkSync} = require('fs');
const {execSync} = require('child_process');
const glob = require('glob');
const path = require('path');

const CONFIG_FILE = 'codegen-config.json';

// Derive a short package-relative label like "packages/malloy:codegen"
const repoRoot = path.resolve(__dirname, '..');
const pkgLabel = path.relative(repoRoot, process.cwd());

const target = process.argv[2];
if (!target) {
  console.error('Usage: femto-build <target>');
  process.exit(1);
}

if (!existsSync(CONFIG_FILE)) {
  console.error(`femto-build: no ${CONFIG_FILE} in ${process.cwd()}`);
  process.exit(1);
}

const allConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
const config = allConfig[target];
if (!config) {
  const targets = Object.keys(allConfig).join(', ');
  console.error(
    `femto-build: no target "${target}" in ${CONFIG_FILE} (have: ${targets})`
  );
  process.exit(1);
}

if (
  !Array.isArray(config.inputs) ||
  !Array.isArray(config.commands)
) {
  console.error(
    `femto-build: target "${target}" must have "inputs" (array) and "commands" (array)`
  );
  process.exit(1);
}

const digestFile = `.${target}.digest`;

function hashFiles(patterns) {
  const hash = createHash('sha256');
  const fileSet = new Set();
  for (const pattern of patterns) {
    for (const f of glob.sync(pattern, {nodir: true})) {
      fileSet.add(f);
    }
  }
  const files = [...fileSet].sort();
  if (files.length === 0) {
    console.error(
      `femto-build: no files matched inputs: ${patterns.join(', ')}`
    );
    process.exit(1);
  }
  for (const file of files) {
    hash.update(file + '\0');
    hash.update(readFileSync(file));
  }
  return hash.digest('hex');
}

// Hash both the input files and the config itself, so changing
// a command (e.g. adding a flag) invalidates the cache.
function computeHash(config) {
  const hash = hashFiles(config.inputs);
  const configHash = createHash('sha256')
    .update(JSON.stringify(config))
    .digest('hex');
  return createHash('sha256').update(hash).update(configHash).digest('hex');
}

const currentHash = computeHash(config);

let storedHash = null;
try {
  if (existsSync(digestFile)) {
    storedHash = readFileSync(digestFile, 'utf-8').trim();
  }
} catch (_) {}

if (currentHash === storedHash) {
  console.log(`${pkgLabel}:${target} up to date`);
  process.exit(0);
}

for (const cmd of config.commands) {
  console.log(`${pkgLabel}:${target} ${cmd}`);
  try {
    execSync(cmd, {stdio: 'inherit', shell: true});
  } catch (e) {
    console.error(`${pkgLabel}:${target} failed: ${cmd}`);
    try {
      unlinkSync(digestFile);
    } catch (_) {}
    process.exit(e.status || 1);
  }
}

writeFileSync(digestFile, currentHash + '\n');
console.log(`${pkgLabel}:${target} done, digest saved`);
