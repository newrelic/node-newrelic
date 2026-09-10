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

// A configuration file loaded from disk that specifies a value for every field
// the definition exposes, including the object-shaped distributed tracing
// samplers. Regenerate with `node test/benchmark/lib/config/generate-full-config.js`.
const fullConfig = require('./full-config.json')

// A config that leans on the parts of parsing that do real work: alternate
// (object-shaped) samplers exercise the sampler builder, and the string values
// below are re-parsed by their formatters on the way in.
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
// string, as it would be in a real environment, so the definition's formatters
// (int, float, boolean, array, allowList) run while parsing. Set in `before`
// and cleared in `after` so neither the setup nor the teardown is measured.
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

// A logger that discards everything. `Config` reads a module-level logger that
// is normally bootstrapped inside `initialize`; supplying a no-op instance keeps
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
    Config.initialize(config, { loggerInstance: noopLogger })
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
