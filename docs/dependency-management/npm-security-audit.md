# npm security audit — the shipped-dependency security sweep

Driven by `npm audit`, not Dependabot — Dependabot only appears at the edges (dismissing
an accepted alert with a reason in §6). The monthly version-update pass *is* the
Dependabot one; this isn't, which is why it's named for its actual engine.

An agent-agnostic runbook — plain procedure a human or any coding agent can follow. Bind it
to whatever tool you use; the knowledge lives here in the tree so no contributor is forced
into a particular AI. This is a living document — if a step is unclear or wrong when you run
it, fix it here.

The security pass. Not the monthly version-update rhythm — that's [`dependabot-monthly.md`](dependabot-monthly.md).
This runs whenever, and its job is to make an unbounded alert surface **painless**: whoever
runs it should read a few lines, approve one PR, and answer at most a couple of questions.

**The input is `npm audit --omit=dev`, not the Dependabot alert tab.** Same advisory data,
but audit dedupes it and splits dev from shipped in one command; the alert tab (dozens of
per-path duplicate rows) is only touched at the end, to dismiss-with-reason the ones we
accept, so it stays a signal.

**The spine: reconciliation buys silence.** Anything that maps to a known ledger entry prints
*nothing*. The 150-line report only exists if you print the knowns — so don't. The bulk is
already absorbed by the ledger; only genuinely-new or trigger-firing findings cost a line.

**One principle behind the version traps below.** A version number is a *proxy* for safety,
and a lossy one — it can't see a native binary, a module format, or a `0.x` break. Whenever
version math (same-major, newer-exists) disagrees with a hold's **documented reason**, the
reason wins. The `0.x`, mid-major native/ESM-boundary, and "same-major isn't safe" cautions in
§3 and §7 are all instances of this single rule.

## 0. Orient (read-only)

Read the repo-root `CONTEXT.md`, **this directory's `CONTEXT.md`** (the pin ledger — the record
of every decision already made), and `.github/dependabot.yml`'s `ignore:` list. You reconcile
against the ledger; you do not re-decide.

## 1. Sweep

`npm audit --omit=dev --json`. That's *approximately* the shipped-dependency universe — but in
a monorepo `--omit=dev` is **leaky**: a workspace package can declare a dev tool as a plain
`dependency` (e.g. `test/` declaring `@jest/globals`), and it then rides through as if shipped.
So before treating any tool-shaped finding (jest, js-yaml, karma, storybook…) as real shipped
exposure, check whether a workspace **mis-declared** it as a runtime dep. If so, it's dev
tooling in disguise — out of scope, and the actual fix is the mis-declaration, not the advisory.

## 2. Reconcile each finding against the ledger — most go silent

For each finding, trace it to the **direct dep** that pulls it, and look that up in the ledger:

- **A documented hold, its exit-trigger not fired** → known cost. **Silent** — just count it.
- **A not-yet-upgraded connector** (the ledger's "Not pins — context" list) → known
  maintenance debt. **Silent** — count it.
- **A hold whose own exit-trigger just fired** — e.g. a hold that says "revisit when a
  security advisory forces our hand" (snowflake, databricks) and a fresh critical landed **on
  the SDK itself**. A fired trigger is **not** automatically "go act." Before surfacing it,
  check whether a version **you'd actually take** *clears* the advisory:
    - a takeable version clears it → **surface as actionable** (the decision's terms are met).
    - no takeable version clears it — the fix is a no-op at the next release and only lands in a
      version gated behind the hold's *own* blocker (thrift: `1.16` is a no-op, the fix is in
      `2.0`, which the Databricks native-kernel hold already blocks) → **not actionable.** The
      hold stands; what changed is the **cost**. Route it to the "cost changed" zone (§5) and
      update the ledger's cost line — don't raise it as work.
- **Maps to nothing in the ledger** → **new exposure. Surface it.**

## 3. Classify what surfaced — safely-fixable vs needs-a-decision

- **Safely fixable → the batch:**
  - a **direct** dep with an in-range patch → bump it.
  - a **transitive** dep fixable by a **same-major `overrides`** entry — same major is *usually*
    API-compatible, and the parent's own CI (§4) proves it. But "same major" is the proxy, not
    the guarantee (see the principle up top). Two ways it lies:
    - **`0.x`:** below `1.0.0` the *minor* is the breaking axis, so `0.16 → 0.23` is a breaking
      jump — treat any `0.x`-minor bump as a major and send it to needs-a-decision (thrift).
    - **mid-major native/ESM boundary:** if a hold's reason is a binary/module-format boundary
      *inside* the major line (see §7's trap), a same-major `overrides` past it breaks downstream
      exactly as the hold warns. Defer to the ledger's boundary.
- **Needs a decision → the short list:**
  - a **transitive** fix that needs a **parent (connector) bump**, or an **override across a
    major** (or across one of the boundaries above) → accept-as-cost / force-the-bump / wait.
  - a **new direct dep whose only fix breaks us** → the birth of a new hold.
  - any **major**.

## 4. Stage the safe batch as one PR — locally where you can, PR-verified for the rest

Branch off `main`. Apply the fixes **by hand** — edit the version, add the `overrides` entry
directly. Do **not** lean on `npm audit fix`: with holds in the tree it dies on `ERESOLVE`
(the Vega v5 hold alone makes the tree unsatisfiable to the auto-fixer). Then mind what you can
and can't verify locally:

- Run `npm run precheck` and require it green — that's the loop you *can* close on a dev machine.
- `consumer-canary` — the check that actually proves an `overrides` didn't break a parent's
  runtime expectations — is **CI-only**; you cannot produce it locally. So local precheck green
  is necessary but **not sufficient**: stage green locally, push, and let the PR's
  `consumer-canary` be the real verdict.

**Do not merge — stage it and hand it back.** If the PR's CI goes red, the override wasn't safe
→ demote that finding to needs-a-decision and re-stage the rest.

## 5. The report — this is the whole output, keep it this short

```
Security sweep — N prod findings

37 vulnerabilities (4 low, 19 moderate, 13 high, 1 critical)   ← npm's own summary line

Every CRITICAL and HIGH mapped to the pin it reconciles to (low/moderate stay a count):
  critical  fast-xml-parser              → Snowflake hold (snowflake-sdk 2.3.1)
  high      fast-xml-parser, axios       → Snowflake hold
  high      thrift                       → Databricks hold (@databricks/sql 1.15.0)
  high      axios, trino-client          → Trino connector maintenance
  high      vega ×6                      → Vega v5 renderer hold (vega-lite ^5)
  high      ws, tmp, socket.io-parser    → dev tooling, never ships (out of scope)

✓ M reconcile to documented holds / known maintenance — no action
→ K safely fixable — staged in <branch>, CI green:  open the PR?
~ L a hold's cost changed — ledger update, no action forced:
    <pkg> — <hold>: <fix got cheaper: X now takeable> | <cost now includes new advisory Y>
? J need you:
    <pkg>  <sev>  — <the one choice in a clause>  → <your lean>
```

- **Lead with the severity breakdown.** Reproduce npm's own summary line
  (`37 vulnerabilities (4 low, 19 moderate, 13 high, 1 critical)`), then name **every
  critical and high** and the pin it reconciles to — group by pin, and flag the dev-only
  ones as out of scope. This is the *receipts* for zone ✓: it proves the criticals are
  **held, not missed**, and it's cheap because criticals/highs are few. Low and moderate
  stay a count (they're the connector `uuid`/`bn.js`/`axios` churn under the same holds,
  plus dev tooling). Note the count is npm's full-tree number (it includes dev); the
  map is where you separate shipped-and-held from dev-only.
- Zone ✓ is a **count, never a list**.
- Zone → is **one PR to approve**.
- Zone ~ is holds that **didn't move but whose cost description shifted**: a fix that got
  *cheap* (a newly-takeable version with the trigger unfired — the release-walk's opportunity)
  or a cost that got *heavier* (a fired trigger no takeable version clears — §2). These are
  ledger edits, not decisions — list them so the ledger stays honest, and they reconcile as
  "known" next sweep.
- Zone ? is **one line per decision**, with a recommendation. If J = 0, say "nothing needs
  you" and stop.

## 6. Accept-as-cost writes to the ledger (and dismisses the alert)

When you decide a finding is a documented cost (can't safely fix, not worth the break), it
**graduates into a ledger entry** — so next sweep it reconciles as "known" and goes silent.
That's how the report stays short over time. Optionally dismiss the matching Dependabot alert
with a reason (`gh api ... -f state=dismissed -f dismissed_reason=...`) so the alert tab keeps
reflecting reality. This (and a cost-line update from §2/§5) is the only write this runbook
makes to the ledger; never re-frame it.

## 7. Pin release-walk — the deliberate half

Separate from the sweep: for every hold in the ledger, ask *can we release it yet?* This is
work-triggered, not advisory-triggered.

- **Read each blocking issue, one sentence of status.** `gh issue view <N>` for the issue a
  hold names (#2950 motherduck, #2918 vscode-textmate, #2928 pg, #2932 bigquery, …). Many holds
  wait on **our own** work — they won't close themselves, so this is the moment to decide to
  pick one up. Note the cheapest if one stands out.
- **Upstream moved?** `npm view <pkg> version` — did the awaited release ship? **Trap — version
  math lies at a native/ESM boundary *inside* a major line.** When a hold exists because a
  specific release crossed a native or module-format boundary mid-major (databricks pinned at
  `1.15.0` because `1.16.0` added the native kernel; snowflake similarly), "newer version exists"
  and "same major" both scream *cheap fix available* — while pointing straight across the very
  boundary the hold protects. npm metadata does not show you the binary or the module format.
  Defer to the **ledger's documented boundary**, not the version number. (Boundaries *at* the
  major — uuid 12, @noble 2 — the major check already catches; mid-major boundaries are the trap.)
- **Fix got cheap?** Even with the trigger unfired, a hold's fix can quietly become takeable — a
  newly-released *genuinely*-compatible version (compatible per the ledger's boundary above,
  **not** per npm's version math), or a dependency that stopped needing the blocker. That's not a
  forced move, it's an *opportunity*: report it in zone `~` (§5) so you can take it early instead
  of waiting for the trigger.
- Where a trigger fired → propose the un-pin (loosen the range in `package.json` **and** drop the
  `dependabot.yml` `ignore` — both surfaces) and stage it, then **stop**; pin moves are
  deliberate. Where not → one line, "still held, <trigger> not met."
- **Anomaly:** a hold whose two surfaces disagree (a pinned range with no `ignore`, or an
  `ignore` with a loosened range) is a half-pin — flag it; that's how a hold silently reverts.

## Report

- Sweep: the four-zone block above.
- Release-walk: which holds can move (staged, awaiting you), which are still held.

Then stop.
