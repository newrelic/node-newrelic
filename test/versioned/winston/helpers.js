/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const helpers = module.exports

const { CONTEXT_KEYS, validateLogLine, validateCommonAttrs } = require('../../lib/logging-helper')

/**
 * Stream factory for a test.  Iterates over every message and calls an assertFn.
 * When all messages have been emitted it calls the callback function
 *
 * @param {function} cb callback after all messages have been emitted
 */
helpers.makeStreamTest = function makeStreamTest(cb) {
  let toBeClosed = 0
  return (assertFn) => {
    toBeClosed++
    return (msgs) => {
      for (const msg of msgs) {
        assertFn(msg)
      }
      if (--toBeClosed === 0) {
        cb(msgs)
      }
    }
  }
}

/**
 * Log lines in and out of a transaction for every logger.
 * @param {object} opts
 * @param {DerivedLogger} opts.logger instance of winston
 * @param {Array} opts.loggers an array of winston loggers
 * @param {Stream} opts.stream stream used to end test
 * @param {object} opts.helper test helpers
 * @param {object} opts.agent new relic agent
 */
helpers.logStuff = function logStuff({ loggers, logger, stream, helper, agent }) {
  loggers = loggers || [logger]
  loggers.forEach((log) => {
    // Log some stuff, both in and out of a transaction
    log.info('out of trans')

    helper.runInTransaction(agent, 'test', (transaction) => {
      log.info('in trans')

      transaction.end()
    })
  })

  // Force the stream to close so that we can test the output
  stream.end()
}

/**
 * Logs lines in and out of transaction for every logger and also asserts the size of the log
 * aggregator.  The log line in transaction context should not be added to aggregator
 * until after the transaction ends
 *
 * @param {object} opts
 * @param {DerivedLogger} opts.logger instance of winston
 * @param {Array} opts.loggers an array of winston loggers
 * @param {Stream} opts.stream stream used to end test
 * @param {object} opts.helper test helpers
 * @param {object} opts.agent new relic agent
 */
helpers.logWithAggregator = function logWithAggregator({ logger, loggers, stream, agent, helper }) {
  let aggregatorLength = 0
  loggers = loggers || [logger]
  loggers.forEach((log) => {
    // Log some stuff, both in and out of a transaction
    log.info('out of trans')
    aggregatorLength++
    assert.equal(
      agent.logs.getEvents().length,
      aggregatorLength,
      `should only add ${aggregatorLength} log to aggregator`
    )

    helper.runInTransaction(agent, 'test', (transaction) => {
      log.info('in trans')
      assert.equal(
        agent.logs.getEvents().length,
        aggregatorLength,
        `should keep log aggregator at ${aggregatorLength}`
      )

      transaction.end()
      aggregatorLength++
      assert.equal(
        agent.logs.getEvents().length,
        aggregatorLength,
        `should only add ${aggregatorLength} log after transaction end`
      )
    })
  })

  // Force the stream to close so that we can test the output
  stream.end()
}

/**
 * Assert function to verify the original log line is untouched by our instrumentation unless
 * local log decoration is enabled.  Local log decoration asserts `NR-LINKING` string exists on msg
 *
 * @param {Object} opts
 * @param {boolean} [opts.includeLocalDecorating] is local log decoration enabled
 * @param {boolean} [opts.timestamp] does timestamp exist on original message
 * @param {string} [opts.level] level to assert is on message
 * @param msg
 */
helpers.originalMsgAssertion = function originalMsgAssertion(
  { includeLocalDecorating = false, timestamp = false, level = 'info' },
  msg
) {
  CONTEXT_KEYS.forEach((key) => {
    assert.equal(msg[key], undefined, `should not have ${key}`)
  })

  if (timestamp) {
    assert.ok(msg.timestamp, 'should include timestamp')
  } else {
    assert.equal(msg.timestamp, undefined, 'should not have timestamp')
  }
  assert.equal(msg.level, level, `should be ${level} level`)
  if (includeLocalDecorating) {
    assert.ok(msg.message.includes('NR-LINKING'), 'should contain NR-LINKING metadata')
  } else {
    assert.equal(
      msg.message.includes('NR-LINKING'),
      false,
      'should not contain NR-LINKING metadata'
    )
  }
}

/**
 * Assert function to verify the log line getting added to aggregator contains NR linking
 * metadata.
 *
 * @param {string} logLine log line
 * @param {object} agent Mocked agent instance
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

  const [payload] = agent.logs._toPayloadSync()
  const commonAttrs = payload.common.attributes
  validateCommonAttrs({ commonAttrs, config: agent.config })
}
