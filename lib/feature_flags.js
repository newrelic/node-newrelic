/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// unreleased flags gating an active feature
exports.prerelease = {
  // internal_test_only is used for testing our feature flag implementation.
  // It is not used to gate any features.
  internal_test_only: false,
  promise_segments: false,
  reverse_naming_rules: false,
  unresolved_promise_cleanup: true,
  kafkajs_instrumentation: false,
  undici_error_tracking: true
}

// flags that are no longer used for released features
exports.released = [
  'async_local_context',
  'await_support',
  'aws_bedrock_instrumentation',
  'cat',
  'certificate_bundle',
  'custom_instrumentation',
  'custom_metrics',
  'dt_format_w3c',
  'express_segments',
  'fastify_instrumentation',
  'langchain_instrumentation',
  'native_metrics',
  'new_promise_tracking',
  'opentelemetry',
  'protocol_17',
  'released',
  'send_request_uri_attribute',
  'serverless_mode',
  'synthetics',
  'undici_async_tracking',
  'undici_instrumentation',
]

// flags that are no longer used for unreleased features
exports.unreleased = ['unreleased', 'legacy_context_manager']
