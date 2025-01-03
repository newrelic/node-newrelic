/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const helpers = module.exports
const { CONTEXT_KEYS } = require('../../lib/logging-helper')

/**
 * Assert function to verify the original log line is untouched by our instrumentation unless
 * local log decoration is enabled.  Local log decoration asserts `NR-LINKING` string exists on msg
 *
 * @param {Object} opts
 * @param {boolean} [opts.includeLocalDecorating] is local log decoration enabled
 * @param {boolean} [opts.timestamp] does timestamp exist on original message
 * @param {string} [opts.level] level to assert is on message
 * @param opts.logLine
 * @param opts.hostname
 */
helpers.originalMsgAssertion = function originalMsgAssertion({
  includeLocalDecorating = false,
  level = 30,
  logLine,
  hostname
}) {
  CONTEXT_KEYS.forEach((key) => {
    assert.equal(logLine[key], undefined, `should not have ${key}`)
  })

  assert.ok(logLine.time, 'should include timestamp')
  assert.equal(logLine.level, level, `should be ${level} level`)
  // pino by default includes hostname
  assert.equal(logLine.hostname, hostname, 'hostname should not change')
  if (includeLocalDecorating) {
    assert.ok(logLine.msg.includes('NR-LINKING'), 'should contain NR-LINKING metadata')
  } else {
    assert.equal(
      logLine.msg.includes('NR-LINKING'),
      false,
      'should not contain NR-LINKING metadata'
    )
  }
}
