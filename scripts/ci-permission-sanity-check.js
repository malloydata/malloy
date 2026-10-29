/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 * ci-permission-sanity-check: enforce the two CI safety invariants that are
 * otherwise only convention.
 *
 *   1. Every workflow declares a top-level `permissions:`. Without one the job
 *      falls back to the repository default, which is `write` — handing a
 *      repo-scoped write token to whatever the job runs.
 *
 *   2. In any workflow that can run fork-authored code (one triggered by
 *      `pull_request_target` or `pull_request`), a job that can see a
 *      repository secret must `needs: check-permission`. That gate is what
 *      keeps unvouched code away from warehouse credentials.
 *
 * The design these enforce is documented in .github/workflows/CONTEXT.md,
 * under "The design: why external-PR CI is shaped this way".
 *
 * Scope note: this catches a maintainer merging a violation, which is the
 * mistake that actually happens. It is NOT a control against a malicious PR —
 * under `pull_request_target` this script runs from the PR's own checkout, so
 * a hostile PR can edit it. Guard it in review, not here.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const WORKFLOW_DIR = path.join(__dirname, '..', '.github', 'workflows');
const GATE_JOB = 'check-permission';

// GITHUB_TOKEN is injected into every job whether asked for or not; it is not a
// repository secret and its power is governed by `permissions:` (invariant 1).
const NOT_A_REPO_SECRET = new Set(['GITHUB_TOKEN']);

const problems = [];

/** Triggers that can put code from an untrusted fork onto the runner. */
function runsForkCode(doc) {
  const on = doc?.on ?? doc?.true; // yaml 1.1 parses a bare `on:` key as `true`
  if (on === undefined) return false;
  const events = Array.isArray(on)
    ? on
    : typeof on === 'string'
      ? [on]
      : Object.keys(on);
  return events.some(e => e === 'pull_request_target' || e === 'pull_request');
}

/** Every `${{ secrets.NAME }}` reachable from a job definition. */
function secretsReferencedBy(job) {
  const found = new Set();
  const re = /secrets\.([A-Za-z_][A-Za-z0-9_]*)/g;
  let m;
  while ((m = re.exec(JSON.stringify(job))) !== null) {
    if (!NOT_A_REPO_SECRET.has(m[1])) found.add(m[1]);
  }
  // `secrets: inherit` on a reusable-workflow call passes everything without
  // naming anything, so the regex above cannot see it.
  if (job?.secrets === 'inherit') found.add('<inherit>');
  return [...found];
}

const files = fs
  .readdirSync(WORKFLOW_DIR)
  .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
  .sort();

if (files.length === 0) {
  console.error(`Error: no workflow files found in ${WORKFLOW_DIR}`);
  process.exit(1);
}

for (const file of files) {
  const doc = yaml.load(fs.readFileSync(path.join(WORKFLOW_DIR, file), 'utf8'));

  // Invariant 1 — applies to every workflow.
  if (doc?.permissions === undefined) {
    problems.push(
      `${file}: no top-level \`permissions:\`. The repository default is ` +
        'write, so this workflow would receive a repo-scoped write token. ' +
        'Add `permissions: {}` (or the minimum the workflow needs).'
    );
  }

  // Invariant 2 — only where fork-authored code can run.
  if (!runsForkCode(doc)) continue;

  for (const [name, job] of Object.entries(doc?.jobs ?? {})) {
    if (name === GATE_JOB) continue;
    const secrets = secretsReferencedBy(job);
    if (secrets.length === 0) continue;

    const needs = [].concat(job?.needs ?? []);
    if (!needs.includes(GATE_JOB)) {
      problems.push(
        `${file}: job \`${name}\` can see ${secrets.join(', ')} but does not ` +
          `\`needs: ${GATE_JOB}\`. A job may run before the gate only if no ` +
          'secrets are passed to it.'
      );
    }
  }
}

if (problems.length > 0) {
  console.error('CI permission sanity check failed:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    '\nSee .github/workflows/CONTEXT.md, "The design: why external-PR CI is ' +
      'shaped this way".'
  );
  process.exit(1);
}

console.log(
  `Sanity check passed: ${files.length} workflows declare permissions, ` +
    'and no ungated job can see a secret.'
);
