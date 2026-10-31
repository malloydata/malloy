/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 * pr-status-labels: label each open pull request with the last action taken
 * on it, so the PR list shows whose move it is.
 *
 * Each pull request has three roles:
 *   - submitter:  the person who opened the PR, even if they have write
 *                 access.
 *   - maintainer: anyone else with write access to the repository.
 *   - community:  everyone else.
 * Only actions by the submitter or a maintainer set the label; a community
 * comment never changes it. Actions by bots are ignored, except adding
 * `parked`.
 *
 * A PR opened by a bot, such as Dependabot, gets no `status:` label. A draft
 * PR is labeled `status: draft`, whatever has happened on it. Every other PR
 * is labeled with its most recent submitter or maintainer action:
 *   status: opened               no action since the PR was opened
 *   status: submitter comment    the submitter commented or reviewed
 *   status: submitter ready      the submitter marked the PR ready for
 *                                review, or wrote a comment with a line
 *                                reading `status: ready` or
 *                                `status: submitter ready`
 *   status: submitter commit     the submitter pushed commits or force-pushed
 *   status: maintainer comment   a maintainer commented, reviewed, approved,
 *                                or marked the PR ready for review
 *   status: maintainer commit    a maintainer pushed commits or force-pushed
 *   status: maintainer parked    someone added the `parked` label
 * Only the submitter can ask for review. A maintainer who marks the PR ready
 * or writes `status: ready` sets `status: maintainer comment`.
 *
 * A comment with a line reading `status: ignore` or `status: unchanged` is not
 * an action, whoever writes it, so the label stays as it was. A maintainer uses
 * it for a comment that doesn't ask the submitter for anything.
 *
 * The color says whose move it is:
 *   orange  review was requested: opened, submitter ready
 *   amber   a maintainer's move, though the submitter did not ask for
 *           review: submitter comment, submitter commit
 *   blue    the submitter's move: maintainer comment, maintainer commit
 *   gray    nobody's move: draft, maintainer parked, and `parked` itself
 *
 * A commit belongs to its committer's GitHub account, so a maintainer who
 * rebases or cherry-picks the submitter's commits is credited with them. A
 * commit made in GitHub's web UI, such as by "Update branch", belongs to its
 * author, the person who clicked. A commit with no linked account belongs to
 * the submitter. A force-push belongs to whoever pushed.
 *
 * A commit's time is its committer date, with one exception. When the PR's
 * head commit was made after the PR was opened, its time is when GitHub
 * first started checks on it, if that is later. GitHub starts checks when a
 * commit is pushed, and a commit can be pushed long after it was made.
 *
 * `parked` takes a PR out of the review queue on purpose. People add and
 * remove it; this script never adds it to or removes it from a PR. While it
 * is on, adding it counts as a maintainer action, whoever added it, so the PR
 * shows `status: maintainer parked` until the submitter or a maintainer acts
 * again. Once it is removed, adding it no longer counts, and the label
 * follows the last other action.
 *
 * This script owns every `status:` label. Each time it runs, it recomputes a
 * PR's label from the PR's whole history, so a missed event or a rule change
 * is corrected by the next run. It removes every `status:` label but the one
 * it chose, removes them all from an open PR it does not label, and leaves
 * other labels alone. It never changes a closed PR. It creates any of its
 * labels, and `parked`, that the repository is missing.
 *
 * Run it with no arguments for usage. It changes nothing without --apply.
 * After editing the label table below, run it with --sync-labels --apply to
 * push the new colors and descriptions to the repository.
 *
 * Node runs this file directly by stripping its types, so it uses only
 * TypeScript syntax that can be erased: no enums, namespaces, or constructor
 * parameter properties.
 */

const STATUS_PREFIX = 'status: ';
// Each is one line, alone, optionally wrapped in markdown code or emphasis
// marks.
const READY_LINE =
  /^[ \t]*[`*_]*[ \t]*status:[ \t]*(submitter[ \t]+)?ready[ \t]*[`*_]*[ \t]*$/im;
const IGNORE_LINE =
  /^[ \t]*[`*_]*[ \t]*status:[ \t]*(ignore|unchanged)[ \t]*[`*_]*[ \t]*$/im;

const PARKED = 'parked';

const REQUESTED = 'd93f0b';
const OUR_MOVE = 'fbca04';
const THEIR_MOVE = 'c5def5';
const DEFERRED = 'bfbfbf';

type StatusLabel =
  | 'status: opened'
  | 'status: submitter ready'
  | 'status: submitter comment'
  | 'status: submitter commit'
  | 'status: maintainer comment'
  | 'status: maintainer commit'
  | 'status: draft'
  | 'status: maintainer parked';

const LABELS: Record<
  StatusLabel | typeof PARKED,
  {color: string; description: string}
> = {
  'status: opened': {
    color: REQUESTED,
    description: 'Last action: the PR was opened',
  },
  'status: submitter ready': {
    color: REQUESTED,
    description: 'Last action: the submitter said it is ready for review',
  },
  'status: submitter comment': {
    color: OUR_MOVE,
    description: 'Last action: the submitter commented',
  },
  'status: submitter commit': {
    color: OUR_MOVE,
    description: 'Last action: the submitter pushed commits',
  },
  'status: maintainer comment': {
    color: THEIR_MOVE,
    description: 'Last action: a maintainer commented or reviewed',
  },
  'status: maintainer commit': {
    color: THEIR_MOVE,
    description: 'Last action: a maintainer pushed commits',
  },
  'status: draft': {
    color: DEFERRED,
    description: 'The PR is a draft',
  },
  'status: maintainer parked': {
    color: DEFERRED,
    description: 'Last action: a maintainer parked the PR',
  },
  [PARKED]: {
    color: DEFERRED,
    description: 'Deliberately out of the review queue; set by a maintainer',
  },
};

type Kind = 'opened' | 'comment' | 'commit' | 'ready' | 'parked';
type Role = 'submitter' | 'maintainer' | 'community';

interface PrAction {
  login: string | undefined;
  isBot: boolean;
  at: number;
  kind: Kind;
  body: string;
  description: string;
}

interface Options {
  repo: string;
  token: string;
  prs: number[];
  all: boolean;
  syncLabels: boolean;
  apply: boolean;
  check: boolean;
}

// The result of labeling one PR. `mislabeled` means its `status:` labels
// differed from the computed one, whether or not --apply then fixed them.
interface Outcome {
  result: 'skipped' | 'correct' | 'mislabeled';
  line: string;
}

// GitHub responses are typed `unknown` and read through these helpers, which
// never throw. A missing field reads as undefined; `str` and `list` also read
// a value of the wrong type as undefined or [].
function prop(v: unknown, key: string): unknown {
  if (typeof v === 'object' && v !== null && key in v) {
    return Reflect.get(v, key);
  }
  return undefined;
}

function str(v: unknown, key: string): string | undefined {
  const p = prop(v, key);
  return typeof p === 'string' ? p : undefined;
}

function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function userLogin(user: unknown): string | undefined {
  return str(user, 'login');
}

function userIsBot(user: unknown): boolean {
  return str(user, 'type') === 'Bot';
}

interface Pr {
  number: number;
  state: string;
  draft: boolean;
  submitter: string;
  submitterIsBot: boolean;
  openedAt: string;
  headSha: string;
  labels: string[];
}

// The one place a pull request from the API is checked. A missing field means
// GitHub's response changed shape, so it stops the run rather than labeling
// from a partial PR.
function readPr(v: unknown): Pr {
  const number = prop(v, 'number');
  if (typeof number !== 'number') {
    throw new Error(
      `GitHub returned a pull request with no number: ${JSON.stringify(v).slice(0, 200)}`
    );
  }
  const missing = (field: string) =>
    new Error(`PR #${number}: GitHub's response has no '${field}'`);
  const need = (field: string, value: string | undefined): string => {
    if (value === undefined) throw missing(field);
    return value;
  };
  const draft = prop(v, 'draft');
  if (typeof draft !== 'boolean') throw missing('draft');
  const labels = prop(v, 'labels');
  if (!Array.isArray(labels)) throw missing('labels');
  const user = prop(v, 'user');
  return {
    number,
    state: need('state', str(v, 'state')),
    draft,
    submitter: need('user.login', userLogin(user)),
    submitterIsBot: userIsBot(user),
    openedAt: need('created_at', str(v, 'created_at')),
    headSha: need('head.sha', str(prop(v, 'head'), 'sha')),
    labels: labels.map(l => need('labels[].name', str(l, 'name'))),
  };
}

interface GitHub {
  repo: string;
  get(path: string): Promise<unknown>;
  // Follows `Link: rel="next"` until the last page.
  getAll(path: string): Promise<unknown[]>;
  post(path: string, body: unknown): Promise<void>;
  patch(path: string, body: unknown): Promise<void>;
  // A 404 counts as done: the thing being deleted is already gone.
  delete(path: string): Promise<void>;
}

// Whether an error stops the run instead of failing only its PR. It stops the
// run when it would fail the same way for every PR: bad or underpowered
// credentials (401, 403), rate limiting (403, 429), GitHub itself failing
// (5xx), or any error that is not an HTTP error response, such as a network
// failure or a malformed PR rejected by readPr.
function failsWholeRun(e: unknown): boolean {
  const status = prop(e, 'status');
  if (typeof status !== 'number') return true;
  return status === 401 || status === 403 || status === 429 || status >= 500;
}

function makeGitHub(repo: string, token: string): GitHub {
  const api = 'https://api.github.com';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const request = async (
    method: string,
    url: string,
    body?: unknown
  ): Promise<Response> => {
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(
        new Error(`GitHub ${method} ${url} failed: ${res.status} ${text}`),
        {status: res.status}
      );
    }
    return res;
  };
  return {
    repo,
    async get(path) {
      return (await request('GET', `${api}${path}`)).json();
    },
    async getAll(path) {
      const sep = path.includes('?') ? '&' : '?';
      let url: string | undefined = `${api}${path}${sep}per_page=100`;
      const items: unknown[] = [];
      while (url) {
        const res = await request('GET', url);
        items.push(...list(await res.json()));
        url = /<([^>]+)>;\s*rel="next"/.exec(
          res.headers.get('link') ?? ''
        )?.[1];
      }
      return items;
    },
    async post(path, body) {
      await request('POST', `${api}${path}`, body);
    },
    async patch(path, body) {
      await request('PATCH', `${api}${path}`, body);
    },
    async delete(path) {
      try {
        await request('DELETE', `${api}${path}`);
      } catch (e) {
        if (prop(e, 'status') !== 404) throw e;
      }
    },
  };
}

// A maintainer is anyone with write access. The API's `permission` field
// reports the maintain role as `write` and triage as `read`. Each user is
// looked up once per run.
function makeMaintainerCheck(gh: GitHub): (login: string) => Promise<boolean> {
  const known = new Map<string, Promise<boolean>>();
  return login => {
    let answer = known.get(login);
    if (answer === undefined) {
      answer = gh
        .get(
          `/repos/${gh.repo}/collaborators/${encodeURIComponent(login)}/permission`
        )
        .then(
          p => {
            const permission = str(p, 'permission');
            return permission === 'admin' || permission === 'write';
          },
          e => {
            // 404: the account no longer exists, so it has no access.
            if (prop(e, 'status') === 404) return false;
            throw e;
          }
        );
      known.set(login, answer);
    }
    return answer;
  };
}

async function prActions(gh: GitHub, pr: Pr): Promise<PrAction[]> {
  const n = pr.number;
  const base = `/repos/${gh.repo}`;
  const actions: PrAction[] = [];
  const add = (
    user: unknown,
    at: string | undefined,
    kind: Kind,
    body: string | undefined,
    description: string
  ) => {
    if (at === undefined) return;
    actions.push({
      login: userLogin(user),
      isBot: userIsBot(user),
      at: Date.parse(at),
      kind,
      body: body ?? '',
      description,
    });
  };

  const [comments, reviews, reviewComments, commits, timeline, headSuites] =
    await Promise.all([
      gh.getAll(`${base}/issues/${n}/comments`),
      gh.getAll(`${base}/pulls/${n}/reviews`),
      gh.getAll(`${base}/pulls/${n}/comments`),
      gh.getAll(`${base}/pulls/${n}/commits`),
      gh.getAll(`${base}/issues/${n}/timeline`),
      gh.get(`${base}/commits/${pr.headSha}/check-suites?per_page=100`),
    ]);
  // GitHub creates a check suite for a commit when it is pushed, so the
  // earliest suite on the head commit dates its push.
  const headPushedAt = list(prop(headSuites, 'check_suites'))
    .map(suite => str(suite, 'created_at'))
    .filter((at): at is string => at !== undefined)
    .sort()[0];

  for (const c of comments) {
    add(
      prop(c, 'user'),
      str(c, 'created_at'),
      'comment',
      str(c, 'body'),
      'comment'
    );
  }
  for (const r of reviews) {
    // A pending review has no submitted_at and isn't visible yet.
    add(
      prop(r, 'user'),
      str(r, 'submitted_at'),
      'comment',
      str(r, 'body'),
      'review'
    );
  }
  for (const c of reviewComments) {
    add(
      prop(c, 'user'),
      str(c, 'created_at'),
      'comment',
      str(c, 'body'),
      'inline comment'
    );
  }
  for (const c of commits) {
    const sha = str(c, 'sha');
    const committer = prop(c, 'committer');
    // A web UI commit has `web-flow` as its committer and is credited to its
    // author. An unlinked account reads as null, which lastAction credits to
    // the submitter.
    const madeInWebUi = userLogin(committer) === 'web-flow';
    const user = madeInWebUi ? prop(c, 'author') : committer;
    const committedAt = str(prop(prop(c, 'commit'), 'committer'), 'date');
    // A head commit made before the PR was opened keeps its committer date,
    // which falls before the opening. Its checks can start at or after the
    // opening, and that time would make it look like a push after opening.
    const at =
      sha === pr.headSha &&
      headPushedAt !== undefined &&
      committedAt !== undefined &&
      Date.parse(committedAt) >= Date.parse(pr.openedAt) &&
      Date.parse(headPushedAt) > Date.parse(committedAt)
        ? headPushedAt
        : committedAt;
    add(user, at, 'commit', '', `commit ${sha?.slice(0, 8) ?? '?'}`);
  }
  const parked = pr.labels.includes(PARKED);
  for (const t of timeline) {
    const event = str(t, 'event');
    if (event === 'head_ref_force_pushed') {
      add(prop(t, 'actor'), str(t, 'created_at'), 'commit', '', 'force-push');
    } else if (event === 'ready_for_review') {
      add(
        prop(t, 'actor'),
        str(t, 'created_at'),
        'ready',
        '',
        'marked ready for review'
      );
    } else if (
      parked &&
      event === 'labeled' &&
      str(prop(t, 'label'), 'name') === PARKED
    ) {
      add(prop(t, 'actor'), str(t, 'created_at'), 'parked', '', 'parked');
    }
  }
  return actions;
}

function statusLabel(role: Role, action: PrAction): StatusLabel {
  if (action.kind === 'opened') return 'status: opened';
  if (action.kind === 'parked') return 'status: maintainer parked';
  if (role === 'maintainer') {
    // Only the submitter can ask for review: a maintainer marking the PR
    // ready, or writing `status: ready`, is a maintainer comment.
    return action.kind === 'commit'
      ? 'status: maintainer commit'
      : 'status: maintainer comment';
  }
  if (action.kind === 'commit') return 'status: submitter commit';
  if (action.kind === 'ready') return 'status: submitter ready';
  return READY_LINE.test(action.body)
    ? 'status: submitter ready'
    : 'status: submitter comment';
}

async function labelPr(
  gh: GitHub,
  isMaintainer: (login: string) => Promise<boolean>,
  pr: Pr,
  apply: boolean
): Promise<Outcome> {
  const n = pr.number;
  if (pr.state !== 'open') {
    return {result: 'skipped', line: `#${n} skipped: not open`};
  }

  // `want` undefined means the PR gets no `status:` label at all.
  let want: StatusLabel | undefined;
  let line: string;
  let result: Outcome['result'] = 'correct';
  if (pr.submitterIsBot) {
    line = `#${n} skipped: opened by ${pr.submitter}`;
    result = 'skipped';
  } else if (pr.draft) {
    want = 'status: draft';
    line = `#${n} ${want} (draft)`;
  } else {
    const last = await lastAction(gh, isMaintainer, pr);
    want = statusLabel(last.role, last.action);
    const who = last.action.login ?? 'unlinked account';
    const when = new Date(last.action.at).toISOString();
    line = `#${n} ${want} (${who} ${last.action.description} ${when})`;
  }

  // This script owns every `status:` label, so any it doesn't want goes.
  const have = pr.labels.filter(name => name.startsWith(STATUS_PREFIX));
  const remove = have.filter(name => name !== want);
  const add = want !== undefined && !have.includes(want) ? want : undefined;
  const changes = [
    ...remove.map(name => `-"${name}"`),
    ...(add !== undefined ? [`+"${add}"`] : []),
  ];
  if (changes.length > 0) {
    line += ` ${changes.join(' ')}`;
    result = 'mislabeled';
  } else if (want !== undefined) {
    line += ' unchanged';
  }
  if (apply) {
    for (const name of remove) {
      await gh.delete(
        `/repos/${gh.repo}/issues/${n}/labels/${encodeURIComponent(name)}`
      );
    }
    if (add !== undefined) {
      await gh.post(`/repos/${gh.repo}/issues/${n}/labels`, {labels: [add]});
    }
  }
  return {result, line};
}

// The most recent action by the submitter or a maintainer, starting from the
// PR's opening, so there is always one. An action with no linked account
// counts only if it is a commit, and then as the submitter's.
async function lastAction(
  gh: GitHub,
  isMaintainer: (login: string) => Promise<boolean>,
  pr: Pr
): Promise<{role: Role; action: PrAction}> {
  let last: {role: Role; action: PrAction} = {
    role: 'submitter',
    action: {
      login: pr.submitter,
      isBot: false,
      at: Date.parse(pr.openedAt),
      kind: 'opened',
      body: '',
      description: 'opened',
    },
  };
  for (const action of await prActions(gh, pr)) {
    if (action.kind === 'comment' && IGNORE_LINE.test(action.body)) continue;
    let role: Role;
    if (action.kind === 'parked') {
      role = 'maintainer';
    } else if (action.isBot) {
      continue;
    } else if (action.login === pr.submitter) {
      role = 'submitter';
    } else if (action.login === undefined) {
      if (action.kind !== 'commit') continue;
      role = 'submitter';
    } else {
      role = (await isMaintainer(action.login)) ? 'maintainer' : 'community';
    }
    if (role === 'community') continue;
    if (action.at >= last.action.at) {
      last = {role, action};
    }
  }
  return last;
}

// Creates any missing label with its color and description. With `sync`, it
// also updates an existing label whose color or description differs; without
// it, existing labels are left as people have edited them. Changes nothing
// without `apply`. Returns how many labels were missing, plus, with `sync`,
// how many differed.
async function ensureLabels(
  gh: GitHub,
  sync: boolean,
  apply: boolean
): Promise<number> {
  let wrong = 0;
  const existing = new Map<string, unknown>();
  for (const l of await gh.getAll(`/repos/${gh.repo}/labels`)) {
    const name = str(l, 'name');
    if (name !== undefined) existing.set(name, l);
  }
  const doing = apply ? '' : 'would be ';
  for (const [name, spec] of Object.entries(LABELS)) {
    const have = existing.get(name);
    if (have === undefined) {
      wrong++;
      console.log(`label "${name}" missing, ${doing}created`);
      if (apply) await gh.post(`/repos/${gh.repo}/labels`, {name, ...spec});
    } else if (
      sync &&
      (str(have, 'color')?.toLowerCase() !== spec.color ||
        (str(have, 'description') ?? '') !== spec.description)
    ) {
      wrong++;
      console.log(`label "${name}" differs, ${doing}updated`);
      if (apply) {
        await gh.patch(
          `/repos/${gh.repo}/labels/${encodeURIComponent(name)}`,
          spec
        );
      }
    } else if (sync) {
      console.log(`label "${name}" unchanged`);
    }
  }
  return wrong;
}

const USAGE =
  'usage: node scripts/pr-status-labels.ts [--repo OWNER/NAME] (--all | --pr N [--pr N ...] | --sync-labels) [--apply | --check]';

const HELP = `${USAGE}

Labels open pull requests with the last action taken on each
(\`status: ...\`). By default this is a dry run: it prints what it would
change and changes nothing. Add --apply to make the changes.

Give exactly one action:
  --all            label every open PR
  --pr N           label PR N; repeat for more than one
  --sync-labels    push this script's label colors and descriptions to the
                   repository; labels no PRs

Options:
  --repo OWNER/NAME  repository; defaults to $GITHUB_REPOSITORY
  --apply            make the changes; without it, only print what would change
  --check            changes nothing; print only PRs whose label is wrong,
                     then a summary, and exit 1 if any PR is mislabeled or
                     the repository is missing one of the labels

GITHUB_TOKEN must be set; locally, GITHUB_TOKEN=$(gh auth token).`;

// Returns undefined when there are no arguments or help was asked for.
function parseArgs(argv: string[]): Options | undefined {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return undefined;
  }
  const opts: Options = {
    repo: process.env['GITHUB_REPOSITORY'] ?? '',
    token: process.env['GITHUB_TOKEN'] ?? '',
    prs: [],
    all: false,
    syncLabels: false,
    apply: false,
    check: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') {
      opts.all = true;
    } else if (arg === '--sync-labels') {
      opts.syncLabels = true;
    } else if (arg === '--apply') {
      opts.apply = true;
    } else if (arg === '--check') {
      opts.check = true;
    } else if (arg === '--repo') {
      opts.repo = argv[++i] ?? '';
    } else if (arg === '--pr') {
      const value = argv[++i];
      const n = Number(value);
      if (value === undefined) {
        throw new Error(`--pr needs a PR number\n${USAGE}`);
      }
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`--pr needs a PR number, got '${value}'\n${USAGE}`);
      }
      opts.prs.push(n);
    } else {
      throw new Error(`unknown argument '${arg}'\n${USAGE}`);
    }
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(opts.repo)) {
    throw new Error(
      `--repo or $GITHUB_REPOSITORY must be OWNER/NAME, got '${opts.repo}'\n${USAGE}`
    );
  }
  const modes = [opts.all, opts.prs.length > 0, opts.syncLabels];
  if (modes.filter(m => m).length !== 1) {
    throw new Error(
      `give exactly one of --all, --pr, or --sync-labels\n${USAGE}`
    );
  }
  if (opts.check && (opts.apply || opts.syncLabels)) {
    throw new Error(
      `--check only reads; it can't be combined with --apply or --sync-labels\n${USAGE}`
    );
  }
  if (!opts.token) throw new Error(`GITHUB_TOKEN is not set\n${USAGE}`);
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts === undefined) {
    console.log(HELP);
    return;
  }
  const dryRun = !opts.apply && !opts.check;
  if (dryRun) {
    console.log('Dry run: no changes will be made. Add --apply to make them.');
  }
  const gh = makeGitHub(opts.repo, opts.token);
  const wrongLabels = await ensureLabels(gh, opts.syncLabels, opts.apply);
  let mislabeled = 0;
  let checked = 0;
  let failed = 0;
  if (!opts.syncLabels) {
    const isMaintainer = makeMaintainerCheck(gh);
    // With --pr, fetching each PR is part of that PR's work, so a bad number
    // fails only that PR.
    const targets: {number: number; load: () => Promise<Pr>}[] = opts.all
      ? (await gh.getAll(`/repos/${opts.repo}/pulls?state=open`))
          .map(readPr)
          .map(pr => ({number: pr.number, load: async () => pr}))
      : opts.prs.map(n => ({
          number: n,
          load: async () =>
            readPr(await gh.get(`/repos/${opts.repo}/pulls/${n}`)),
        }));
    for (const target of targets) {
      let outcome: Outcome;
      try {
        outcome = await labelPr(
          gh,
          isMaintainer,
          await target.load(),
          opts.apply
        );
      } catch (e) {
        if (failsWholeRun(e)) throw e;
        failed++;
        console.log(
          `#${target.number} failed: ${e instanceof Error ? e.message : e}`
        );
        continue;
      }
      const {result, line} = outcome;
      if (result !== 'skipped') checked++;
      if (result === 'mislabeled') mislabeled++;
      if (!opts.check || result === 'mislabeled') console.log(line);
    }
  }
  if (opts.check) {
    console.log(
      `Checked ${checked} PRs: ${mislabeled} mislabeled, ${failed} failed, ` +
        `${wrongLabels} labels missing.`
    );
    if (mislabeled + wrongLabels > 0) process.exitCode = 1;
  }
  if (failed > 0) process.exitCode = 1;
  if (dryRun) {
    console.log(
      'Dry run: nothing was changed. Run again with --apply to make these changes.'
    );
  }
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
