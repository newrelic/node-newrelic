'use strict'

// unreleased flags gating an active feature
exports.prerelease = {
  express5: false,
  await_support: true,
  serverless_mode: true,
  promise_segments: false,
  reverse_naming_rules: false
}

// flags that are no longer used for released features
exports.released = [
  'released',
  'cat',
  'custom_instrumentation',
  'custom_metrics',
  'express_segments',
  'native_metrics',
  'protocol_17',
  'send_request_uri_attribute',
  'synthetics'
]

// flags that are no longer used for unreleased features
exports.unreleased = [
  'unreleased'
]
