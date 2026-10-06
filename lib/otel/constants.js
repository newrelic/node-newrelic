/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { createContextKey } = require('@opentelemetry/api')
const ExportResultCode = { SUCCESS: 0, FAILED: 1 }
const SamplingDecision = {
  NOT_RECORD: 0,
  RECORD: 1,
  RECORD_AND_SAMPLED: 2
}
const SUPPRESS_TRACING_KEY = createContextKey('OpenTelemetry SDK Context Key SUPPRESS_TRACING')
const ATTR_VALUE_LENGTH_LIMIT = 4_095

module.exports = {
  ATTR_VALUE_LENGTH_LIMIT,
  ExportResultCode,
  SamplingDecision,
  SUPPRESS_TRACING_KEY
}
