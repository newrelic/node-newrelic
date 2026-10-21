# Agent Config Schema Versioning

This directory contains the scripts that manage the version of the agent's
config JSON Schema that Fleet Control publishes. The schema itself is not
generated here: Fleet Control reads the agent's rendered config schema directly
from `lib/config/schema.json`, and these scripts only bump its version in
`../configurationDefinitions.yml` at release time.

## Files

| File | Description |
|------|-------------|
| `bump-schema-version.js` | Release-time version bumper. Compares `lib/config/schema.json` at a prior git ref to the current one and writes a new version into `configurationDefinitions.yml`. |
| `schema-diff.js` | Shared library (no CLI). Holds the diff classification (`classifyChanges`), bump arithmetic (`recommendBump`, `applyBump`, `bumpVersionLine`), and schema loading (`loadExisting`). Required by `bump-schema-version.js`. |
| `tests/schema-diff.test.js` | Tests for the shared library (`loadExisting`, `classifyChanges`, `recommendBump`, `applyBump`, `bumpVersionLine`, `renderChange`). |
| `tests/bump-schema-version.test.js` | Tests for the bump script (parsing helpers, `previousRelease`, `decideBump`'s bootstrap/no-change/bump paths, `applyWrite`, `main`), plus a check that `configurationDefinitions.yml` points at `lib/config/schema.json`. |
| `../../lib/config/schema.json` | The schema Fleet Control reads: the agent's rendered config JSON Schema (Draft 2020-12). |
| `../configurationDefinitions.yml` | Fleet Control metadata, including the schema's path and semver version. The version is bumped only at release time. |

## Where the schema comes from

`lib/config/schema.json` is the agent's config JSON Schema
(`lib/config/schemas/`) with every `$ref` block inlined into a single document.
It carries every setting's type, default, constraints, and description, and is
published as is — nothing is pruned or rewritten for Fleet Control.

When a schema block under `lib/config/schemas/` changes, do this in the same
PR:

1. Run `npm run generate:config-validator`. It regenerates
   `lib/config/schema.json` together with `lib/config/schema.generated.js`.
2. Commit both `lib/config/schema.generated.js` and `lib/config/schema.json`.

Tests in `test/unit/config/schema.test.js` fail CI when either committed file
is stale relative to the schema sources, and when `schema.json` is not a valid
Draft 2020-12 JSON Schema document. There is no separate post-merge
regeneration step, and the schema version is not touched here: it is bumped at
release time (see below).

## How versioning works

Version bumps run as part of **release prep**, via the `bump-config-schema`
job in `.github/workflows/prepare-release.yml`. Once `agent-release-notes`
has pushed the release branch, that job:

1. Checks out the release branch and finds the latest `v*` tag on `main`.
2. Reads the historical `configurationDefinitions.yml` from that tag — the
   version stored there is the **starter version** for the bump.
3. Reads the historical schema from `lib/config/schema.json` at that same
   tag.
4. Compares the historical schema to the current on-disk
   `lib/config/schema.json`, classifies the cumulative diff, and applies the
   recommended bump kind (major/minor/patch).
5. Commits the bumped `configurationDefinitions.yml` straight into the
   release branch (`--write`), so it rides along in the same release PR.

If the latest release tag predates the schema (no `lib/config/schema.json`, or
no `version` in `configurationDefinitions.yml`, at that tag),
`bump-schema-version.js` exits `0` with a bootstrap message and commits
nothing. That release ships at whatever version is currently in
`configurationDefinitions.yml`.

Because the bump lands in the release PR itself, there's no ordering step
to get wrong — reviewing and merging the release PR carries the version
bump with it.

## Quick start

```bash
# Regenerate the schema after changing lib/config/schemas/ (from repo root)
npm run generate:config-validator

# Preview a release-time bump against a tag (dry-run)
node .fleetControl/schemaGeneration/bump-schema-version.js --since=v14.2.0

# Apply a release-time bump (writes configurationDefinitions.yml)
node .fleetControl/schemaGeneration/bump-schema-version.js --since=v14.2.0 --write
# or, against the latest v* tag: npm run bump:config-schema
```

## Adding new configuration keys

New settings are added to the agent's config schema under
`lib/config/schemas/` (see that directory's README for authoring details).
Every setting in the schema reaches `lib/config/schema.json`, and therefore
Fleet Control, with its `type`, `default`, constraints, `enum`, and
`description` as written.

The schema's vendor keywords are published too:

- **`x-newrelic-env-var`** documents the environment variable that sets a
  setting.
- **`x-newrelic-internal: true`** marks a setting that is not user-facing (for
  example `ssl` and `agent_control`). It is an annotation only: the setting is
  still published, and Fleet Control or other tooling can use the keyword to
  hide it.
- **`x-newrelic-coerce`** and **`x-newrelic-sampler`** are implementation
  details for the agent's environment-variable handling.

## Checklist for new config keys

1. Add the setting to the schema under `lib/config/schemas/`, with a
   `description` (and `x-newrelic-internal: true` if it is not user-facing).
2. Run `npm run generate:config-validator` and check the result in
   `lib/config/schema.json`.
3. Commit `lib/config/schema.generated.js` and `lib/config/schema.json` with
   your change, and run the tests (`npm run unit` and
   `npm run unit:config-schema`).
4. The version doesn't bump when your PR merges. The next release will pick
   up your changes when the bump job runs as part of release prep.

## CLI options

### `bump-schema-version.js`

| Option | Description |
|--------|-------------|
| `--since=<ref>` | Compare the current schema to the schema at `<ref>`. Defaults to the latest `v*` tag. |
| `--write` | Write the bumped version to `configurationDefinitions.yml`. Without this, the script just prints the recommendation. |

## Exit codes

### `bump-schema-version.js`

| Code | Meaning |
|------|---------|
| 0 | Ran successfully — whether or not a bump was applied or recommended. |
| non-zero | A real failure (bad ref, malformed YAML, unknown flag, etc). |

The script uses this two-way contract deliberately, rather than a three-way
"unchanged/changed/failed" one: Node's default exit code for any uncaught
exception is `1`, which would collide with "changed" if that were also `1`,
letting a genuine crash slip through as a false success. Callers that need to
know whether the version actually changed check that directly — e.g.
`git status`/`git diff` on `configurationDefinitions.yml` — rather than relying
on the exit code.

## Version bumping rules

`bump-schema-version.js` classifies each schema change and the bump kind
is the highest severity across all changes:

| Change type | Severity | Bump |
|--------------|----------|------|
| Property removed | Breaking | Major |
| Type changed | Breaking | Major |
| Enum value removed | Breaking | Major |
| Enum newly introduced | Breaking | Major |
| Required field added | Breaking | Major |
| `additionalProperties` tightened (`true` → `false`) | Breaking | Major |
| Property added | Additive | Minor |
| Enum value added | Additive | Minor |
| Enum removed entirely | Additive | Minor |
| Required field removed | Additive | Minor |
| Default changed | Additive | Minor |
| `additionalProperties` loosened (`false` → `true`) | Additive | Minor |
| Description changed | Cosmetic | Patch |

Because the schema is published unpruned, these rules apply to internal
settings (`x-newrelic-internal`) the same as to user-facing ones.

`additionalProperties` is only compared when it's a plain boolean on both
sides — `labels` and `instrumentation` constrain their dictionary values
with an object-shaped `additionalProperties` instead, which isn't a bump
signal. `instrumentation` also enumerates every currently-instrumented
package as a real property (falling back to `additionalProperties` for
anything newer); each addition/removal there is a normal property
add/remove, not a bump-signal exemption.

Anything not listed above is not compared and never triggers a bump: other
constraints (`minimum`/`maximum`, `pattern`, `const`, `items`), the
`x-newrelic-*` keywords, and the document's `title`, `description`, and `$id`.

## Running the tests

```bash
node --test .fleetControl/schemaGeneration/tests/*.test.js

# Or via npm
npm run unit:config-schema
```

`tests/schema-diff.test.js` and most of `tests/bump-schema-version.test.js`
cover the version-bump classification and driver logic above, entirely with
synthetic schema fixtures — no git or real config involved. The one exception
is the check that `configurationDefinitions.yml` resolves to the real
`lib/config/schema.json`.
