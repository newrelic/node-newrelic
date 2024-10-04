/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')

// NOTE: pino adds hostname to log lines which is why we don't check it here
const CONTEXT_KEYS = [
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
function validateLogLine({ line: logLine, message, level, config }) {
  assert.equal(
    logLine['entity.name'],
    config.applications()[0],
    'should have entity name that matches app'
  )
  assert.equal(logLine['entity.guid'], 'test-guid', 'should have set entity guid')
  assert.equal(logLine['entity.type'], 'SERVICE', 'should have entity type of SERVICE')
  assert.equal(logLine.hostname, config.getHostnameSafe(), 'should have proper hostname')
  assert.equal(/[0-9]{10}/.test(logLine.timestamp), true, 'should have proper unix timestamp')
  assert.equal(
    logLine.message.includes('NR-LINKING'),
    false,
    'should not contain NR-LINKING metadata'
  )
  if (message) {
    assert.equal(logLine.message, message, 'message should be the same as log')
  }

  if (level) {
    assert.equal(logLine.level, level, 'level should be string value not number')
  }
}

module.exports = {
  CONTEXT_KEYS,
  validateLogLine
}
