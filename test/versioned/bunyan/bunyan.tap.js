/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { removeMatchedModules } = require('../../lib/cache-buster')
require('../../lib/logging-helper')
const { LOGGING } = require('../../../lib/metrics/names')
const { makeSink, logStuff, originalMsgAssertion, logForwardingMsgAssertion } = require('./helpers')

tap.test('bunyan instrumentation', (t) => {
  t.autoend()

  let agent
  let bunyan

  function setup(config) {
    agent = helper.instrumentMockedAgent(config)
    agent.config.entity_guid = 'test-guid'
    bunyan = require('bunyan')
  }

  t.afterEach(() => {
    agent && helper.unloadAgent(agent)
    bunyan = null
    // must purge require cache of bunyan related instrumentation
    // to ensure it re-registers on subsequent test runs
    removeMatchedModules(/bunyan/)
  })

  t.test('logging disabled', (t) => {
    setup({ application_logging: { enabled: false } })
    const mockStream = makeSink()
    const logger = bunyan.createLogger({
      name: 'test-logger',
      stream: mockStream
    })

    logStuff({ logger, helper, agent })

    t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
    const metric = agent.metrics.getMetric(LOGGING.LIBS.BUNYAN)
    t.notOk(metric, `should not create ${LOGGING.LIBS.BUNYAN} metric when logging is disabled`)
    t.end()
  })

  t.test('logging enabled', (t) => {
    setup({ application_logging: { enabled: true } })
    bunyan.createLogger({ name: 'test-logger' })
    const metric = agent.metrics.getMetric(LOGGING.LIBS.BUNYAN)
    t.equal(metric.callCount, 1, 'should create external module metric')
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

    t.test('should not send logs to aggregator when only decorating and not forwarding', (t) => {
      // Example Bunyan setup to test
      const mockStream = makeSink()
      const logger = bunyan.createLogger({
        name: 'test-logger',
        stream: mockStream
      })

      logStuff({ logger, helper, agent })

      t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
      t.end()
    })

    t.test('should add the NR-LINKING metadata to the log message field', (t) => {
      // Example Bunyan setup to test
      const mockStream = makeSink()
      const logger = bunyan.createLogger({
        name: 'test-logger',
        stream: mockStream
      })

      logStuff({ logger, helper, agent })

      t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
      mockStream.logs.forEach((line) => {
        originalMsgAssertion({
          t,
          includeLocalDecorating: true,
          hostname: agent.config.getHostnameSafe(),
          logLine: JSON.parse(line)
        })
      })
      t.end()
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
      // Example Bunyan setup to test
      const mockStream = makeSink()
      const logger = bunyan.createLogger({
        name: 'test-logger',
        stream: mockStream
      })

      logStuff({ logger, helper, agent })

      const msgs = agent.logs.getEvents()
      t.equal(msgs.length, 2, 'should add both logs to aggregator')
      msgs.forEach((msg) => {
        logForwardingMsgAssertion(t, msg, agent)
      })

      mockStream.logs.forEach((logLine) => {
        originalMsgAssertion({
          t,
          logLine: JSON.parse(logLine),
          hostname: agent.config.getHostnameSafe()
        })
      })
      t.end()
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
      const err = new TestError(errorMsg)

      const mockStream = makeSink()
      const logger = bunyan.createLogger({
        name: 'test-logger',
        stream: mockStream
      })
      logger.error({ err })

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
  })

  t.test('metrics', (t) => {
    t.autoend()

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

      const mockStream = makeSink()
      const logger = bunyan.createLogger({
        name: 'test-logger',
        level: 'debug',
        stream: mockStream
      })

      helper.runInTransaction(agent, 'bunyan-test', () => {
        const logLevels = {
          debug: 20,
          info: 5,
          warn: 3,
          error: 2,
          fatal: 1
        }
        for (const [logLevel, maxCount] of Object.entries(logLevels)) {
          for (let count = 0; count < maxCount; count++) {
            const msg = `This is log message #${count} at ${logLevel} level`
            logger[logLevel](msg)
          }
        }

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
        const mockStream = makeSink()
        const logger = bunyan.createLogger({
          name: 'test-logger',
          stream: mockStream
        })

        helper.runInTransaction(agent, 'bunyan-test', () => {
          logger.info('This is a log message test')

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
