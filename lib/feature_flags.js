/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// unreleased flags gating an active feature
exports.prerelease = {
  express5: false,
  await_support: true,
  serverless_mode: true, // TODO: Move to released & remove code checks next Major.
  promise_segments: false,
  reverse_naming_rules: false,
  fastify_instrumentation: false,
  // Starts by defaulting true as introducing for deprecation/removal purposes.
  // Will eventually set false prior full removal of feature.
  certificate_bundle: true,
  new_promise_tracking: false
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
  'synthetics',
  'dt_format_w3c'
]

// flags that are no longer used for unreleased features
exports.unreleased = [
  'unreleased'
]
