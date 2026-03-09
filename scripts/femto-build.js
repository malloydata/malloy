/*
 * femto-build: A tiny content-hash-based build caching tool.
 *
 * Solves the problem of expensive codegen steps (ANTLR, peggy,
 * vite, flow types) running on every build even when inputs haven't
 * changed. Unlike Make/ninja (timestamp-based, breaks on git ops) or
 * Turborepo (global hash invalidation in monorepos), this uses SHA-256
 * content hashing with no external build tools.
 *
 * Each package that needs caching has a femto-config.motly with named
 * targets. Each target has input globs, a list of commands, optional
 * dependencies on other targets, and optional output globs:
 *
 *   lexer: {
 *     inputs = ["src/grammar/Lexer.g4"]
 *     commands = ["antlr4ts -o out Lexer.g4"]
 *   }
 *
 *   parser: {
 *     deps = [lexer]
 *     inputs = ["src/grammar/Parser.g4"]
 *     commands = ["antlr4ts -o out -visitor Parser.g4"]
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
const {MOTLYSession} = require('@malloydata/motly-ts-parser');

const CONFIG_FILE = 'femto-config.motly';

// Derive a short package-relative label like "packages/malloy:codegen"
const repoRoot = path.resolve(__dirname, '..');
const pkgLabel = path.relative(repoRoot, process.cwd());

const requestedTarget = process.argv[2];
if (!requestedTarget) {
  console.error('Usage: femto-build <target | --clean | --help>');
  process.exit(1);
}

if (requestedTarget === '--help' || requestedTarget === '-h') {
  console.log(`femto-build: content-hash caching for codegen steps

Usage: node femto-build.js <target | --clean | --help>

Arguments:
  <target>    Build the named target from ${CONFIG_FILE}
  --clean     Remove all .*.femto.digest files in the current directory
  --help, -h  Show this help message

Config format (${CONFIG_FILE}):
  targetName: {
    inputs = ["src/grammar/*.g4"]        # globs for input files (required unless deps)
    commands = ["tool -o out File.g4"]    # shell commands to run
    deps = [otherTarget]                  # targets that must build first
    outputs = ["out/*.ts"]               # globs to check existence (rebuild if missing)
  }

Behavior:
  - Hashes input files + config + dep digests with SHA-256
  - Skips commands if hash matches stored digest (.{target}.femto.digest)
  - Rebuilds if declared outputs are missing, even if hash matches`);
  process.exit(0);
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

const configText = readFileSync(CONFIG_FILE, 'utf-8');
const session = new MOTLYSession();
const {errors} = session.parse(configText);
if (errors.length > 0) {
  for (const e of errors) {
    console.error(
      `femto-build: ${CONFIG_FILE}:${e.begin.line + 1}:${e.begin.column + 1}: ${e.message}`
    );
  }
  process.exit(1);
}
const allConfig = session.getMot({env: process.env});

function validateTarget(name) {
  const config = allConfig.get(name);
  if (!config.exists) {
    const targets = [...allConfig.keys].join(', ');
    console.error(
      `femto-build: no target "${name}" in ${CONFIG_FILE} (have: ${targets})`
    );
    process.exit(1);
  }
  const commands = config.texts('commands');
  const inputs = config.texts('inputs');
  const deps = config.texts('deps');
  const outputs = config.texts('outputs');
  if (config.has('commands') && !commands) {
    console.error(
      `femto-build: target "${name}" "commands" must be an array of strings`
    );
    process.exit(1);
  }
  if (config.has('inputs') && !inputs) {
    console.error(
      `femto-build: target "${name}" "inputs" must be an array of strings`
    );
    process.exit(1);
  }
  if (config.has('deps') && !deps) {
    console.error(
      `femto-build: target "${name}" "deps" must be an array of strings`
    );
    process.exit(1);
  }
  if (config.has('outputs') && !outputs) {
    console.error(
      `femto-build: target "${name}" "outputs" must be an array of strings`
    );
    process.exit(1);
  }
  if (!inputs && !deps) {
    console.error(
      `femto-build: target "${name}" must have "inputs" and/or "deps"`
    );
    process.exit(1);
  }
  return {commands, inputs, deps, outputs};
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
  combined.update(configText);
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

  // If outputs are declared, check they exist even if hash matches
  let outputsMissing = false;
  if (config.outputs) {
    for (const pattern of config.outputs) {
      if (glob.sync(pattern, {nodir: true}).length === 0) {
        outputsMissing = true;
        break;
      }
    }
  }

  if (!outputsMissing && currentHash === storedHash) {
    console.log(`${label} up to date`);
    built.add(name);
    return;
  }

  console.log(`${mark} ${label}`);
  for (const cmd of config.commands || []) {
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
