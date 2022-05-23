/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const helpers = module.exports

// NOTE: pino adds hostname to log lines which is why we don't check it here
helpers.CONTEXT_KEYS = [
  'entity.name',
  'entity.type',
  'entity.guid',
  'trace.id',
  'span.id',
  'hostname'
]

/**
 * To be registered as a tap assertion
 */
helpers.validateLogLine = function validateLogLine({ line: logLine, message, level, config }) {
  this.equal(
    logLine['entity.name'],
    config.applications()[0],
    'should have entity name that matches app'
  )
  this.equal(logLine['entity.guid'], 'test-guid', 'should have set entitye guid')
  this.equal(logLine['entity.type'], 'SERVICE', 'should have entity type of SERVICE')
  this.equal(logLine.hostname, config.getHostnameSafe(), 'should have proper hostname')
  this.match(logLine.timestamp, /[0-9]{10}/, 'should have proper unix timestamp')
  this.notOk(logLine.message.includes('NR-LINKING'), 'should not contain NR-LINKING metadata')
  if (message) {
    this.equal(logLine.message, message, 'message should be the same as log')
  }

  if (level) {
    this.equal(logLine.level, level, 'level should be string value not number')
  }
}
