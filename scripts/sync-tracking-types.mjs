/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const mode = process.argv[2] ?? '--check';

if (mode !== '--check' && mode !== '--write') {
  process.stderr.write(
    'Usage: node scripts/sync-tracking-types.mjs [--check|--write]\n'
  );
  process.exit(2);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function packageMajor(versionRange) {
  if (typeof versionRange !== 'string') return undefined;
  const match = versionRange.trim().match(/^[~^]?(\d+)(?:\.\d+){0,2}$/);
  return match ? Number(match[1]) : undefined;
}

function displayPath(filePath) {
  return path.relative(repositoryRoot, filePath).replaceAll('\\', '/');
}

const rootManifestPath = path.join(repositoryRoot, 'package.json');
const rootManifest = readJson(rootManifestPath);
const workspacePaths = Array.isArray(rootManifest.workspaces)
  ? rootManifest.workspaces
  : rootManifest.workspaces?.packages;

if (!Array.isArray(workspacePaths)) {
  throw new Error('Root package.json must declare a workspaces package list.');
}

const manifestPaths = [
  rootManifestPath,
  ...workspacePaths.map(workspacePath => {
    if (workspacePath.includes('*')) {
      throw new Error(
        `Workspace globs are not supported by this check: ${workspacePath}`
      );
    }
    return path.join(repositoryRoot, workspacePath, 'package.json');
  }),
];

const manifests = manifestPaths.map(filePath => ({
  filePath,
  json: filePath === rootManifestPath ? rootManifest : readJson(filePath),
  changed: false,
}));

function dependencyLocations(dependencyName) {
  const locations = [];
  for (const manifest of manifests) {
    for (const section of dependencySections) {
      const versionRange = manifest.json[section]?.[dependencyName];
      if (versionRange !== undefined) {
        locations.push({manifest, section, versionRange});
      }
    }
  }
  return locations;
}

const nodeVersion = fs
  .readFileSync(path.join(repositoryRoot, '.node-version'), 'utf8')
  .trim();
const nodeVersionMatch = nodeVersion.match(
  /^v?(\d+)\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
);

if (!nodeVersionMatch) {
  throw new Error(`Invalid Node version in .node-version: ${nodeVersion}`);
}

const trackingRules = [
  {
    source: `.node-version (${nodeVersion})`,
    target: '@types/node',
    expectedMajor: Number(nodeVersionMatch[1]),
  },
];

const jasmineSources = dependencyLocations('jasmine-core');
const jasmineTargets = dependencyLocations('@types/jasmine');
if (jasmineSources.length > 0 || jasmineTargets.length > 0) {
  const jasmineMajors = new Set(
    jasmineSources.map(source => packageMajor(source.versionRange))
  );
  if (jasmineMajors.has(undefined) || jasmineMajors.size !== 1) {
    throw new Error(
      'jasmine-core declarations must use one parseable shared major.'
    );
  }
  trackingRules.push({
    source: 'jasmine-core',
    target: '@types/jasmine',
    expectedMajor: jasmineMajors.values().next().value,
  });
}

const mismatches = [];
for (const rule of trackingRules) {
  const targets = dependencyLocations(rule.target);
  if (targets.length === 0) {
    throw new Error(`No direct declarations found for ${rule.target}.`);
  }

  for (const target of targets) {
    if (packageMajor(target.versionRange) === rule.expectedMajor) continue;

    const expectedRange = `^${rule.expectedMajor}.0.0`;
    mismatches.push({...target, ...rule, expectedRange});
    if (mode === '--write') {
      target.manifest.json[target.section][rule.target] = expectedRange;
      target.manifest.changed = true;
    }
  }
}

if (mode === '--check' && mismatches.length > 0) {
  process.stderr.write('Tracking type dependencies are out of sync:\n');
  for (const mismatch of mismatches) {
    process.stderr.write(
      `- ${displayPath(mismatch.manifest.filePath)} ` +
        `${mismatch.section}.${mismatch.target}: ` +
        `${mismatch.versionRange}; expected major ` +
        `${mismatch.expectedMajor} from ${mismatch.source}\n`
    );
  }
  process.stderr.write(
    '\nRun npm run sync-tracking-types to repair the manifests.\n'
  );
  process.exit(1);
}

if (mode === '--write') {
  for (const manifest of manifests.filter(candidate => candidate.changed)) {
    fs.writeFileSync(
      manifest.filePath,
      `${JSON.stringify(manifest.json, undefined, 2)}\n`
    );
  }
}

if (mismatches.length === 0) {
  process.stdout.write('Tracking type dependency majors are synchronized.\n');
} else {
  process.stdout.write(
    `Synchronized ${mismatches.length} tracking type ` +
      `declaration${mismatches.length === 1 ? '' : 's'}.\n`
  );
}
