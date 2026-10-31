# Pull request status labels

Maintainer notes for the review queue. Contributors never need any of this: they iterate
as a draft, then ask for review by clicking **Ready for review** or commenting
`status: ready` (see `CONTRIBUTING.md`). Everything below is what that looks like from
the maintainer side.

## Reading the queue

Every open pull request carries one `status:` label naming the last thing that happened
on it. The color says whose move it is:

- **orange** — someone asked for review: `status: opened`, `status: submitter ready`
- **amber** — the submitter replied or pushed, so a maintainer looks next:
  `status: submitter comment`, `status: submitter commit`
- **blue** — a maintainer acted, so the next move is the submitter's:
  `status: maintainer comment`, `status: maintainer commit`
- **gray** — nobody's move yet: `status: draft`, `status: maintainer parked`, `parked`

The work queue is the orange and amber PRs. The exact rules
(who counts as the submitter or a maintainer, how commits are credited and timed) are in
the header of `scripts/pr-status-labels.ts`; that comment is the specification.

## What you control

- **Don't set `status:` labels by hand.** `scripts/pr-status-labels.ts` owns every label
  with that prefix and recomputes it from the PR's history, so a hand edit is undone on
  the next run.
- **`parked` is yours.** Add it to take a PR out of the queue on purpose, usually because
  it waits on a larger decision, and remove it to bring the PR back. While it's on,
  parking is the PR's last action (`status: maintainer parked`); a PR showing `parked`
  next to a `status: submitter ...` label is one where the submitter acted after you
  parked it.
- **Reply normally.** A comment, review, or push is all the script needs. When you ask a
  submitter for changes, mention that they can comment `status: ready` when done.
- **Comment without handing the PR back.** A comment that doesn't ask the submitter for
  anything, such as "I'll look at this next week", would still make the label say it's
  their move. Put a line reading `status: ignore` (or `status: unchanged`) in it, and
  the comment doesn't count: the label stays as it was.

## Landing

Merge the commit you reviewed, not whatever the head is by the time you click. A push
after your review can arrive while you're writing "looks good":

    gh pr merge <N> --squash --match-head-commit <sha-you-reviewed>

refuses to merge if the head has moved.

## Running the script by hand

The script prints help with no arguments, and changes nothing without `--apply`.
Locally, set `GITHUB_TOKEN=$(gh auth token)` and pass `--repo malloydata/malloy`.

- `--all` or `--pr N` shows the label each PR should have and what would change.
- `--all --check` prints only the PRs whose label is wrong, then a summary, and exits 1
  if any PR is mislabeled. Use it to check the automation's work.
- `--sync-labels --apply` pushes the label colors and descriptions from the script onto
  the repository, after you edit them in the script.

## Changing the taxonomy

The script's label table is the whole taxonomy. Rename or remove a state there and the
next run moves every open PR onto the new labels, because the script removes any
`status:` label it didn't choose. The old label definitions stay in the repository's
label list, and on closed PRs, until they're deleted by hand. Changing the `status:`
prefix itself is the one change that needs a deliberate cleanup, since the script only
owns the prefix it knows.
