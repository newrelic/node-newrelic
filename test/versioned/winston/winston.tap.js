/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const concat = require('concat-stream')

tap.test('Winston instrumentation', { bail: true }, (t) => {
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

  /**
   * Log lines in and out of a transaction for every logger.
   * @param {Object} opts
   * @param {DerivedLogger} opts.logger instance of winston
   * @param {Array} opts.loggers an array of winston loggers
   * @param {Stream} opts.stream stream used to end test
   */
  const logStuff = ({ loggers, logger, stream }) => {
    loggers = loggers || [logger]
    loggers.forEach((logger) => {
      // Log some stuff, both in and out of a transaction
      logger.info('out of trans')

      helper.runInTransaction(agent, 'test', (transaction) => {
        logger.info('in trans')

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
   * @param {Object} opts
   * @param {DerivedLogger} opts.logger instance of winston
   * @param {Array} opts.loggers an array of winston loggers
   * @param {Stream} opts.stream stream used to end test
   * @param {Test} opts.t tap test
   */
  const logWithAggregator = ({ logger, loggers, stream, t }) => {
    let aggregatorLength = 0
    loggers = loggers || [logger]
    loggers.forEach((logger) => {
      // Log some stuff, both in and out of a transaction
      logger.info('out of trans')
      aggregatorLength++
      t.equal(
        agent.logs.getEvents().length,
        aggregatorLength,
        `should only add ${aggregatorLength} log to aggregator`
      )

      helper.runInTransaction(agent, 'test', (transaction) => {
        logger.info('in trans')
        t.equal(
          agent.logs.getEvents().length,
          aggregatorLength,
          `should keep log aggregator at ${aggregatorLength}`
        )

        transaction.end()
        aggregatorLength++
        t.equal(
          agent.logs.getEvents().length,
          aggregatorLength,
          `should only add ${aggregatorLength} log after transaction end`
        )
      })
    })

    // Force the stream to close so that we can test the output
    stream.end()
  }

  t.test('logging disabled', (t) => {
    t.autoend()

    t.beforeEach(() => {
      setup({ application_logging: { enabled: false } })
    })

    t.test('should not instrument logs when app logging is not enabled', (t) => {
      t.equal(!!winston.__NR_original, false, 'should not wrap createLogger')
      const assertFn = (msg) => {
        t.equal(msg['entity.name'], undefined, 'should not have entity name')
        t.equal(msg['entity.type'], undefined, 'should not have entity type')
        t.equal(msg.timestamp, undefined, 'should not have timestamp as number')
        t.equal(msg.hostname, undefined, 'should not have hostname as string')
        t.equal(msg.level, 'info')
        t.equal(msg['trace.id'], undefined, 'msg should not have trace id')
        t.equal(msg['span.id'], undefined, 'msg should not have span id')
        t.notOk(msg.message.includes('NR-LINKING'), 'should not contain NR-LINKING metadata')
      }

      const handleMessages = makeStreamTest(() => {
        t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
        t.end()
      })
      const jsonStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        transports: [
          // Log to a stream so we can test the output
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          })
        ]
      })

      logStuff({ logger, stream: jsonStream })
    })
  })

  t.test('local log decorating', (t) => {
    t.autoend()

    t.beforeEach(() => {
      setup({ application_logging: { enabled: true, local_decorating: { enabled: true } } })
    })

    t.test('should not instrument logs when app logging is not enabled', (t) => {
      t.equal(!!winston.__NR_original, false, 'should not wrap createLogger')
      const assertFn = (msg) => {
        t.equal(msg['entity.name'], undefined, 'should not have entity name')
        t.equal(msg['entity.type'], undefined, 'should not have entity type')
        t.equal(msg.timestamp, undefined, 'should not have timestamp as number')
        t.equal(msg.hostname, undefined, 'should not have hostname as string')
        t.equal(msg.level, 'info')
        t.equal(msg['trace.id'], undefined, 'msg should not have trace id')
        t.equal(msg['span.id'], undefined, 'msg should not have span id')
        t.ok(msg.message.includes('NR-LINKING'), 'should contain NR-LINKING metadata')
      }

      const handleMessages = makeStreamTest(() => {
        t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
        t.end()
      })
      const jsonStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        transports: [
          // Log to a stream so we can test the output
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          })
        ]
      })

      logStuff({ logger, stream: jsonStream })
    })

    t.test('should not double log nor instrument composed logger', (t) => {
      const assertFn = (msg) => {
        t.equal(msg['entity.name'], undefined, 'should not have entity name')
        t.equal(msg['entity.type'], undefined, 'should not have entity type')
        t.equal(msg.timestamp, undefined, 'should not have timestamp as number')
        t.equal(msg.hostname, undefined, 'should not have hostname as string')
        t.equal(msg.level, 'info')
        t.equal(msg['trace.id'], undefined, 'msg should not have trace id')
        t.equal(msg['span.id'], undefined, 'msg should not have span id')
        t.ok(msg.message.includes('NR-LINKING'), 'should contain NR-LINKING metadata')
      }

      const handleMessages = makeStreamTest(() => {
        t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
        t.end()
      })
      const jsonStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        format: winston.format.simple(),
        transports: [
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          })
        ]
      })
      const subLogger = winston.createLogger(logger)

      logStuff({ loggers: [logger, subLogger], stream: jsonStream })
    })
  })

  t.test('log forwarding enabled', (t) => {
    t.autoend()

    t.beforeEach(() => {
      setup({
        application_logging: {
          enabled: true,
          forwarding: {
            enabled: true
          }
        }
      })
    })

    const msgAssertFn = (t, msg) => {
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
      t.notOk(msg.message.includes('NR-LINKING'), 'should not contain NR-LINKING metadata')
    }

    t.test('should add linking metadata to all transports', (t) => {
      const handleMessages = makeStreamTest(() => {
        t.ok(agent.logs.getEvents().length, 2, 'should add both logs to aggregator')
        t.end()
      })
      const assertFn = msgAssertFn.bind(null, t)
      const jsonStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        transports: [
          // Log to a stream so we can test the output
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          })
        ]
      })

      logWithAggregator({ logger, stream: jsonStream, t })
    })

    t.test('should instrument top-level format', (t) => {
      const handleMessages = makeStreamTest(() => {
        t.end()
      })
      const assertFn = msgAssertFn.bind(null, t)
      const simpleStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        format: winston.format.simple(),
        transports: [
          new winston.transports.Stream({
            level: 'info',
            stream: simpleStream
          })
        ]
      })
      t.equal(!!winston.createLogger.__NR_original, true)

      logWithAggregator({ logger, stream: simpleStream, t })
    })

    t.test('should not double log nor instrument composed logger', (t) => {
      const handleMessages = makeStreamTest(() => {
        t.end()
      })
      const assertFn = msgAssertFn.bind(null, t)
      const simpleStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        format: winston.format.simple(),
        transports: [
          new winston.transports.Stream({
            level: 'info',
            stream: simpleStream
          })
        ]
      })
      const subLogger = winston.createLogger(logger)

      logWithAggregator({ loggers: [logger, subLogger], stream: simpleStream, t })
    })
  })

  t.test('application logging enabled and log enricher used', (t) => {
    const API = require('../../../api')
    t.autoend()

    t.beforeEach(() => {
      setup({
        application_logging: {
          enabled: true,
          forwarding: {
            enabled: false
          }
        }
      })
    })

    const msgAssertFn = (t, msg) => {
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
      t.notOk(msg.message.includes('NR-LINKING'), 'should not contain NR-LINKING metadata')
    }

    t.test('should add linking metadata to all transports', (t) => {
      const api = new API(agent)
      const nrFormatter = require('@newrelic/winston-enricher/lib/createFormatter')
      const handleMessages = makeStreamTest(() => {
        t.equal(agent.logs.getEvents().length, 0, 'should not add logs to aggregator')
        t.end()
      })
      const assertFn = msgAssertFn.bind(null, t)
      const jsonStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        transports: [
          // Log to a stream so we can test the output
          new winston.transports.Stream({
            level: 'info',
            format: nrFormatter(api, winston)(),
            stream: jsonStream
          })
        ]
      })

      logStuff({ logger, stream: jsonStream, t })
    })
  })
})
