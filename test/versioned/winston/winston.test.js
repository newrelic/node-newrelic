/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { Writable } = require('node:stream')

const helper = require('../../lib/agent_helper')
const { match } = require('../../lib/custom-assertions')
const { removeMatchedModules } = require('../../lib/cache-buster')
const { LOGGING } = require('../../../lib/metrics/names')
const {
  makeStreamTest,
  logStuff,
  logWithAggregator,
  originalMsgAssertion,
  logForwardingMsgAssertion
} = require('./helpers')

// Winston puts the log line getting construct through formatters on a symbol
// which is exported from the `triple-beam` module.
const { MESSAGE } = require('triple-beam')
const concat = require('concat-stream')

function setup(testContext, config) {
  testContext.agent = helper.instrumentMockedAgent(config)
  testContext.agent.config.entity_guid = 'test-guid'
  testContext.winston = require('winston')
}

test.beforeEach((ctx) => {
  removeMatchedModules(/winston/)
  ctx.nr = {}

  /**
   * since our nr-winston-transport gets registered
   * with `opts.handleExceptions` we need to remove the listener
   * after every test so subsequent tests that actually throw
   * uncaughtExceptions only get the error and not every previous
   * instance of a logger
   */
  process.removeAllListeners(['uncaughtException'])
})

test.afterEach((ctx) => {
  if (ctx.nr.agent) {
    helper.unloadAgent(ctx.nr.agent)
  }
})

test('logging disabled', (t, end) => {
  setup(t.nr, { application_logging: { enabled: false } })
  const { agent, winston } = t.nr

  const handleMessages = makeStreamTest(() => {
    assert.deepEqual(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
    const metric = agent.metrics.getMetric(LOGGING.LIBS.WINSTON)
    assert.equal(
      metric,
      undefined,
      `should not create ${LOGGING.LIBS.WINSTON} metric when logging is disabled`
    )
    end()
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

test('logging enabled', (t) => {
  setup(t.nr, { application_logging: { enabled: true } })
  const { agent, winston } = t.nr

  // If we add two loggers, that counts as two instrumenations.
  winston.createLogger({})
  winston.loggers.add('local', {})

  const metric = agent.metrics.getMetric(LOGGING.LIBS.WINSTON)
  assert.equal(metric.callCount, 2, 'should create external module metric')
})

test('local log decorating', async (t) => {
  t.beforeEach((ctx) => {
    if (ctx.nr.agent) {
      helper.unloadAgent(ctx.nr.agent)
    }
    setup(ctx.nr, {
      application_logging: {
        enabled: true,
        local_decorating: { enabled: true },
        forwarding: { enabled: false },
        metrics: { enabled: false }
      }
    })
  })

  await t.test('should not add NR context to logs when decorating is enabled', (t, end) => {
    const { agent, winston } = t.nr
    const handleMessages = makeStreamTest(() => {
      assert.deepEqual(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
      end()
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

  await t.test('should not double log nor instrument composed logger', (t, end) => {
    const { agent, winston } = t.nr
    const handleMessages = makeStreamTest(() => {
      assert.deepEqual(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
      end()
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
  await t.test('should not affect the log line if formatter is not json', (t, end) => {
    const { agent, winston } = t.nr
    const handleMessages = makeStreamTest((msgs) => {
      assert.deepEqual(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
      msgs.forEach((msg) => {
        assert.match(
          msg[MESSAGE],
          /123 info: [in|out of]+ trans NR-LINKING|.*$/,
          'should add NR-LINKING data to formatted log line'
        )
      })
      end()
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

test('log forwarding enabled', async (t) => {
  t.beforeEach((ctx) => {
    if (ctx.nr.agent) {
      helper.unloadAgent(ctx.nr.agent)
    }
    setup(ctx.nr, {
      application_logging: {
        enabled: true,
        local_decorating: { enabled: false },
        forwarding: { enabled: true },
        metrics: { enabled: false }
      }
    })
  })

  await t.test('should add linking metadata to log aggregator', (t, end) => {
    const { agent, winston } = t.nr
    const handleMessages = makeStreamTest(() => {
      const msgs = agent.logs.getEvents()
      assert.equal(msgs.length, 2, 'should add both logs to aggregator')
      msgs.forEach((msg) => {
        logForwardingMsgAssertion(msg, agent)
        assert.ok(msg.original_timestamp, 'should put customer timestamp on original_timestamp')
      })
      end()
    })
    const assertFn = originalMsgAssertion.bind(null, { timestamp: true })
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

    logWithAggregator({ logger, stream: jsonStream, helper, agent })
  })

  await t.test('should add linking metadata when using `winston.loggers.add`', (t, end) => {
    const { agent, winston } = t.nr
    const handleMessages = makeStreamTest(() => {
      const msgs = agent.logs.getEvents()
      assert.equal(msgs.length, 2, 'should add both logs to aggregator')
      msgs.forEach((msg) => {
        logForwardingMsgAssertion(msg, agent)
        assert.ok(msg.original_timestamp, 'should put customer timestamp on original_timestamp')
      })
      end()
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

    logWithAggregator({ logger, stream: jsonStream, helper, agent })
  })

  await t.test('should add linking metadata when using logger.configure', (t, end) => {
    const { agent, winston } = t.nr
    const handleMessages = makeStreamTest(() => {
      const msgs = agent.logs.getEvents()
      assert.equal(msgs.length, 2, 'should add both logs to aggregator')
      msgs.forEach((msg) => {
        logForwardingMsgAssertion(msg, agent)
        assert.ok(msg.original_timestamp, 'should put customer timestamp on original_timestamp')
      })
      end()
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

    logWithAggregator({ logger, stream: jsonStream, helper, agent })
  })

  await t.test('should properly reformat errors on msgs to log aggregator', (t, end) => {
    const { agent, winston } = t.nr
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
      assert.equal(msgs.length, 1, 'should add error line to aggregator')
      const [msg] = msgs
      assert.equal(msg['error.message'], errorMsg, 'error.message should match')
      assert.equal(msg['error.class'], name, 'error.class should match')
      assert.ok(typeof msg['error.stack'] === 'string', 'error.stack should be a string')
      assert.equal(msg.stack, undefined, 'stack should be removed')
      assert.equal(msg.trace, undefined, 'trace should be removed')
      end()
    })

    const err = new TestError(errorMsg)

    const assertFn = originalMsgAssertion.bind(null, { level: 'error' })
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

  await t.test('should not double log nor instrument composed logger', (t, end) => {
    const { agent, winston } = t.nr
    const handleMessages = makeStreamTest(() => {
      const msgs = agent.logs.getEvents()
      assert.equal(msgs.length, 4, 'should add 4 logs(2 per logger) to log aggregator')
      msgs.forEach((msg) => {
        logForwardingMsgAssertion(msg, agent)
      })
      end()
    })

    const assertFn = originalMsgAssertion.bind(null, {})
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

    logWithAggregator({ loggers: [logger, subLogger], stream: simpleStream, helper, agent })
  })

  // See: https://github.com/newrelic/node-newrelic/issues/1196
  // This test adds a printf formatter and then asserts that both the log lines
  // in aggregator have keys added in other formatters and that the log line being built
  // is is in printf format
  await t.test('should not affect the log line if formatter is not json', (t, end) => {
    const { agent, winston } = t.nr
    const handleMessages = makeStreamTest((msgs) => {
      const events = agent.logs.getEvents()
      events.forEach((event) => {
        logForwardingMsgAssertion(t, event, agent)
        assert.equal(
          event.label,
          '123',
          'should include keys added in other formatters to log line in aggregator'
        )
      })
      msgs.forEach((msg) => {
        assert.match(
          msg[MESSAGE],
          /123 info: [in|out of]+ trans$/,
          'should not affect original log line'
        )
      })
      end()
    })

    const assertFn = originalMsgAssertion.bind(null, {})
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

    logWithAggregator({ loggers: [logger], stream: jsonStream, helper, agent })
  })

  await t.test('w/o options', (t, end) => {
    const { agent, winston } = t.nr
    const handleMessages = makeStreamTest(() => {
      const msgs = agent.logs.getEvents()
      assert.equal(msgs.length, 2, 'should add both logs to aggregator')
      msgs.forEach((msg) => {
        logForwardingMsgAssertion(msg, agent)
      })
      end()
    })

    const logger = winston.createLogger()

    const assertFn = originalMsgAssertion.bind(null, {})
    const jsonStream = concat(handleMessages(assertFn))

    logStuff({ loggers: [logger], stream: jsonStream, helper, agent })
  })
})

test('metrics', async (t) => {
  t.beforeEach((ctx) => {
    if (ctx.nr.agent) {
      helper.unloadAgent(ctx.nr.agent)
    }
    setup(ctx.nr, {
      application_logging: {
        enabled: true,
        local_decorating: { enabled: false },
        forwarding: { enabled: false },
        metrics: { enabled: true }
      }
    })

    ctx.nr.nullStream = new Writable({
      write(chunk, encoding, cb) {
        cb()
      }
    })
  })

  await t.test('should log unknown for custom log levels', (t, end) => {
    const { agent, winston, nullStream } = t.nr
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
      assert.ok(metric, 'info log metric exists')
      assert.equal(metric.callCount, 1, 'info log count is 1')
      const unknownMetric = agent.metrics.getMetric(LOGGING.LEVELS.UNKNOWN)
      assert.ok(unknownMetric, 'unknown log metric exists')
      assert.equal(unknownMetric.callCount, 1, 'custom log count is 1')
      const linesMetric = agent.metrics.getMetric(LOGGING.LINES)
      assert.ok(linesMetric, 'logging lines metric should exist')
      assert.equal(
        linesMetric.callCount,
        2,
        'should count both info level and custom level in logging/lines metric'
      )
      end()
    })
  })

  const countMetricsTests = {
    'winston.createLogger': (winston, opts) => winston.createLogger(opts),
    'winston.loggers.add': (winston, opts) => winston.loggers.add('local', opts)
  }
  for (const [createLoggerName, createLogger] of Object.entries(countMetricsTests)) {
    await t.test(`should count logger metrics for '${createLoggerName}'`, (t, end) => {
      const { agent, winston, nullStream } = t.nr

      const logger = createLogger(winston, {
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
          assert.ok(metric, `ensure ${metricName} exists`)
          assert.equal(metric.callCount, maxCount, `ensure ${metricName} has the right value`)
        }
        const metricName = LOGGING.LINES
        const metric = agent.metrics.getMetric(metricName)
        assert.ok(metric, `ensure ${metricName} exists`)
        assert.equal(metric.callCount, grandTotal, `ensure ${metricName} has the right value`)

        end()
      })
    })
  }

  await t.test(`should count logger metrics for logger.configure`, (t, end) => {
    const { agent, winston, nullStream } = t.nr

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
        assert.ok(metric, `ensure ${metricName} exists`)
        assert.equal(metric.callCount, maxCount, `ensure ${metricName} has the right value`)
      }
      const metricName = LOGGING.LINES
      const metric = agent.metrics.getMetric(metricName)
      assert.ok(metric, `ensure ${metricName} exists`)
      assert.equal(metric.callCount, grandTotal, `ensure ${metricName} has the right value`)

      end()
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
  for (const { name, config } of configValues) {
    await t.test(`should not count logger metrics when ${name}`, (t, end) => {
      if (t.nr.agent) {
        helper.unloadAgent(t.nr.agent)
      }
      setup(t.nr, config)

      const { agent, winston, nullStream } = t.nr
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
        assert.equal(linesMetric, undefined, `should not create ${LOGGING.LINES} metric`)
        const levelMetric = agent.metrics.getMetric(LOGGING.LEVELS.INFO)
        assert.equal(levelMetric, undefined, `should not create ${LOGGING.LEVELS.INFO} metric`)

        end()
      })
    })
  }
})
