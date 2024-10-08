/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const { removeMatchedModules } = require('../../lib/cache-buster')
const { LOGGING } = require('../../../lib/metrics/names')
const { makeSink, logStuff, originalMsgAssertion, logForwardingMsgAssertion } = require('./helpers')

function setup(testContext, config) {
  testContext.agent = helper.instrumentMockedAgent(config)
  testContext.agent.config.entity_guid = 'test-guid'
  testContext.bunyan = require('bunyan')
}

test('logging enabled/disabled', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    // Must purge require cache of bunyan related instrumentation
    // to ensure it re-registers on subsequent test runs.
    removeMatchedModules(/bunyan/)
  })

  await t.test('logging disabled', (t) => {
    setup(t.nr, { application_logging: { enabled: false } })
    const { agent, bunyan } = t.nr
    const stream = makeSink()
    const logger = bunyan.createLogger({ name: 'test-logger', stream })

    logStuff({ logger, helper, agent })

    assert.deepEqual(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
    const metric = agent.metrics.getMetric(LOGGING.LIBS.BUNYAN)
    assert.equal(
      metric,
      undefined,
      `should not create ${LOGGING.LIBS.BUNYAN} metric when logging is disabled`
    )
  })

  await t.test('logging enabled', (t) => {
    setup(t.nr, { application_logging: { enabled: true } })
    const { agent, bunyan } = t.nr
    bunyan.createLogger({ name: 'test-logger' })
    const metric = agent.metrics.getMetric(LOGGING.LIBS.BUNYAN)
    assert.equal(metric.callCount, 1, 'should create external module metric')
  })
})

test('local log decorating', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    setup(ctx.nr, {
      application_logging: {
        enabled: true,
        local_decorating: { enabled: true },
        forwarding: { enabled: false },
        metrics: { enabled: false }
      }
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    // Must purge require cache of bunyan related instrumentation
    // to ensure it re-registers on subsequent test runs.
    removeMatchedModules(/bunyan/)
  })

  await t.test(
    'should not send logs to aggregator when only decorating and not forwarding',
    (t) => {
      const { agent, bunyan } = t.nr
      const stream = makeSink()
      const logger = bunyan.createLogger({ name: 'test-logger', stream })

      logStuff({ logger, helper, agent })

      assert.deepEqual(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
    }
  )

  await t.test('should add the NR-LINKING metadata to the log message field', (t) => {
    const { agent, bunyan } = t.nr
    const stream = makeSink()
    const logger = bunyan.createLogger({ name: 'test-logger', stream })

    logStuff({ logger, helper, agent })

    assert.deepEqual(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
    stream.logs.forEach((line) => {
      originalMsgAssertion({
        includeLocalDecorating: true,
        hostname: agent.config.getHostnameSafe(),
        logLine: JSON.parse(line)
      })
    })
  })
})

test('log forwarding enabled', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    setup(ctx.nr, {
      application_logging: {
        enabled: true,
        local_decorating: { enabled: false },
        forwarding: { enabled: true },
        metrics: { enabled: false }
      }
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    // Must purge require cache of bunyan related instrumentation
    // to ensure it re-registers on subsequent test runs.
    removeMatchedModules(/bunyan/)
  })

  await t.test('should add linking metadata to log aggregator', (t) => {
    const { agent, bunyan } = t.nr
    const stream = makeSink()
    const logger = bunyan.createLogger({ name: 'test-logger', stream })

    logStuff({ logger, helper, agent })

    const msgs = agent.logs.getEvents()
    assert.equal(msgs.length, 2, 'should add both logs to aggregator')
    msgs.forEach((msg) => {
      logForwardingMsgAssertion(msg, agent)
    })

    stream.logs.forEach((logLine) => {
      originalMsgAssertion({
        logLine: JSON.parse(logLine),
        hostname: agent.config.getHostnameSafe()
      })
    })
  })

  await t.test('should properly reformat errors on msgs to log aggregator', (t) => {
    const { agent, bunyan } = t.nr
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

    const stream = makeSink()
    const logger = bunyan.createLogger({ name: 'test-logger', stream })
    logger.error({ err })

    const msgs = agent.logs.getEvents()
    assert.equal(msgs.length, 1, 'should add error line to aggregator')
    const [msg] = msgs
    assert.equal(msg['error.message'], errorMsg, 'error.message should match')
    assert.equal(msg['error.class'], name, 'error.class should match')
    assert.ok(typeof msg['error.stack'] === 'string', 'error.stack should be a string')
    assert.equal(msg.stack, undefined, 'stack should be removed')
    assert.equal(msg.trace, undefined, 'trace should be removed')
  })
})

test('metrics enabled', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    setup(ctx.nr, {
      application_logging: {
        enabled: true,
        local_decorating: { enabled: false },
        forwarding: { enabled: false },
        metrics: { enabled: true }
      }
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    // Must purge require cache of bunyan related instrumentation
    // to ensure it re-registers on subsequent test runs.
    removeMatchedModules(/bunyan/)
  })

  await t.test('should count logger metrics', (t, end) => {
    const { agent, bunyan } = t.nr
    const stream = makeSink()
    const logger = bunyan.createLogger({ name: 'test-logger', level: 'debug', stream })

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

      const { agent, bunyan } = t.nr
      const stream = makeSink()
      const logger = bunyan.createLogger({ name: 'test-logger', stream })

      helper.runInTransaction(agent, 'bunyan-test', () => {
        logger.info('This is a log message test')

        const linesMetric = agent.metrics.getMetric(LOGGING.LINES)
        assert.equal(linesMetric, undefined, `should not create ${LOGGING.LINES} metric`)
        const levelMetric = agent.metrics.getMetric(LOGGING.LEVELS.INFO)
        assert.equal(levelMetric, undefined, `should not create ${LOGGING.LEVELS.INFO} metric`)

        end()
      })
    })
  }
})
