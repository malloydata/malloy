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
 * targets. Each target has input globs, a list of commands, and
 * optional dependencies on other targets:
 *
 *   {
 *     "lexer": {
 *       "inputs": ["src/grammar/Lexer.g4"],
 *       "commands": ["antlr4ts -o out Lexer.g4"]
 *     },
 *     "parser": {
 *       "deps": ["lexer"],
 *       "inputs": ["src/grammar/Parser.g4"],
 *       "commands": ["antlr4ts -o out -visitor Parser.g4"]
 *     }
 *   }
 *
 * Usage: node femto-build.js <target>
 *
 * Digest is stored as .<target>.femto.digest in the package directory.
 * If inputs (and deps) haven't changed, commands are skipped entirely.
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

const requestedTarget = process.argv[2];
if (!requestedTarget) {
  console.error('Usage: femto-build <target | --clean>');
  process.exit(1);
}

if (requestedTarget === '--clean') {
  for (const f of glob.sync('.*.femto.digest')) {
    unlinkSync(f);
    console.log(`${pkgLabel} removed ${f}`);
  }
  process.exit(0);
}

if (!existsSync(CONFIG_FILE)) {
  console.error(`femto-build: no ${CONFIG_FILE} in ${process.cwd()}`);
  process.exit(1);
}

const allConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));

function validateTarget(name) {
  const config = allConfig[name];
  if (!config) {
    const targets = Object.keys(allConfig).join(', ');
    console.error(
      `femto-build: no target "${name}" in ${CONFIG_FILE} (have: ${targets})`
    );
    process.exit(1);
  }
  if (!Array.isArray(config.commands)) {
    console.error(`femto-build: target "${name}" must have "commands" (array)`);
    process.exit(1);
  }
  if (config.inputs && !Array.isArray(config.inputs)) {
    console.error(`femto-build: target "${name}" "inputs" must be an array`);
    process.exit(1);
  }
  if (config.deps && !Array.isArray(config.deps)) {
    console.error(`femto-build: target "${name}" "deps" must be an array`);
    process.exit(1);
  }
  if (!config.inputs && !config.deps) {
    console.error(
      `femto-build: target "${name}" must have "inputs" and/or "deps"`
    );
    process.exit(1);
  }
  return config;
}

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

// Hash input files, the config itself, and all dep digests.
// Must be called after deps are built so their digest files exist.
function computeHash(config) {
  const combined = createHash('sha256');
  if (config.inputs && config.inputs.length > 0) {
    combined.update(hashFiles(config.inputs));
  }
  combined.update(JSON.stringify(config));
  for (const dep of config.deps || []) {
    combined.update(readFileSync(`.${dep}.femto.digest`, 'utf-8').trim());
  }
  return combined.digest('hex');
}

// Track which targets have been built this invocation
const built = new Set();
const building = new Set();

function buildTarget(name, depth = 0) {
  if (built.has(name)) return;
  if (building.has(name)) {
    console.error(`femto-build: circular dependency detected: ${name}`);
    process.exit(1);
  }
  building.add(name);

  const config = validateTarget(name);

  // Build deps first
  for (const dep of config.deps || []) {
    buildTarget(dep, depth + 1);
  }

  const digestFile = `.${name}.femto.digest`;
  const currentHash = computeHash(config);

  let storedHash = null;
  try {
    if (existsSync(digestFile)) {
      storedHash = readFileSync(digestFile, 'utf-8').trim();
    }
  } catch (_) {}

  const label = `${pkgLabel}:${name}`;
  const mark = '>'.repeat(depth + 2);

  if (currentHash === storedHash) {
    console.log(`${label} up to date`);
    built.add(name);
    return;
  }

  console.log(`${mark} ${label}`);
  for (const cmd of config.commands) {
    console.log(`  ${cmd}`);
    try {
      execSync(cmd, {stdio: 'inherit', shell: true});
    } catch (e) {
      console.error(`${mark} ${label} failed`);
      try {
        unlinkSync(digestFile);
      } catch (_) {}
      process.exit(e.status || 1);
    }
  }

  writeFileSync(digestFile, currentHash + '\n');
  console.log(`${mark} ${label} done`);
  built.add(name);
}

buildTarget(requestedTarget);
