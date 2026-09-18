/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Logger = require('./util/logger')
const fs = require('./util/unwrapped-core').fs

// create bootstrapping logger
const logger = new Logger({
  name: 'newrelic_bootstrap',
  level: 'info',

  // logger is configured below.  Logs are queued until configured
  configured: false
})

module.exports = logger

// Once configuration has finished loading and parsing we need to reconfigure
// the logger with the settings therein, and flush the buffer that has been
// accumulating since construction.
process.on('nr-config-load-complete', (config) => {
  const options = {
    name: 'newrelic',
    level: config.logging.level,
    enabled: config.logging.enabled,
    auditLogging: config.audit_log?.enabled === true
  }
  // Apply the user supplied logging configuration to the logger instance:
  logger.configure(options)

  if (config.logging.enabled === false) {
    return
  }
  let stream
  switch (config.logging.filepath) {
    case 'stdout': {
      stream = process.stdout
      break
    }

    case 'stderr': {
      stream = process.stderr
      break
    }

    default: {
      stream = fs.createWriteStream(
        config.logging.filepath,
        { flags: 'a+', mode: 0o600 }
      )
      stream.on('error', function logStreamOnError(error) {
        // Since the logger didn't work correctly, issue a warning to the
        // process's stderr through core's facility:
        console.error('New Relic failed to open log file', config.logging.filepath)
        console.error(error)
      })
    }
  }
  logger.pipe(stream)
})
