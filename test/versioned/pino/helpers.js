/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const helpers = module.exports
const { CONTEXT_KEYS } = require('../../lib/logging-helper')

/**
 * Assert function to verify the original log line is untouched by our instrumentation unless
 * local log decoration is enabled.  Local log decoration asserts `NR-LINKING` string exists on msg
 *
 * @param {Object} opts
 * @param {Test} opts.t tap test
 * @param {boolean} [opts.includeLocalDecorating=false] is local log decoration enabled
 * @param {boolean} [opts.timestamp=false] does timestamp exist on original message
 * @param {string} [opts.level=info] level to assert is on message
 */
helpers.originalMsgAssertion = function originalMsgAssertion({
  t,
  includeLocalDecorating = false,
  level = 30,
  logLine,
  hostname
}) {
  CONTEXT_KEYS.forEach((key) => {
    if (key !== 'hostname') {
      t.notOk(logLine[key], `should not have ${key}`)
    }
  })

  t.ok(logLine.time, 'should include timestamp')
  t.equal(logLine.level, level, `should be ${level} level`)
  // pino by default includes hostname
  t.equal(logLine.hostname, hostname, 'hostname should not change')
  if (includeLocalDecorating) {
    t.ok(logLine.msg.includes('NR-LINKING'), 'should contain NR-LINKING metadata')
  } else {
    t.notOk(logLine.msg.includes('NR-LINKING'), 'should not contain NR-LINKING metadata')
  }
}
