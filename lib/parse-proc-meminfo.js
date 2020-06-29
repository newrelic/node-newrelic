/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var logger = require('./logger.js').child({component: 'proc-meminfo'})

module.exports = parseProcMeminfo

function parseProcMeminfo(data) {
  var mem_total = parseInt(data.replace(/MemTotal:\s*(\d*)\skB/, '$1'), 10)

  if (mem_total) return mem_total / 1024

  logger.debug('Unable to parse memory string:', data)
  return null
}
