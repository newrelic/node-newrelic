/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { createContextKey } = require('@opentelemetry/api')
const ExportResultCode = { SUCCESS: 0, FAILED: 1 }
const SUPPRESS_TRACING_KEY = createContextKey('OpenTelemetry SDK Context Key SUPPRESS_TRACING')

module.exports = {
  ExportResultCode,
  SUPPRESS_TRACING_KEY
}
