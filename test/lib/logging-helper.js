/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')

const CONTEXT_KEYS = ['trace.id', 'span.id']

/**
 * Validates context about a given log line
 *
 * @param {object} params to fn
 * @param {object} params.log log line
 * @param {string} params.message message in log line
 * @param {number} params.level log level
 */
function validateLogLine({ line: logLine, message, level }) {
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

/**
 * Validates the common attributes of a given log payload
 *
 * @param {object} params to fn
 * @param {object} params.commonAttrs common attributes on a log batch
 * @param {object} params.config agent config
 */
function validateCommonAttrs({ commonAttrs, config }) {
  assert.equal(
    commonAttrs['entity.name'],
    config.applications()[0],
    'should have entity name that matches app'
  )
  assert.equal(commonAttrs['entity.guid'], 'test-guid', 'should have set entity guid')
  assert.equal(commonAttrs['entity.type'], 'SERVICE', 'should have entity type of SERVICE')
  assert.equal(commonAttrs.hostname, config.getHostnameSafe(), 'should have proper hostname')
}

module.exports = {
  CONTEXT_KEYS,
  validateLogLine,
  validateCommonAttrs
}
