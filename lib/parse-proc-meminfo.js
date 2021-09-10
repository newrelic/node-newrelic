/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('./logger.js').child({ component: 'proc-meminfo' })

module.exports = parseProcMeminfo

function parseProcMeminfo(data) {
  const memTotal = parseInt(data.replace(/MemTotal:\s*(\d*)\skB/, '$1'), 10)

  if (memTotal) {
    return memTotal / 1024
  }

  logger.debug('Unable to parse memory string:', data)
  return null
}
