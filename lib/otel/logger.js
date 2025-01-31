/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { diag, DiagLogLevel } = require('@opentelemetry/api')

// Map New Relic log levels to OTel log levels
const logLevels = {
  trace: 'VERBOSE',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  fatal: 'ERROR'
}

module.exports = function createOtelLogger(logger, config) {
  // enable exporter logging
  // OTel API calls "verbose" what we call "trace".
  logger.verbose = logger.trace
  const logLevel = DiagLogLevel[logLevels[config.logging.level]]
  diag.setLogger(logger, logLevel)
}
