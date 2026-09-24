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
    // The schema is read from disk and compiled once per process, then cached,
    // so the per-parse cases above never pay that cost. This case measures the
    // one-time cold build: `before` evicts the schema module (and its block
    // files) from the require cache so the measured `fn` re-reads every schema
    // file and recompiles the ajv validator.
    name: 'cold schema build (file reads + ajv compile)',
    before: bustSchemaCache,
    fn: buildSchemaCold
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

// Evicts the schema module and every schema block file from the require cache
// so the next `require('./schema')` performs a cold build. Runs in `before`, so
// the eviction itself is not part of the measured work.
function bustSchemaCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes('/lib/config/schema.js') || key.includes('/lib/config/schemas/')) {
      delete require.cache[key]
    }
  }
}

// Freshly requires the schema module and forces the one-time build (reading all
// schema files, compiling the ajv validator, and building the env-var index).
function buildSchemaCold() {
  const schema = require('#agentlib/config/schema.js')
  // Touch the cached getters that trigger and consume the build. Combine the
  // results so the accesses are not optimized away and no unused value lingers.
  return Boolean(schema.schema && schema.validate && schema.resolveEnvVar('NEW_RELIC_LICENSE_KEY'))
}
