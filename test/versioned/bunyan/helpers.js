/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')

const helpers = module.exports
const { CONTEXT_KEYS, validateLogLine } = require('../../lib/logging-helper')

/**
 * Provides a mocked-up writable stream that can be provided to Bunyan for easier testing
 * @returns a mock Writable stream
 */
helpers.makeSink = function makeSink() {
  return {
    logs: [],
    write: function write(logLine) {
      this.logs.push(logLine)
    }
  }
}

/**
 * Log lines in and out of a transaction for every logger.
 * @param {object} opts
 * @param {Logger} opts.logger instance of bunyan
 * @param {object} opts.helper test helpers
 * @param {object} opts.agent new relic agent
 */
helpers.logStuff = function logStuff({ logger, helper, agent }) {
  // Log some stuff, both in and out of a transaction
  logger.info('out of trans')

  helper.runInTransaction(agent, 'test', (transaction) => {
    logger.info('in trans')

    transaction.end()
  })
}

/**
 * Assert function to verify the original log line is untouched by our instrumentation unless
 * local log decoration is enabled.  Local log decoration asserts `NR-LINKING` string exists on msg
 *
 * @param {Object} opts
 * @param {boolean} [opts.includeLocalDecorating=false] is local log decoration enabled
 * @param {string} [opts.level=info] level to assert is on message
 */
helpers.originalMsgAssertion = function originalMsgAssertion({
  includeLocalDecorating = false,
  level = 30,
  logLine,
  hostname
}) {
  CONTEXT_KEYS.forEach((key) => {
    if (key !== 'hostname') {
      assert.equal(logLine[key], undefined, `should not have ${key}`)
    }
  })

  assert.ok(logLine.time, 'should include timestamp')
  assert.equal(logLine.level, level, `should be ${level} level`)
  // bunyan by default includes hostname
  assert.equal(logLine.hostname, hostname, 'hostname should not change')
  if (includeLocalDecorating) {
    assert.ok(logLine.message.includes('NR-LINKING'), 'should contain NR-LINKING metadata')
  } else {
    assert.equal(
      logLine.msg.includes('NR-LINKING'),
      false,
      'should not contain NR-LINKING metadata'
    )
  }
}

/**
 * Assert function to verify the log line getting added to aggregator contains NR linking
 * metadata.
 *
 * @param {object} logLine log line
 * @param {object} agent Mocked agent instance.
 */
helpers.logForwardingMsgAssertion = function logForwardingMsgAssertion(logLine, agent) {
  if (logLine.message === 'out of trans') {
    validateLogLine({
      line: logLine,
      message: 'out of trans',
      level: 'info',
      config: agent.config
    })
    assert.equal(logLine['trace.id'], undefined, 'msg out of trans should not have trace id')
    assert.equal(logLine['span.id'], undefined, 'msg out of trans should not have span id')
  } else if (logLine.message === 'in trans') {
    validateLogLine({
      line: logLine,
      message: 'in trans',
      level: 'info',
      config: agent.config
    })
    assert.equal(typeof logLine['trace.id'], 'string', 'msg in trans should have trace id')
    assert.equal(typeof logLine['span.id'], 'string', 'msg in trans should have span id')
  }
}
