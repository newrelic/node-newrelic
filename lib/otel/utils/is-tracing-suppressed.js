/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { SUPPRESS_TRACING_KEY } = require('../constants.js')

/**
 * Returns true if tracing has been suppressed on the given context via the
 * standard OpenTelemetry suppress-tracing mechanism.
 *
 * @param {object} context An OpenTelemetry context object.
 *
 * @returns {boolean}
 */
module.exports = function isTracingSuppressed(context) {
  return context.getValue(SUPPRESS_TRACING_KEY) === true
}
