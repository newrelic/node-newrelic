# Agent configuration schema

This directory holds the JSON Schema (Draft 2020-12) that describes every
configuration setting the New Relic Node.js agent accepts. The schema is the
authoritative definition of the agent's configuration surface: its shape,
types, defaults, value constraints, and environment-variable bindings.

The schema is authored as **JavaScript modules** rather than `.json` files so it
can carry comments, use shared helpers, and be edited like the rest of the
codebase. Each module `module.exports` a plain object that is a valid JSON
Schema.

## Layout

- **`root.js`** — the root schema. Its `properties` are the top-level settings:
  scalar settings inline (e.g. `app_name`, `license_key`, `port`) and each
  configuration "block" as a `$ref` to a sibling file (e.g.
  `attributes: { $ref: 'attributes.js' }`). Properties are ordered scalars
  first (alphabetical), then blocks (alphabetical).
- **`<block>.js`** — one file per configuration block (e.g. `attributes.js`,
  `distributed-tracing.js`). Each declares a `$schema` and a bare `$id` equal to
  its filename (e.g. `$id: 'attributes.js'`), which is how `root.js` `$ref`s it.

Filenames are kebab-case (`custom-insights-events.js`); the config keys *inside*
the schema keep their snake_case names (`custom_insights_events`).

## `x-newrelic-*` vendor keywords

The schema uses vendor extension keywords (all `x-`-prefixed, so ajv ignores
them during validation) to carry agent-specific metadata:

- **`x-newrelic-env-var`** (string) — the explicit environment variable name for
  a setting whose name does *not* follow the derive-from-path convention
  (`NEW_RELIC_<PATH>`). For example `logging.enabled` is set by
  `NEW_RELIC_LOG_ENABLED`, not `NEW_RELIC_LOGGING_ENABLED`. Settings without this
  keyword derive their name from the path.
- **`x-newrelic-coerce`** (string) — names the coercion applied to a setting's
  environment-variable string value for cases the node's `type` alone cannot
  express. Environment values are strings; coercions derivable from `type`
  (boolean, integer, number, and comma-delimited `array`) are applied
  automatically and need no keyword. Use this keyword only for the coercions
  `type` cannot distinguish. Supported values:
    - `object` — `JSON.parse` the value into an object (e.g.
      `error_collector.ignore_messages`).
    - `objectList` — `JSON.parse` the value into an array of objects; needed to
      distinguish a JSON object list from a plain `array` (both are
      `type: array`), as with `rules.name`.
    - `regex` — compile the value into a `RegExp` (e.g.
      `url_obfuscation.regex.pattern`).
    - `allowList` — constrain the value to the node's `enum`, falling back to the
      first enum entry when it is not a member (e.g. `transaction_tracer.record_sql`,
      `process_host.ipv_preference`, `security.mode`).
- **`x-newrelic-internal`** (`true`) — marks a setting that is not user-facing
  (e.g. `ssl`, `agent_control`, `logging.diagnostics`,
  `infinite_tracing.trace_observer.insecure`). It still appears in the schema so
  the schema covers every setting, but tooling can use this to hide it.
- **`x-newrelic-sampler`** (`true`) — marks a distributed-tracing sampler setting
  whose string value (`'trace_id_ratio_based'`/`'adaptive'`) is expanded into an
  object from a *second* environment variable (see the sampler caveat below).

## Caveats

- **The schema cannot express load-time-computed defaults.** Three settings have
  defaults computed at startup rather than static literals, so the schema omits
  their `default` and `generate-default-config.js` fills them in:
  `license_key` (placeholder `''`), `logging.filepath`
  (`<cwd>/newrelic_agent.log`), and `serverless_mode.enabled`
  (true when `AWS_LAMBDA_FUNCTION_NAME` is present).
- **Environment string coercion is limited to unambiguous types.**
  `applyEnvironmentOverrides` coerces a variable's string value using the
  setting's declared `type` (boolean/integer/number/array). Settings with a
  union type or `oneOf` (no single `type`) receive the raw string; anything more
  is left to downstream handling.
- **Distributed-tracing samplers need a second variable.** A sampler
  (`distributed_tracing.sampler.{root,remote_parent_sampled,remote_parent_not_sampled}`,
  also under `partial_granularity`) set to the string `'trace_id_ratio_based'` or
  `'adaptive'` is expanded into its object form by reading a second variable
  (e.g. `..._ROOT_TRACE_ID_RATIO_BASED_RATIO`, `..._ROOT_ADAPTIVE_SAMPLING_TARGET`,
  the latter clamped to `[1, 120]`). This is handled by delegating to
  `setSamplersFromEnv` in `lib/config/samplers.js` when a node is marked
  `x-newrelic-sampler`. Note: that helper reads `process.env` directly, so the
  sampler's second variable is not read from an injected `env`.
- **`ssl` only accepts `true`.** It is declared `const: true`; any other value
  fails validation. It carries `NEW_RELIC_USE_SSL` and `x-newrelic-internal`.
- **`instrumentation` enumerates known packages** as `enabled` toggles plus
  `additionalProperties`, so per-package settings for packages beyond the
  enumerated set are permitted but are not individual schema settings.
- **`NEWRELIC_`-prefixed variables are out of scope.** A few special/test
  variables use the `NEWRELIC_` (no underscore) prefix and are read directly by
  their owning modules (e.g. gRPC test metadata, `NEWRELIC_PIPE_PATH`). They are
  intentionally not configuration settings and are not represented here.

## Adding or changing a setting

1. Edit the relevant block file (or `root.js` for a top-level scalar). Give the
   setting a `type`, a `default` where it has a static one, and a `description`.
2. If its environment variable name does not follow the `NEW_RELIC_<PATH>`
   convention, add `x-newrelic-env-var` with the exact name.
3. If it is internal/not user-facing, add `x-newrelic-internal: true`.
4. To add a new block: create `<name>.js` with `$schema` and a bare `$id`
   matching the filename, and add `<key>: { $ref: '<name>.js' }` to `root.js`.
   `schema.js` discovers block files by reading this directory, so no
   registration is needed.
5. Keep JSDoc-free comments where helpful; the files are plain JS modules.
