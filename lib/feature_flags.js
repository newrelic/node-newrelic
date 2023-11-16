/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// unreleased flags gating an active feature
exports.prerelease = {
  express5: false,
  promise_segments: false,
  reverse_naming_rules: false,
  undici_async_tracking: true,
  unresolved_promise_cleanup: true,
  legacy_context_manager: false
}

// flags that are no longer used for released features
exports.released = [
  'released',
  'cat',
  'custom_instrumentation',
  'custom_metrics',
  'express_segments',
  'native_metrics',
  'new_promise_tracking',
  'protocol_17',
  'serverless_mode',
  'send_request_uri_attribute',
  'synthetics',
  'dt_format_w3c',
  'fastify_instrumentation',
  'await_support',
  'certificate_bundle',
  'async_local_context',
  'undici_instrumentation'
]

// flags that are no longer used for unreleased features
exports.unreleased = ['unreleased']
