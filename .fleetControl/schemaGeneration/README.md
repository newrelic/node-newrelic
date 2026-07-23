# Agent Config Schema Generator

This directory contains the scripts that turn the agent's own config
definition into a JSON Schema (`../schemas/config.json`) and manage version
bumps in `../configurationDefinitions.yml` for Fleet Control.

## Files

| File | Description |
|------|-------------|
| `generate-schema.js` | Per-push regenerator. Reads `lib/config/default.js`'s `definition()`, writes `config.json`. Never touches `configurationDefinitions.yml`. |
| `bump-schema-version.js` | Release-time version bumper. Compares the schema at a prior git ref to the current schema and writes a new version into `configurationDefinitions.yml`. |
| `schema-diff.js` | Shared library (no CLI). Holds the diff classification (`classifyChanges`), bump arithmetic (`recommendBump`, `applyBump`, `bumpVersionLine`), and schema loading (`loadExisting`). Required by both scripts above. |
| `tests/generate-schema.test.js` | Tests for the generator (comment extraction, per-leaf type inference, override precedence, `generateSchema`). |
| `tests/schema-diff.test.js` | Tests for the shared library (`classifyChanges`, `recommendBump`, `applyBump`, `bumpVersionLine`). |
| `tests/bump-schema-version.test.js` | Tests for the bump script (parsing helpers, `decideBump`'s bootstrap/no-change/bump paths). |
| `../schemas/config.json` | Generated JSON Schema (Draft 2020-12). |
| `../configurationDefinitions.yml` | Fleet Control metadata, including the schema's semver version. Bumped only at release time. |

## How the generator works

`generate-schema.js`:

1. Requires `lib/config/default.js` directly and calls its `definition()`
   function. That function is the agent's own source of truth for config
   defaults, types (via each leaf's `formatter`), and env var overrides —
   there's no separate mirror file to keep in sync.
2. Re-reads `lib/config/default.js` as plain text to extract the JSDoc
   comments documenting each key, since `require()` only gives you the
   evaluated values, not the comments above them. `distributed_tracing.sampler`'s
   `root`/`remote_parent_sampled`/`remote_parent_not_sampled` fields are spread
   in from `lib/config/samplers.js` rather than written directly in
   `default.js`, so that file is read too and its comments reindexed under
   the right dotted path (`mergeSamplerDescriptions`).
3. Applies the `TYPE_OVERRIDES`, `ENUM_OVERRIDES`, and `EXCLUDE_KEYS`
   configured in the script.
4. Validates the result against the JSON Schema Draft 2020-12 meta-schema
   (via `ajv`).
5. Writes `config.json`.

The generator does **not** touch `configurationDefinitions.yml` — version
bumps live in the next section.

## How versioning works

Schema regeneration runs **per commit and per push** on feature branches —
locally via `.githooks/pre-commit`/`bin/update-config-schema.sh`, and in CI
via `.github/workflows/agent-config-schema.yml`. It writes `config.json`
and nothing else. Reviewers see schema diffs in PRs.

Version bumps run **manually before each release** via
`.github/workflows/agent-config-schema-bump.yml`, which is
`workflow_dispatch`-only. The bump workflow:

1. Finds the latest `v*` tag on `main` (overridable via the `since_ref`
   workflow input).
2. Reads the historical `configurationDefinitions.yml` from that tag — the
   version stored there is the **starter version** for the bump.
3. Reads the historical schema from `.fleetControl/schemas/config.json` at
   that same tag.
4. Compares the historical schema to the current on-disk `config.json`,
   classifies the cumulative diff, and applies the recommended bump kind
   (major/minor/patch).
5. Opens a PR titled `chore: bump agent config schema version` for team
   review.

If the latest release tag predates the schema (no `config.json`, or no
`version` in `configurationDefinitions.yml`, at that tag),
`bump-schema-version.js` exits `0` with a bootstrap message and no PR is
opened. The first release that includes the schema ships at whatever
version is currently in `configurationDefinitions.yml`.

### Release ordering — run the bump workflow before cutting the release

The bump PR is a separate review/merge step from the agent's release tag.
Run these in order:

1. Trigger `Agent Config Schema Bump` (manual `workflow_dispatch`).
2. Wait for the PR to open (or the workflow to report that no bump is needed).
3. Review and merge the bump PR if one was opened.
4. Cut the release from the post-merge `main`.

If the release is cut before the bump PR merges, the tag's
`configurationDefinitions.yml` will still say the pre-bump version, even
though the schema itself (`config.json`) at that tag reflects the new keys
— consumers see a mismatch. The next release will compute its bump
correctly from this tag's metadata, but the tag itself ships mismatched.

## Quick start

```bash
# Regenerate the schema (from repo root)
node .fleetControl/schemaGeneration/generate-schema.js
# or: npm run generate:config-schema

# Preview a release-time bump against a tag (dry-run)
node .fleetControl/schemaGeneration/bump-schema-version.js --since=v14.2.0
# or, against the latest v* tag: npm run bump:config-schema

# Apply a release-time bump (writes configurationDefinitions.yml)
node .fleetControl/schemaGeneration/bump-schema-version.js --since=v14.2.0 --write
```

## Adding new configuration keys

New keys under `defaultConfig.definition()` in `lib/config/default.js` are
picked up automatically — the generator walks that structure directly. Most
of the time nothing else is needed: each leaf's `formatter` (`boolean`,
`int`, `float`, `array`, `object`, `objectList`, `regex`, or an
`allowList.bind(...)` call) tells the generator exactly what JSON Schema
type — and, for `allowList`, what `enum` — to emit, and the JSDoc comment
directly above the key becomes its `description`.

Three cases need manual handling, all configured via override maps in
`generate-schema.js`:

- **A key accepts more than one shape.** `app_name` is parsed with a custom
  formatter that splits a string on `;`/`,`, so it accepts either a real
  array or a delimited string — that shape can't be inferred from a single
  default value, so it's declared explicitly in `TYPE_OVERRIDES`.
- **A key has a fixed set of values not expressed via `allowList`.** Add it
  to `ENUM_OVERRIDES`.
- **A key's `default` in `definition()` is computed at require-time**, not
  a stable literal — e.g. `logging.filepath` defaults to
  `require('path').join(process.cwd(), ...)`, and `serverless_mode.enabled`
  defaults to whether an env var happens to be set. Left alone, the
  generator bakes in whatever that expression evaluates to on the machine
  that last ran it (an absolute path specific to that checkout, in the
  `logging.filepath` case — this is exactly the kind of bug the generator
  should never produce silently). Add a corrected schema to `TYPE_OVERRIDES`.

## Excluding keys

Add a key's dotted path to `EXCLUDE_KEYS` to drop it, and everything nested
under it, from the schema entirely. This schema is scoped to public-facing
config — settings a user is meant to set:

```js
const EXCLUDE_KEYS = new Set([
  'agent_control', // Fleet Control sets this itself.
  'logging.diagnostics',
  'infinite_tracing.trace_observer.insecure',
  'ssl' // no-op: the formatter always forces true regardless of input.
])
```

## Missing descriptions

The generator prints every config path it wrote without a `description` —
usually because the JSDoc comment documents a parent stanza (or, in a few
spots, a single child written under its parent's comment) rather than that
specific leaf. Check the printout after each run; fixing this means adding
or moving a comment in `lib/config/default.js`, not editing the generated
schema.

## Checklist for new config keys

1. Add the key to `lib/config/default.js` with a JSDoc comment, as usual.
2. Run the generator. Check the inferred type in `config.json`.
3. If the type or enum came out wrong, or the key needs to be hidden, add
   an entry to the appropriate override map above and re-run.
4. Run the tests (`npm run unit:config-schema`).
5. The version doesn't bump on per-push regeneration. The next release
   will pick up your changes when someone runs the bump workflow as part
   of release prep.

## CLI options

### `generate-schema.js`

None — every run regenerates unconditionally and writes `config.json`.

### `bump-schema-version.js`

| Option | Description |
|--------|-------------|
| `--since=<ref>` | Compare the current schema to the schema at `<ref>`. Defaults to the latest `v*` tag. |
| `--write` | Write the bumped version to `configurationDefinitions.yml`. Without this, the script just prints the recommendation. |

## Exit codes

### `generate-schema.js`

| Code | Meaning |
|------|---------|
| 0 | Ran successfully. `config.json` reflects the current config definition, whether or not its contents actually changed. |
| non-zero | Generator or meta-schema validation failure — `config.json` was not written. |

### `bump-schema-version.js`

| Code | Meaning |
|------|---------|
| 0 | Ran successfully — whether or not a bump was applied or recommended. |
| non-zero | A real failure (bad ref, malformed YAML, unknown flag, etc). |

Both scripts use this same two-way contract deliberately, rather than a
three-way "unchanged/changed/failed" one: Node's default exit code for any
uncaught exception is `1`, which would collide with "changed" if that were
also `1`, letting a genuine crash slip through as a false success. Callers
that need to know whether a file's contents actually changed check that
directly — e.g. `git status`/`git diff` on `config.json` or
`configurationDefinitions.yml` — rather than relying on the exit code.

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

`additionalProperties` is only compared when it's a plain boolean on both
sides — `labels` and the dynamic `instrumentation` map constrain their
dictionary values with an object-shaped `additionalProperties` instead,
which isn't a bump signal.

## Running the tests

```bash
node --test .fleetControl/schemaGeneration/tests/

# Or via npm
npm run unit:config-schema
```

`tests/generate-schema.test.js` covers the comment-extraction scanner,
per-leaf type inference (including override precedence and `allowList`
enum extraction), the exclusion/recursion logic, and `generateSchema`
itself — once against a small synthetic fixture (fast, isolated from the
real config) and once against the actual `lib/config/default.js` (catches
real drift). `tests/schema-diff.test.js` and
`tests/bump-schema-version.test.js` cover the version-bump classification
and driver logic above, entirely with synthetic schema fixtures — no git or
real config involved. Every function across all three scripts takes its
inputs — definitions, source text, override maps, schemas — as parameters
rather than reading module-level constants directly, specifically so tests
can supply synthetic ones instead of depending on production data.
