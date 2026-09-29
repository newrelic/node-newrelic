/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const Config = require('#agentlib/config/index.js')

// The suggested configuration shipped in the repo root; the baseline a fresh
// install starts from.
const baselineConfig = require('../../../../newrelic.js').config

// A configuration fixture specifying a value for every field the schema
// exposes, including the object-shaped distributed tracing samplers.
const fullConfig = require('./full-config.json')

// A config that leans on the parts of parsing that do real work: alternate
// (object-shaped) samplers exercise the sampler builder, and the scalar string
// values below are coerced to their schema types on the way in.
const complexConfig = {
  license_key: '0000111122223333444455556666777788889999',
  distributed_tracing: {
    enabled: true,
    sampler: {
      remote_parent_sampled: { trace_id_ratio_based: { ratio: 0.25 } },
      remote_parent_not_sampled: { adaptive: { sampling_target: 30 } }
    }
  },
  attributes: {
    enabled: true,
    include: ['request.headers.*'],
    exclude: ['request.headers.cookie', 'request.headers.authorization']
  },
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 'apdex_f'
  }
}

// The environment overrides layered on top of `complexConfig`. Each value is a
// string, as it would be in a real environment, so the environment-variable
// coercions (int, float, boolean, array, allowList) run while parsing. Set in
// `before` and cleared in `after` so neither the setup nor the teardown is
// measured.
const complexEnv = {
  // Split on `;`/`,` by app_name's custom formatter.
  NEW_RELIC_APP_NAME: 'App One, App Two; App Three',
  NEW_RELIC_APDEX_T: '0.2',
  NEW_RELIC_PORT: '8080',
  NEW_RELIC_LOG_LEVEL: 'warn',
  NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: 'true',
  NEW_RELIC_ATTRIBUTES_ENABLED: 'true',
  NEW_RELIC_APPLICATION_LOGGING_ENABLED: 'false',
  NEW_RELIC_ERROR_COLLECTOR_IGNORE_STATUS_CODES: '404, 405, 501',
  NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_ROOT: 'always_on'
}

// A logger that discards everything. `initialize` accepts a `logger` option and
// threads it into the constructed `Config`; supplying a no-op instance keeps
// logging I/O out of the measured work.
const noopLogger = {
  child() {
    return this
  },
  error() {},
  warn() {},
  info() {},
  debug() {},
  trace() {}
}

const suite = benchmark.createBenchmark({
  name: 'Config parsing',
  runs: 5000
})

const tests = [
  {
    name: 'baseline (suggested newrelic.js)',
    fn: parse(baselineConfig)
  },
  {
    name: 'complex (samplers, formatters, env vars)',
    before: setEnv,
    after: clearEnv,
    fn: parse(complexConfig)
  },
  {
    name: 'full (every field)',
    fn: parse(fullConfig)
  },
  {
    // The schema is built once per process, then cached, so the per-parse cases
    // above never pay that cost. This case measures the one-time cold build via
    // the shipped, pre-compiled artifact (`lib/config/schema.generated.js`): the
    // production path, where the schema module obtains its state from a plain
    // require rather than reading and compiling the schema from disk. `before`
    // evicts the schema module and the artifact from the require cache (but not
    // the block files, which this path never reads) so the measured `fn` re-runs
    // the artifact-backed build from a cold require.
    name: 'cold schema build (prebuilt artifact)',
    before: bustSchemaModule,
    fn: buildSchemaCold
  },
  {
    // The development / fallback path: the pre-compiled artifact is absent, so
    // the schema is built from disk — every block file is read, the ajv
    // validator is recompiled, and the env-var index is rebuilt. `buildState`
    // performs exactly that work and always reads from disk (it never consults
    // the artifact or the module cache), so it measures the cold disk build
    // directly without needing to hide the artifact file.
    name: 'cold schema build (disk: file reads + ajv compile)',
    fn: buildSchemaFromDisk
  }
]

for (const test of tests) {
  suite.add(test)
}
suite.run()

// Returns a benchmark function that parses `config` into a fresh `Config`
// instance. `Config` is a singleton via `getInstance`/`createInstance`, but
// `initialize(config)` always constructs a new instance without touching the
// singleton, so each run measures a full, independent parse.
function parse(config) {
  return function measured() {
    Config.initialize(config, { logger: noopLogger })
  }
}

function setEnv() {
  for (const [key, value] of Object.entries(complexEnv)) {
    process.env[key] = value
  }
}

function clearEnv() {
  for (const key of Object.keys(complexEnv)) {
    delete process.env[key]
  }
}

// Evicts the schema module and the pre-compiled artifact from the require cache
// so the next `require('./schema')` performs a cold, artifact-backed build
// (re-requiring `schema.generated.js` and re-hydrating the env-var index Map).
// The schema block files are intentionally left cached: the artifact path never
// reads them, and this benchmark measures that path. Runs in `before`, so the
// eviction itself is not part of the measured work.
function bustSchemaModule() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes('/lib/config/schema.js') || key.includes('/lib/config/schema.generated.js')) {
      delete require.cache[key]
    }
  }
}

// Freshly requires the schema module and forces the one-time build. With the
// pre-compiled artifact present, this exercises the production path (a require
// of `schema.generated.js` plus env-var index hydration).
function buildSchemaCold() {
  const schema = require('#agentlib/config/schema.js')
  // Touch the cached getters that trigger and consume the build. Combine the
  // results so the accesses are not optimized away and no unused value lingers.
  return Boolean(schema.schema && schema.validate && schema.resolveEnvVar('NEW_RELIC_LICENSE_KEY'))
}

// Builds the schema state from disk, bypassing both the module cache and the
// pre-compiled artifact: reads every block file, compiles the ajv validator, and
// rebuilds the env-var index. This is the development / fallback path. `refs`
// eviction is unnecessary because `buildState` always constructs a fresh ajv
// instance and reads the schema files directly.
function buildSchemaFromDisk() {
  const schema = require('#agentlib/config/schema.js')
  const state = schema.buildState()
  return Boolean(state.schema && state.validate && state.envVarIndex.size)
}
