/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const concat = require('concat-stream')
const { validateLogLine, CONTEXT_KEYS } = require('../../lib/logging-helper')
const { Writable } = require('stream')

// winston puts the log line getting construct through formatters on a symbol
// which is exported from this module
const { MESSAGE } = require('triple-beam')

tap.Test.prototype.addAssert('validateAnnotations', 2, validateLogLine)

tap.test('winston instrumentation', (t) => {
  t.autoend()

  let agent
  let winston

  function setup(config) {
    agent = helper.instrumentMockedAgent(config)
    agent.config.entity_guid = 'test-guid'
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
          cb(msgs)
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
   * @param {Object} opts
   * @param {DerivedLogger} opts.logger instance of winston
   * @param {Array} opts.loggers an array of winston loggers
   * @param {Stream} opts.stream stream used to end test
   * @param {Test} opts.t tap test
   */
  const logWithAggregator = ({ logger, loggers, stream, t }) => {
    let aggregatorLength = 0
    loggers = loggers || [logger]
    loggers.forEach((log) => {
      // Log some stuff, both in and out of a transaction
      log.info('out of trans')
      aggregatorLength++
      t.equal(
        agent.logs.getEvents().length,
        aggregatorLength,
        `should only add ${aggregatorLength} log to aggregator`
      )

      helper.runInTransaction(agent, 'test', (transaction) => {
        log.info('in trans')
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
    setup({ application_logging: { enabled: false } })
    t.equal(!!winston.__NR_original, false, 'should not wrap createLogger')
    const assertFn = (msg) => {
      CONTEXT_KEYS.forEach((key) => {
        t.notOk(msg[key], `should not have ${key}`)
      })
      t.notOk(msg.timestamp, 'should not have timestamp')
      t.equal(msg.level, 'info')
      t.notOk(msg.message.includes('NR-LINKING'), 'should not contain NR-LINKING metadata')
    }

    const handleMessages = makeStreamTest(() => {
      t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
      const metric = agent.metrics.getMetric('Supportability/Logging/Nodejs/winston/enabled')
      t.notOk(metric, 'should not create  pino/enabled metric when logging is disabled')
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

  t.test('logging enabled', (t) => {
    setup({ application_logging: { enabled: true } })
    winston.createLogger({})
    const metric = agent.metrics.getMetric('Supportability/Logging/Nodejs/winston/enabled')
    t.equal(metric.callCount, 1, 'should create external module metric')
    t.end()
  })

  t.test('local log decorating', (t) => {
    t.autoend()

    t.beforeEach(() => {
      setup({ application_logging: { enabled: true, local_decorating: { enabled: true } } })
    })

    const msgAssertFn = (t, msg) => {
      CONTEXT_KEYS.forEach((key) => {
        t.notOk(msg[key], `should not have ${key}`)
      })
      t.notOk(msg.timestamp, 'should not have timestamp')
      t.equal(msg.level, 'info')
      t.ok(msg.message.includes('NR-LINKING'), 'should contain NR-LINKING metadata')
    }

    t.test('should not add NR context to logs when decorating is enabled', (t) => {
      t.equal(!!winston.__NR_original, false, 'should not wrap createLogger')
      const handleMessages = makeStreamTest(() => {
        t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
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

      logStuff({ logger, stream: jsonStream })
    })

    t.test('should not double log nor instrument composed logger', (t) => {
      const handleMessages = makeStreamTest(() => {
        t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
        t.end()
      })

      const assertFn = msgAssertFn.bind(null, t)
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

    // See: https://github.com/newrelic/node-newrelic/issues/1196
    // This test adds a printf formatter and then asserts that both the log lines
    // have NR-LINKING in the message getting built in printf format
    t.test('should not affect the log line if formatter is not json', (t) => {
      const handleMessages = makeStreamTest((msgs) => {
        t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
        msgs.forEach((msg) => {
          t.match(
            msg[MESSAGE],
            /123 info: [in|out of]+ trans NR-LINKING|.*$/,
            'should add NR-LINKING data to formatted log line'
          )
        })
        t.end()
      })

      const assertFn = msgAssertFn.bind(null, t)
      const jsonStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        format: winston.format.combine(
          winston.format.label({ label: '123' }),
          winston.format.printf((info) => `${info.label} ${info.level}: ${info.message}`)
        ),
        transports: [
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          })
        ]
      })

      logStuff({ loggers: [logger], stream: jsonStream })
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
      if (msg.message === 'out of trans') {
        t.validateAnnotations({
          line: msg,
          message: 'out of trans',
          level: 'info',
          config: agent.config
        })
        t.equal(msg['trace.id'], undefined, 'msg out of trans should not have trace id')
        t.equal(msg['span.id'], undefined, 'msg out of trans should not have span id')
      } else if (msg.message === 'in trans') {
        t.validateAnnotations({
          line: msg,
          message: 'in trans',
          level: 'info',
          config: agent.config
        })
        t.equal(typeof msg['trace.id'], 'string', 'msg in trans should have trace id')
        t.equal(typeof msg['span.id'], 'string', 'msg in trans should have span id')
      }
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

    t.test('should properly reformat errors', (t) => {
      const name = 'TestError'
      // Simulate an error being thrown to trigger Winston's error handling
      class TestError extends Error {
        constructor(msg) {
          super(msg)
          this.name = name
        }
      }

      const handleMessages = makeStreamTest(() => {
        t.ok(agent.logs.getEvents().length, 1, 'should add error line to aggregator')
        t.end()
      })

      const errorMsg = 'throw uncaught exception test'
      const err = new TestError(errorMsg)

      const assertFn = (msg) => {
        t.equal(msg['error.message'], errorMsg, 'error.message should match')
        t.equal(msg['error.class'], name, 'error.class should match')
        t.ok(typeof msg['error.stack'] === 'string', 'error.stack should be a string')
        t.notOk(msg.stack, 'stack should be removed')
        t.notOk(msg.trace, 'trace should be removed')
      }
      const jsonStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      winston.createLogger({
        transports: [
          // Log to a stream so we can test the output
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream,
            handleExceptions: true
          })
        ],
        exitOnError: false
      })

      process.emit('uncaughtException', err)
      jsonStream.end()
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

    // See: https://github.com/newrelic/node-newrelic/issues/1196
    // This test adds a printf formatter and then asserts that both the log lines
    // in aggregator have keys added in other formatters and that the log line being built
    // is is in printf format
    t.test('should not affect the log line if formatter is not json', (t) => {
      const handleMessages = makeStreamTest((msgs) => {
        const events = agent.logs.getEvents()
        events.forEach((event) => {
          t.equal(
            event.label,
            '123',
            'should include keys added in other formaters to log line in aggregator'
          )
        })
        msgs.forEach((msg) => {
          t.match(
            msg[MESSAGE],
            /123 info: [in|out of]+ trans$/,
            'should add NR-LINKING data to formatted log line'
          )
        })
        t.end()
      })

      const assertFn = msgAssertFn.bind(null, t)
      const jsonStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        format: winston.format.combine(
          winston.format.label({ label: '123' }),
          winston.format.printf((info) => `${info.label} ${info.level}: ${info.message}`)
        ),
        transports: [
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          })
        ]
      })

      logWithAggregator({ loggers: [logger], stream: jsonStream, t })
    })
  })

  t.test('metrics', (t) => {
    t.autoend()
    let nullStream

    t.beforeEach(() => {
      nullStream = new Writable({
        write: (chunk, encoding, cb) => {
          cb()
        }
      })
    })

    t.test('should count logger metrics', (t) => {
      setup({
        application_logging: {
          enabled: true,
          metrics: {
            enabled: true
          },
          forwarding: { enabled: false },
          local_decorating: { enabled: false }
        }
      })

      const logger = winston.createLogger({
        transports: [
          new winston.transports.Stream({
            level: 'debug',
            // We don't care about the output for this test, just
            // total lines logged
            stream: nullStream
          })
        ]
      })

      helper.runInTransaction(agent, 'winston-test', () => {
        const logLevels = {
          debug: 20,
          info: 5,
          warn: 3,
          error: 2
        }
        for (const [logLevel, maxCount] of Object.entries(logLevels)) {
          for (let count = 0; count < maxCount; count++) {
            const msg = `This is log message #${count} at ${logLevel} level`
            logger[logLevel](msg)
          }
        }

        // Close the stream so that the logging calls are complete
        nullStream.end()

        let grandTotal = 0
        for (const [logLevel, maxCount] of Object.entries(logLevels)) {
          grandTotal += maxCount
          const metricName = `Logging/lines/${logLevel}`
          const metric = agent.metrics.getMetric(metricName)
          t.ok(metric, `ensure ${metricName} exists`)
          t.equal(metric.callCount, maxCount, `ensure ${metricName} has the right value`)
        }
        const metricName = `Logging/lines`
        const metric = agent.metrics.getMetric(metricName)
        t.ok(metric, `ensure ${metricName} exists`)
        t.equal(metric.callCount, grandTotal, `ensure ${metricName} has the right value`)
        t.end()
      })
    })

    const configValues = [
      {
        name: 'application_logging is not enabled',
        config: { application_logging: { enabled: false, metrics: { enabled: true } } }
      },
      {
        name: 'application_logging.metrics is not enabled',
        config: { application_logging: { enabled: true, metrics: { enabled: false } } }
      }
    ]
    configValues.forEach(({ name, config }) => {
      t.test(`should not count logger metrics when ${name}`, (t) => {
        setup(config)
        const logger = winston.createLogger({
          transports: [
            new winston.transports.Stream({
              level: 'info',
              // We don't care about the output for this test, just
              // total lines logged
              stream: nullStream
            })
          ]
        })

        helper.runInTransaction(agent, 'winston-test', () => {
          logger.info('This is a log message test')

          // Close the stream so that the logging calls are complete
          nullStream.end()
          const linesMetric = agent.metrics.getMetric('Logging/lines')
          t.notOk(linesMetric, 'should not create Logging/lines metric')
          const levelMetric = agent.metrics.getMetric('Logging/lines/info')
          t.notOk(levelMetric, 'should not create Logging/lines/info metric')
          t.end()
        })
      })
    })
  })
})
