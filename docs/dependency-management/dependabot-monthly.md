# Dependabot — monthly version-update pass

An agent-agnostic runbook. It's plain procedure — a human, or any coding agent, can follow
it. Bind it to whatever tool you use however you like; the knowledge lives here, in the
tree, so no contributor is forced into a particular AI. This is a living document — if a
step is unclear or wrong when you run it, fix it here.

The once-a-month walk over Dependabot's **version-update PRs** (`.github/dependabot.yml`
groups). Not the security alert tab, and not the pin ledger's release review — those are the
npm-security-audit runbook (`npm-security-audit.md`), run on advisory publication
rather than this cadence.

The spine of this runbook is **stop if there are anomalies; don't doggedly make it happen.**
Exactly one thing merges unattended — the minor-and-patch group, and only on green.
Everything else is staged and handed back. Every task below names what halts it.

Do these in roughly this order.

0) **Orient (read-only).** Read the repo-root `CONTEXT.md`, this directory's `CONTEXT.md`
   (the pin ledger — source of truth for what's held and why), and `.github/dependabot.yml`
   (whose `ignore:` list is the machine-readable set of held package names). You reconcile
   against these — you don't carry the pin list in your head.

1) **Gather.** `gh pr list --author 'app/dependabot' --state open --json number,title,createdAt`.
   Classify each PR by its title's group: `minor-and-patch`, `connectors`, `toolchain`, or
   `duckdb`. Standalone (ungrouped) PRs are majors that fell out of a group — treat them as
   majors in step 3. (If the taxonomy of Dependabot groups changes, this list must change
   with it.)

## 2. The minor-and-patch group — the only thing that auto-merges

If there's no open minor-and-patch PR this month, say so and move on.

**Anomaly gates first — read the PR body's bump list and check all three. Any trip → halt,
name it, do not merge:**

- **A member is a held package.** Cross-check every bumped package against the
  `dependabot.yml` `ignore:` names. A held package appearing in this group means an ignore
  is leaking (the Databricks trap — #2934 reverting #2888). Stop.
- **A member is a `0.x` published/runtime dep.** A `0.x` minor is allowed to break (the
  "0.x trap"). A `0.x` *dev-tool* bump with a green canary is fine; a `0.x` bump of a dep
  that ships in an `@malloydata` package gets eyes-on. Stop and flag.
- **A member is actually a major.** Can't happen by group definition — but verify the
  from→to on each. If one is a major, the group is misconfigured. Stop.

**Gates clean → take it to green, then merge:**

1. Vouch CI yourself — this runbook grants the "Re-run all jobs" authorization. It's safe
   here specifically: this is Dependabot bumping our *own* declared deps (first-party), not
   an outside contributor's code, so granting CI the repo secrets carries none of the
   external-PR risk. Re-run via the run's URL from `gh pr checks <n>`, or `gh run rerun
   <run-id>` (you may have to run-all, as the pull-and-build artifact may have aged out).
2. Wait for checks to finish (`gh pr checks <n>` — poll, don't re-run the command in a
   tight loop). Require **all green**. `consumer-canary` is the load-bearing one: it
   esbuild-bundles and ts-jest-loads the packages the way the vscode extension and
   malloy-cli do, so a producer-green build that would break a consumer is caught here.
   Not fully green → halt, report which check is red.
3. All green → `gh pr merge <n> --squash`. Report merged.

## 3. What's left — the majors and other groups

`connectors`, `toolchain`, and standalone majors. None of these act — you present each for
the user's call. Three buckets:

- **Take it** — with the local code changes the bump needs; scope that work.
- **Pin + ignore + document** — a deliberate hold; stage both surfaces and the ledger entry.
- **File an issue and defer** — the default for a major with no reason-to-move yet.

**The `duckdb` group is a glance, not a decision.** It's carved out of the auto-merge and
gets its own PR precisely so a duckdb bump is taken on purpose — but month to month the
answer is usually skip. The signal for when to actually take it is the **publish-age of the
version we're pinned to**, read live: `npm view <pkg> time --json` for each `@duckdb/*`
dep, look up our pinned version's publish date, and report "ours is N months old (latest is
M)". Nudge to take it only when our pinned version crosses **~6 months**; below that, "fine,
skip". Don't count releases-behind for `@duckdb/duckdb-wasm` — it ships daily `-dev` builds
(400+ versions), so publish-age is the only sane measure. Taking it early for a feature
needs no bookkeeping: the age is read from npm each run, so the clock resets itself.

Note the recurring case: a major that reappears every month is a major with **no ignore** —
either take it or silence it, or it nags forever. That's the whole point of "everything
ignored is written down."

## Report

- Minor-and-patch: merged, or halted at <gate/check>.
- Majors / other groups: the list needing your decision, one line each.

Then stop.
