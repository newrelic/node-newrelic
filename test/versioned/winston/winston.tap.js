/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { removeMatchedModules } = require('../../lib/cache-buster')
const concat = require('concat-stream')
require('../../lib/logging-helper')
const { Writable } = require('stream')
const { LOGGING } = require('../../../lib/metrics/names')
// winston puts the log line getting construct through formatters on a symbol
// which is exported from this module
const { MESSAGE } = require('triple-beam')
const {
  makeStreamTest,
  logStuff,
  logWithAggregator,
  originalMsgAssertion,
  logForwardingMsgAssertion
} = require('./helpers')

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
    removeMatchedModules(/winston/)

    /**
     * since our nr-winston-transport gets registered
     * with `opts.handleExceptions` we need to remove the listener
     * after every test so subsequent tests that actually throw
     * uncaughtExceptions only get the error and not every previous
     * instance of a logger
     */
    process.removeAllListeners(['uncaughtException'])
  })

  t.test('logging disabled', (t) => {
    setup({ application_logging: { enabled: false } })

    const handleMessages = makeStreamTest(() => {
      t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
      const metric = agent.metrics.getMetric(LOGGING.LIBS.WINSTON)
      t.notOk(metric, `should not create ${LOGGING.LIBS.WINSTON} metric when logging is disabled`)
      t.end()
    })
    const assertFn = originalMsgAssertion.bind(null, { t })
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

    logStuff({ logger, stream: jsonStream, helper, agent })
  })

  t.test('logging enabled', (t) => {
    setup({ application_logging: { enabled: true } })

    // If we add two loggers, that counts as two instrumenations.
    winston.createLogger({})
    winston.loggers.add('local', {})

    const metric = agent.metrics.getMetric(LOGGING.LIBS.WINSTON)
    t.equal(metric.callCount, 2, 'should create external module metric')
    t.end()
  })

  t.test('local log decorating', (t) => {
    t.autoend()

    t.beforeEach(() => {
      setup({
        application_logging: {
          enabled: true,
          local_decorating: { enabled: true },
          forwarding: { enabled: false },
          metrics: { enabled: false }
        }
      })
    })

    t.test('should not add NR context to logs when decorating is enabled', (t) => {
      const handleMessages = makeStreamTest(() => {
        t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
        t.end()
      })

      const assertFn = originalMsgAssertion.bind(null, { t, includeLocalDecorating: true })
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

      logStuff({ logger, stream: jsonStream, helper, agent })
    })

    t.test('should not double log nor instrument composed logger', (t) => {
      const handleMessages = makeStreamTest(() => {
        t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
        t.end()
      })

      const assertFn = originalMsgAssertion.bind(null, { t, includeLocalDecorating: true })
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

      logStuff({ loggers: [logger, subLogger], stream: jsonStream, helper, agent })
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

      const assertFn = originalMsgAssertion.bind(null, { t, includeLocalDecorating: true })
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

      logStuff({ loggers: [logger], stream: jsonStream, helper, agent })
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
          },
          local_decorating: {
            enabled: false
          },
          metrics: {
            enabled: false
          }
        }
      })
    })

    t.test('should add linking metadata to log aggregator', (t) => {
      const handleMessages = makeStreamTest(() => {
        const msgs = agent.logs.getEvents()
        t.equal(msgs.length, 2, 'should add both logs to aggregator')
        msgs.forEach((msg) => {
          logForwardingMsgAssertion(t, msg, agent)
          t.ok(msg.original_timestamp, 'should put customer timestamp on original_timestamp')
        })
        t.end()
      })
      const assertFn = originalMsgAssertion.bind(null, { t, timestamp: true })
      const jsonStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.createLogger({
        format: winston.format.timestamp('YYYY-MM-DD HH:mm:ss'),
        transports: [
          // Log to a stream so we can test the output
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          })
        ]
      })

      logWithAggregator({ logger, stream: jsonStream, t, helper, agent })
    })

    t.test('should add linking metadata when using `winston.loggers.add`', (t) => {
      const handleMessages = makeStreamTest(() => {
        const msgs = agent.logs.getEvents()
        t.equal(msgs.length, 2, 'should add both logs to aggregator')
        msgs.forEach((msg) => {
          logForwardingMsgAssertion(t, msg, agent)
          t.ok(msg.original_timestamp, 'should put customer timestamp on original_timestamp')
        })
        t.end()
      })
      const assertFn = originalMsgAssertion.bind(null, { t, timestamp: true })
      const jsonStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      const logger = winston.loggers.add('local', {
        format: winston.format.timestamp('YYYY-MM-DD HH:mm:ss'),
        transports: [
          // Log to a stream so we can test the output
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          })
        ]
      })

      logWithAggregator({ logger, stream: jsonStream, t, helper, agent })
    })

    t.test('should add linking metadata when using logger.configure', (t) => {
      const handleMessages = makeStreamTest(() => {
        const msgs = agent.logs.getEvents()
        t.equal(msgs.length, 2, 'should add both logs to aggregator')
        msgs.forEach((msg) => {
          logForwardingMsgAssertion(t, msg, agent)
          t.ok(msg.original_timestamp, 'should put customer timestamp on original_timestamp')
        })
        t.end()
      })
      const assertFn = originalMsgAssertion.bind(null, { t, timestamp: true })
      const jsonStream = concat(handleMessages(assertFn))
      // Example Winston setup to test
      const logger = winston.createLogger()
      logger.configure({
        format: winston.format.timestamp('YYYY-MM-DD HH:mm:ss'),
        transports: [
          // Log to a stream so we can test the output
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          })
        ]
      })

      logWithAggregator({ logger, stream: jsonStream, t, helper, agent })
    })

    t.test('should properly reformat errors on msgs to log aggregator', (t) => {
      const name = 'TestError'
      const errorMsg = 'throw uncaught exception test'
      // Simulate an error being thrown to trigger Winston's error handling
      class TestError extends Error {
        constructor(msg) {
          super(msg)
          this.name = name
        }
      }

      const handleMessages = makeStreamTest(() => {
        const msgs = agent.logs.getEvents()
        t.equal(msgs.length, 1, 'should add error line to aggregator')
        const [msg] = msgs
        t.equal(msg['error.message'], errorMsg, 'error.message should match')
        t.equal(msg['error.class'], name, 'error.class should match')
        t.ok(typeof msg['error.stack'] === 'string', 'error.stack should be a string')
        t.notOk(msg.stack, 'stack should be removed')
        t.notOk(msg.trace, 'trace should be removed')
        t.end()
      })

      const err = new TestError(errorMsg)

      const assertFn = originalMsgAssertion.bind(null, { t, level: 'error' })
      const jsonStream = concat(handleMessages(assertFn))

      // Example Winston setup to test
      winston.createLogger({
        transports: [
          // Log to a stream so we can test the output
          new winston.transports.Stream({
            level: 'info',
            stream: jsonStream
          })
        ],
        exitOnError: false
      })

      process.emit('uncaughtException', err)
      jsonStream.end()
    })

    t.test('should not double log nor instrument composed logger', (t) => {
      const handleMessages = makeStreamTest(() => {
        const msgs = agent.logs.getEvents()
        t.equal(msgs.length, 4, 'should add 4 logs(2 per logger) to log aggregator')
        msgs.forEach((msg) => {
          logForwardingMsgAssertion(t, msg, agent)
        })
        t.end()
      })

      const assertFn = originalMsgAssertion.bind(null, { t })
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

      logWithAggregator({ loggers: [logger, subLogger], stream: simpleStream, t, helper, agent })
    })

    // See: https://github.com/newrelic/node-newrelic/issues/1196
    // This test adds a printf formatter and then asserts that both the log lines
    // in aggregator have keys added in other formatters and that the log line being built
    // is is in printf format
    t.test('should not affect the log line if formatter is not json', (t) => {
      const handleMessages = makeStreamTest((msgs) => {
        const events = agent.logs.getEvents()
        events.forEach((event) => {
          logForwardingMsgAssertion(t, event, agent)
          t.equal(
            event.label,
            '123',
            'should include keys added in other formatters to log line in aggregator'
          )
        })
        msgs.forEach((msg) => {
          t.match(
            msg[MESSAGE],
            /123 info: [in|out of]+ trans$/,
            'should not affect original log line'
          )
        })
        t.end()
      })

      const assertFn = originalMsgAssertion.bind(null, { t })
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

      logWithAggregator({ loggers: [logger], stream: jsonStream, t, helper, agent })
    })

    t.test('w/o options', (t) => {
      const handleMessages = makeStreamTest(() => {
        const msgs = agent.logs.getEvents()
        t.equal(msgs.length, 2, 'should add both logs to aggregator')
        msgs.forEach((msg) => {
          logForwardingMsgAssertion(t, msg, agent)
        })
        t.end()
      })

      const logger = winston.createLogger()

      const assertFn = originalMsgAssertion.bind(null, { t })
      const jsonStream = concat(handleMessages(assertFn))

      logStuff({ loggers: [logger], stream: jsonStream, helper, agent })
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

    t.test('should log unknown for custom log levels', (t) => {
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

      const levels = { info: 0, custom: 1 }
      const customLevelLogger = winston.createLogger({
        levels,
        transports: [
          new winston.transports.Stream({
            level: 'custom',
            stream: nullStream
          })
        ]
      })
      helper.runInTransaction(agent, 'custom-log-test', () => {
        customLevelLogger.info('info log')
        customLevelLogger.custom('custom log')
        nullStream.end()
        const metric = agent.metrics.getMetric(LOGGING.LEVELS.INFO)
        t.ok(metric, 'info log metric exists')
        t.equal(metric.callCount, 1, 'info log count is 1')
        const unknownMetric = agent.metrics.getMetric(LOGGING.LEVELS.UNKNOWN)
        t.ok(unknownMetric, 'unknown log metric exists')
        t.equal(unknownMetric.callCount, 1, 'custom log count is 1')
        const linesMetric = agent.metrics.getMetric(LOGGING.LINES)
        t.ok(linesMetric, 'logging lines metric should exist')
        t.equal(
          linesMetric.callCount,
          2,
          'should count both info level and custom level in logging/lines metric'
        )
        t.end()
      })
    })

    for (const [createLoggerName, createLogger] of Object.entries({
      'winston.createLogger': (opts) => winston.createLogger(opts),
      'winston.loggers.add': (opts) => winston.loggers.add('local', opts)
    })) {
      t.test(`should count logger metrics for '${createLoggerName}'`, (t) => {
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

        const logger = createLogger({
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
            const metricName = LOGGING.LEVELS[logLevel.toUpperCase()]
            const metric = agent.metrics.getMetric(metricName)
            t.ok(metric, `ensure ${metricName} exists`)
            t.equal(metric.callCount, maxCount, `ensure ${metricName} has the right value`)
          }
          const metricName = LOGGING.LINES
          const metric = agent.metrics.getMetric(metricName)
          t.ok(metric, `ensure ${metricName} exists`)
          t.equal(metric.callCount, grandTotal, `ensure ${metricName} has the right value`)
          t.end()
        })
      })
    }

    t.test(`should count logger metrics for logger.configure`, (t) => {
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

      const logger = winston.createLogger()
      logger.configure({
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
          const metricName = LOGGING.LEVELS[logLevel.toUpperCase()]
          const metric = agent.metrics.getMetric(metricName)
          t.ok(metric, `ensure ${metricName} exists`)
          t.equal(metric.callCount, maxCount, `ensure ${metricName} has the right value`)
        }
        const metricName = LOGGING.LINES
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
          const linesMetric = agent.metrics.getMetric(LOGGING.LINES)
          t.notOk(linesMetric, `should not create ${LOGGING.LINES} metric`)
          const levelMetric = agent.metrics.getMetric(LOGGING.LEVELS.INFO)
          t.notOk(levelMetric, `should not create ${LOGGING.LEVELS.INFO} metric`)
          t.end()
        })
      })
    })
  })
})
