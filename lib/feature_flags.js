'use strict'

// unreleased flags gating an active feature
exports.prerelease = {
  custom_instrumentation: true,
  custom_metrics: true,
  express5: false,
  synthetics: true,
  await_support: false,
  native_metrics: true,
  promise_segments: false,
  reverse_naming_rules: false,
  send_request_uri_attribute: false
}

// flags that are no longer used for released features
exports.released = [
  'released',
  'cat',
  'express4',
  'express_segments',
  'insights',
  'postgres',
  'mysql_pool',
  'proxy',
  'custom_events'
]

// flags that are no longer used for unreleased features
exports.unreleased = [
  'unreleased'
]
