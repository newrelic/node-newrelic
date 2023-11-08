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

/**
 * Don't load config until this point, because it requires this
 * module, and if it gets loaded too early, module.exports will have no
 * value.
 */
const config = require('./config').getOrCreateInstance()
if (config) {
  const options = {
    name: 'newrelic',
    level: config.logging.level,
    enabled: config.logging.enabled
  }

  // configure logger
  logger.configure(options)

  if (config.logging.enabled) {
    let stream
    switch (config.logging.filepath) {
      case 'stdout':
        stream = process.stdout
        break

      case 'stderr':
        stream = process.stderr
        break

      default:
        stream = fs.createWriteStream(config.logging.filepath, { flags: 'a+', mode: 0o600 })
        stream.on('error', function logStreamOnError(err) {
          /* eslint-disable no-console */
          // Since our normal logging didn't work, dump this to stderr.
          console.error('New Relic failed to open log file ' + config.logging.filepath)
          console.error(err)
          /* eslint-enable no-console */
        })
    }
    logger.pipe(stream)
  }
}
