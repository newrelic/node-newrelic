'use strict'

// unreleased flags gating an active feature
exports.prerelease = {
  express5: false,
  await_support: true,
  native_metrics: true,
  serverless_mode: false,
  promise_segments: false,
  reverse_naming_rules: false
}

// flags that are no longer used for released features
exports.released = [
  'released',
  'cat',
  'custom_instrumentation',
  'custom_metrics',
  'express4',
  'express_segments',
  'insights',
  'postgres',
  'mysql_pool',
  'protocol_17',
  'proxy',
  'custom_events',
  'send_request_uri_attribute',
  'synthetics'
]

// flags that are no longer used for unreleased features
exports.unreleased = [
  'unreleased'
]
