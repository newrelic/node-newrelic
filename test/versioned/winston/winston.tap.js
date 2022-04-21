/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const concat = require('concat-stream')

tap.test('Winston instrumentation', (t) => {
  t.autoend()

  let agent
  let winston

  function setup(config) {
    agent = helper.instrumentMockedAgent(config)
    winston = require('winston')
  }

  t.afterEach(() => {
    agent && helper.unloadAgent(agent)
    winston = null
    // must purge require cache of winston related instrumentation
    // otherwise it will not re-register on subsequent test runs
    Object.keys(require.cache).forEach((key) => {
      if (/winston/.test(key)) {
        delete require.cache[key]
      }
    })
  })

  // Stream factory for a test. Applies common assertions to logged messages.
  const makeStreamTest = (cb) => {
    let toBeClosed = 0
    return (assertFn) => {
      toBeClosed++
      return (msgs) => {
        for (const msg of msgs) {
          assertFn(msg)
        }
        if (--toBeClosed === 0) {
          cb()
        }
      }
    }
  }

  const logStuff = (logger, streams) => {
    // Log some stuff, both in and out of a transaction
    logger.info('out of trans')

    helper.runInTransaction(agent, 'test', () => {
      logger.info('in trans')

      // Force the streams to close so that we can test the output
      streams.forEach((stream) => {
        stream.end()
      })
    })
  }

  t.test('logging disabled', (t) => {
    t.autoend()

    t.beforeEach(() => {
      setup({ application_logging: { enabled: false } })
    })

    t.test('should not instrument logs when app logging is not enabled', (t) => {
      const assertFn = (msg) => {
        t.equal(msg['entity.name'], undefined, 'should not have entity name')
        t.equal(msg['entity.type'], undefined, 'should not have entity type')
        t.equal(msg.timestamp, undefined, 'should not have timestamp as number')
        t.equal(msg.hostname, undefined, 'should not have hostname as string')
        t.equal(msg.level, 'info')
        t.equal(msg['trace.id'], undefined, 'msg should not have trace id')
        t.equal(msg['span.id'], undefined, 'msg should not have span id')
      }

      const handleMessages = makeStreamTest(() => {
        t.end()
      })
      const jsonStream = concat(handleMessages(assertFn))
      const simpleStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        transports: [
          // Log to a stream so we can test the output
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          }),
          // Handle streams with pre-set formats
          new winston.transports.Stream({
            level: 'info',
            format: winston.format.simple(),
            stream: simpleStream
          })
        ]
      })

      logStuff(logger, [jsonStream, simpleStream])
    })
  })

  t.test('logging enabled', (t) => {
    t.autoend()

    t.beforeEach(() => {
      setup({ application_logging: { enabled: true } })
    })

    t.test('should add linking metadata to all transports', (t) => {
      const assertFn = (msg) => {
        t.equal(msg['entity.name'], agent.config.applications()[0], 'should have entity name')
        t.equal(msg['entity.type'], 'SERVICE', 'should have entity type')
        t.equal(typeof msg.timestamp, 'number', 'should have timestamp as number')
        t.equal(msg.hostname, agent.config.getHostnameSafe(), 'should have hostname as string')
        t.equal(msg.level, 'info')
        if (msg.message === 'out of trans') {
          t.equal(msg['trace.id'], undefined, 'msg out of trans should not have trace id')
          t.equal(msg['span.id'], undefined, 'msg out of trans should not have span id')
        } else if (msg.message === 'in trans') {
          t.equal(typeof msg['trace.id'], 'string', 'msg in trans should have trace id')
          t.equal(typeof msg['span.id'], 'string', 'msg in trans should have span id')
        }
      }

      const handleMessages = makeStreamTest(() => {
        t.end()
      })
      const jsonStream = concat(handleMessages(assertFn))
      const simpleStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        transports: [
          // Log to a stream so we can test the output
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          }),
          // Handle streams with pre-set formats
          new winston.transports.Stream({
            level: 'info',
            format: winston.format.simple(),
            stream: simpleStream
          })
        ]
      })

      logStuff(logger, [jsonStream, simpleStream])
    })

    t.test('should preserve original_timestamp on transports with timestamp formats', (t) => {
      const assertFn = (msg) => {
        t.equal(msg.label, 'test', 'format applies test label')
        t.ok('original_timestamp' in msg, 'formatter must preserve original timestamp')
        t.ok(/^\d{4}$/.test(msg.original_timestamp), 'original_timestamp must be YYYY')
        t.equal(typeof msg.timestamp, 'number', 'timestamp must be a number')
      }

      const handleMessages = makeStreamTest(() => {
        t.end()
      })
      const stream = concat(handleMessages(assertFn))

      const logger = winston.createLogger({
        transports: [
          new winston.transports.Stream({
            level: 'info',
            format: winston.format.combine(
              winston.format.timestamp({ format: 'YYYY' }),
              winston.format.label({ label: 'test' })
            ),
            stream
          })
        ]
      })

      logStuff(logger, [stream])
    })

    t.test('should add error metadata to logs', (t) => {
      const assertFn = (msg) => {
        t.ok(msg['error.message'], 'Error messages are captured')
        t.equal(msg['error.message'], 'test error message', 'Error message should be unmodified')
        t.ok(msg['error.class'], 'Error classes are captured')
        t.ok(msg['error.stack'], 'Error stack traces are captured')
        t.notOk(msg.stack, 'Stack removed from JSON')
        t.notOk(msg.trace, 'Trace removed from JSON')
      }

      const handleMessages = makeStreamTest(() => {
        t.end()
      })
      const stream = concat(handleMessages(assertFn))

      winston.createLogger({
        transports: [
          new winston.transports.Stream({
            level: 'info',
            handleExceptions: true,
            stream
          })
        ],
        exitOnError: false
      })

      process.emit('uncaughtException', new Error('test error message'))
      stream.end()
    })
  })
})
