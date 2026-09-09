/*
 * femto-build: content-hash caching for codegen steps.
 *
 * Expensive codegen (ANTLR, peggy, vite, flow types) should not re-run when
 * its inputs haven't changed. Make and ninja decide that from timestamps,
 * which git operations scramble; Turborepo invalidates at package
 * granularity. This hashes file content with SHA-256 and needs no external
 * build tool.
 *
 * Run it from the package directory holding the femto-config.motly — the
 * config, every glob, and the digest files all resolve against the current
 * directory:
 *
 *   node ../../scripts/femto-build.js <target>
 *
 * Run with --help for the config format.
 *
 * The hash covers input files, the config text, and dep digests — not the
 * versions of the tools the commands invoke. Bumping antlr4ts or peggy
 * leaves generated files "up to date" until a --clean.
 */

const {createHash} = require('crypto');
const {readFileSync, writeFileSync, existsSync, rmSync} = require('fs');
const {execSync} = require('child_process');
const glob = require('glob');
const path = require('path');
const {MOTLYSession} = require('@malloydata/motly-ts-parser');

const CONFIG_FILE = 'femto-config.motly';
const FIELDS = ['commands', 'inputs', 'deps', 'outputs'];

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

Run from the package directory containing ${CONFIG_FILE}; all paths,
globs, and digest files resolve against the current directory.

Arguments:
  <target>    Build the named target from ${CONFIG_FILE}
  --clean     Remove all .*.femto.digest files in the current directory
  --help, -h  Show this help message

Config format (${CONFIG_FILE}):
  targetName: {
    inputs = ["src/grammar/*.g4"]       # globs for input files (required unless deps)
    commands = ["tool -o out File.g4"]  # shell commands to run
    deps = [otherTarget]                # targets that must build first
    outputs = ["out/Parser.ts"]         # file paths that must exist (rebuild if missing)
  }

Behavior:
  - Hashes input files + config + dep digests with SHA-256
  - Skips commands if hash matches stored digest (.{target}.femto.digest)
  - Rebuilds if declared outputs are missing, even if hash matches`);
  process.exit(0);
}

if (requestedTarget === '--clean') {
  for (const f of glob.sync('.*.femto.digest')) {
    rmSync(f);
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
// No environment is passed to the config: the hash covers the config text,
// so a value interpolated from outside it would change without changing the
// hash.
const allConfig = session.finish().getMot();

function validateTarget(name) {
  const config = allConfig.get(name);
  if (!config.exists) {
    const targets = [...allConfig.keys].join(', ');
    console.error(
      `femto-build: no target "${name}" in ${CONFIG_FILE} (have: ${targets})`
    );
    process.exit(1);
  }
  const target = {};
  for (const field of FIELDS) {
    target[field] = config.texts(field);
    if (config.has(field) && !target[field]) {
      console.error(
        `femto-build: target "${name}" "${field}" must be an array of strings`
      );
      process.exit(1);
    }
    if (config.has(field) && target[field].length === 0) {
      console.error(`femto-build: target "${name}" "${field}" is empty`);
      process.exit(1);
    }
  }
  if (!target.inputs && !target.deps) {
    console.error(
      `femto-build: target "${name}" must have "inputs" and/or "deps"`
    );
    process.exit(1);
  }
  return target;
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

// Must be called after deps are built, so their digest files exist.
function computeHash(config) {
  const combined = createHash('sha256');
  if (config.inputs) {
    combined.update(hashFiles(config.inputs));
  }
  combined.update(configText);
  for (const dep of config.deps || []) {
    combined.update(readFileSync(`.${dep}.femto.digest`, 'utf-8').trim());
  }
  return combined.digest('hex');
}

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

  for (const dep of config.deps || []) {
    buildTarget(dep, depth + 1);
  }

  const digestFile = `.${name}.femto.digest`;
  const currentHash = computeHash(config);
  const storedHash = existsSync(digestFile)
    ? readFileSync(digestFile, 'utf-8').trim()
    : null;

  const label = `${pkgLabel}:${name}`;
  const mark = '>'.repeat(depth + 2);

  const outputsMissing = (config.outputs || []).some(out => !existsSync(out));

  if (!outputsMissing && currentHash === storedHash) {
    console.log(`${label} up to date`);
    built.add(name);
    return;
  }

  console.log(`${mark} ${label}`);
  // Drop the digest before the first command, not after a failed one: a
  // process killed mid-build would otherwise leave a digest describing
  // outputs that were never finished.
  rmSync(digestFile, {force: true});
  for (const cmd of config.commands || []) {
    console.log(`  ${cmd}`);
    try {
      execSync(cmd, {stdio: 'inherit'});
    } catch (e) {
      console.error(`${mark} ${label} failed`);
      process.exit(e.status || 1);
    }
  }

  writeFileSync(digestFile, currentHash + '\n');
  console.log(`${mark} ${label} done`);
  built.add(name);
}

buildTarget(requestedTarget);
