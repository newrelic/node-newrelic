/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const split = require('split2')
const semver = require('semver')

const { sink, once } = require('pino/test/helper')
const { truncate } = require('../../../lib/util/application-logging')
const helper = require('../../lib/agent_helper')
const { removeMatchedModules } = require('../../lib/cache-buster')
const { LOGGING } = require('../../../lib/metrics/names')
const { originalMsgAssertion } = require('./helpers')
const { validateLogLine, validateCommonAttrs } = require('../../lib/logging-helper')

const { version: pinoVersion } = require('pino/package')

function setup(testContext, config) {
  testContext.agent = helper.instrumentMockedAgent(config)
  testContext.agent.config.entity_guid = 'test-guid'
  testContext.pino = require('pino')
  testContext.stream = sink()
  testContext.logger = testContext.pino({ level: 'debug' }, testContext.stream)
  testContext.config = testContext.agent.config
}

test.beforeEach((ctx) => {
  removeMatchedModules(/pino/)
  ctx.nr = {}
})

test.afterEach((ctx) => {
  if (ctx.nr.agent) {
    helper.unloadAgent(ctx.nr.agent)
  }
})

test('logging disabled', async (t) => {
  setup(t.nr, { application_logging: { enabled: false } })
  const { agent, pino, stream } = t.nr

  const disabledLogger = pino({ level: 'info' }, stream)
  const message = 'logs are not enriched'
  disabledLogger.info(message)
  const line = await once(stream, 'data')
  originalMsgAssertion({
    logLine: line,
    hostname: agent.config.getHostnameSafe()
  })
  assert.equal(line.msg, message, 'msg should not change')
  const metric = agent.metrics.getMetric(LOGGING.LIBS.PINO)
  assert.equal(
    metric,
    undefined,
    `should not create ${LOGGING.LIBS.PINO} metric when logging is disabled`
  )
})

test('logging enabled', (t) => {
  setup(t.nr, { application_logging: { enabled: true } })
  const { agent } = t.nr
  const metric = agent.metrics.getMetric(LOGGING.LIBS.PINO)
  assert.equal(metric.callCount, 1, `should create ${LOGGING.LIBS.PINO} metric`)
})

test('local_decorating', (t, end) => {
  setup(t.nr, {
    application_logging: {
      enabled: true,
      local_decorating: { enabled: true },
      forwarding: { enabled: false },
      metrics: { enabled: false }
    }
  })
  const { agent, logger, stream } = t.nr
  const message = 'pino decorating test'
  helper.runInTransaction(agent, 'pino-test', async () => {
    logger.info(message)
    let line = await once(stream, 'data')
    originalMsgAssertion({
      includeLocalDecorating: true,
      hostname: agent.config.getHostnameSafe(),
      logLine: line
    })
    assert.deepEqual(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')

    // Verify that merging object only logs get decorated:
    logger.info({ msg: message })
    line = await once(stream, 'data')
    assert.equal(line.msg.startsWith(`${message} NR-LINKING|test-guid`), true)
    originalMsgAssertion({
      includeLocalDecorating: true,
      hostname: agent.config.getHostnameSafe(),
      logLine: line
    })
    assert.deepEqual(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')

    end()
  })
})

test('forwarding', async (t) => {
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

  await t.test('should have proper metadata outside of a transaction', async (t) => {
    const { agent, config, logger, stream } = t.nr
    const message = 'pino unit test'
    const level = 'info'
    logger[level](message)
    const line = await once(stream, 'data')
    originalMsgAssertion({
      hostname: agent.config.getHostnameSafe(),
      logLine: line
    })
    assert.equal(agent.logs.getEvents().length, 1, 'should have 1 log in aggregator')
    const formattedLine = agent.logs.getEvents()[0]()
    const [payload] = agent.logs._toPayloadSync()
    const commonAttrs = payload.common.attributes
    validateCommonAttrs({ commonAttrs, config })
    validateLogLine({ line: formattedLine, message, level, config })
  })

  await t.test('should not crash nor enqueue log line when invalid json', async (t) => {
    const { agent, config, pino } = t.nr
    // When you log an object that will be the first arg to the logger level
    // the 2nd arg is the message
    const message = { 'pino "unit test': 'prop' }
    const testMsg = 'this is a test'
    const level = 'info'
    const localStream = split((data) => data)
    const logger = pino({ level: 'debug' }, localStream)
    logger[level](message, testMsg)
    await once(localStream, 'data')
    assert.equal(agent.logs.getEvents().length, 1, 'should have 1 logs in aggregator')
    // We added this test when this was broken but has since been fixed in 8.15.1
    // See: https://github.com/pinojs/pino/pull/1779/files
    if (semver.gte(pinoVersion, '8.15.1')) {
      const formattedLine = agent.logs.getEvents()[0]()
      const [payload] = agent.logs._toPayloadSync()
      const commonAttrs = payload.common.attributes
      validateCommonAttrs({ commonAttrs, config })
      validateLogLine({ line: formattedLine, message: testMsg, level, config })
    } else {
      assert.equal(
        agent.logs.getEvents()[0](),
        undefined,
        'should not return a log line if invalid'
      )
      assert.equal(agent.logs._toPayloadSync(), undefined, 'should not send any logs')
    }
  })

  await t.test('should have proper error keys when error is present', async (t) => {
    const { agent, config, logger, stream } = t.nr
    const err = new Error('This is a test')
    const level = 'error'
    logger[level](err)
    const line = await once(stream, 'data')
    originalMsgAssertion({
      hostname: agent.config.getHostnameSafe(),
      logLine: line,
      level: 50
    })
    assert.equal(agent.logs.getEvents().length, 1, 'should have 1 log in aggregator')
    const formattedLine = agent.logs.getEvents()[0]()
    validateLogLine({
      line: formattedLine,
      message: err.message,
      level,
      config
    })
    const [payload] = agent.logs._toPayloadSync()
    const commonAttrs = payload.common.attributes
    validateCommonAttrs({ commonAttrs, config })
    assert.equal(formattedLine['error.class'], 'Error', 'should have Error as error.class')
    assert.equal(formattedLine['error.message'], err.message, 'should have proper error.message')
    assert.equal(
      formattedLine['error.stack'],
      truncate(err.stack),
      'should have proper error.stack'
    )
    assert.equal(formattedLine.err, undefined, 'should not have err key')
  })

  await t.test('should add proper trace info in transaction', (t, end) => {
    const { agent, config, logger, stream } = t.nr
    helper.runInTransaction(agent, 'pino-test', async (tx) => {
      const level = 'info'
      const message = 'My debug test'
      logger[level](message)
      const meta = agent.getLinkingMetadata()
      const line = await once(stream, 'data')
      originalMsgAssertion({
        hostname: agent.config.getHostnameSafe(),
        logLine: line
      })
      assert.equal(
        agent.logs.getEvents().length,
        0,
        'should have not have log in aggregator while transaction is active'
      )
      tx.end()
      assert.equal(
        agent.logs.getEvents().length,
        1,
        'should have log in aggregator after transaction ends'
      )

      const formattedLine = agent.logs.getEvents()[0]()
      validateLogLine({ line: formattedLine, message, level, config })
      const [payload] = agent.logs._toPayloadSync()
      const commonAttrs = payload.common.attributes
      validateCommonAttrs({ commonAttrs, config })
      assert.equal(formattedLine['trace.id'], meta['trace.id'])
      assert.equal(formattedLine['span.id'], meta['span.id'])

      end()
    })
  })

  await t.test(
    'should assign hostname from NR linking metadata when not defined as a core chinding',
    async (t) => {
      const { agent, config, pino } = t.nr
      const localStream = sink()
      const localLogger = pino({ base: undefined }, localStream)
      const message = 'pino unit test'
      const level = 'info'
      localLogger[level](message)
      const line = await once(localStream, 'data')
      assert.equal(line.pid, undefined, 'should not have pid when overriding base chindings')
      assert.equal(
        line.hostname,
        undefined,
        'should not have hostname when overriding base chindings'
      )
      assert.equal(agent.logs.getEvents().length, 1, 'should have 1 log in aggregator')
      const formattedLine = agent.logs.getEvents()[0]()
      validateLogLine({ line: formattedLine, message, level, config })
    }
  )

  await t.test('should properly handle child loggers', (t, end) => {
    const { agent, config, logger, stream } = t.nr
    const childLogger = logger.child({ module: 'child' })
    helper.runInTransaction(agent, 'pino-test', async (tx) => {
      // these are defined in opposite order because the log aggregator is LIFO
      const messages = ['this is a child message', 'my parent logger message']
      const level = 'info'
      logger[level](messages[1])
      const meta = agent.getLinkingMetadata()
      const line = await once(stream, 'data')
      originalMsgAssertion({
        hostname: agent.config.getHostnameSafe(),
        logLine: line
      })
      childLogger[level](messages[0])
      const childLine = await once(stream, 'data')
      originalMsgAssertion({
        hostname: agent.config.getHostnameSafe(),
        logLine: childLine
      })
      assert.equal(
        agent.logs.getEvents().length,
        0,
        'should have not have log in aggregator while transaction is active'
      )
      tx.end()
      assert.equal(
        agent.logs.getEvents().length,
        2,
        'should have log in aggregator after transaction ends'
      )

      agent.logs.getEvents().forEach((logLine, index) => {
        const formattedLine = logLine()
        validateLogLine({
          line: formattedLine,
          message: messages[index],
          level,
          config
        })
        assert.equal(
          formattedLine['trace.id'],
          meta['trace.id'],
          'should be expected trace.id value'
        )
        assert.equal(formattedLine['span.id'], meta['span.id'], 'should be expected span.id value')
      })
      const [payload] = agent.logs._toPayloadSync()
      const commonAttrs = payload.common.attributes
      validateCommonAttrs({ commonAttrs, config })

      end()
    })
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
    ctx.nr.config = ctx.nr.agent.config
  })

  await t.test('should count logger metrics', (t, end) => {
    const { agent, pino, stream } = t.nr
    const pinoLogger = pino(
      {
        level: 'debug',
        customLevels: {
          http: 35
        }
      },
      stream
    )

    helper.runInTransaction(agent, 'pino-test', async () => {
      const logLevels = {
        debug: 20,
        http: 4, // this one is a custom level
        info: 5,
        warn: 3,
        error: 2
      }
      for (const [logLevel, maxCount] of Object.entries(logLevels)) {
        for (let count = 0; count < maxCount; count++) {
          const msg = `This is log message #${count} at ${logLevel} level`
          pinoLogger[logLevel](msg)
        }
      }
      await once(stream, 'data')

      let grandTotal = 0
      for (const [logLevel, maxCount] of Object.entries(logLevels)) {
        grandTotal += maxCount
        const metricName = LOGGING.LEVELS[logLevel.toUpperCase()] || LOGGING.LEVELS.UNKNOWN
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
      config: {
        application_logging: {
          enabled: false,
          metrics: { enabled: true },
          forwarding: { enabled: false },
          local_decorating: { enabled: false }
        }
      }
    },
    {
      name: 'application_logging.metrics is not enabled',
      config: {
        application_logging: {
          enabled: true,
          metrics: { enabled: false },
          forwarding: { enabled: false },
          local_decorating: { enabled: false }
        }
      }
    }
  ]
  for (const { name, config } of configValues) {
    await t.test(`should not count logger metrics when ${name}`, (t, end) => {
      if (t.nr.agent) {
        helper.unloadAgent(t.nr.agent)
      }
      setup(t.nr, config)

      const { agent, logger, stream } = t.nr
      helper.runInTransaction(agent, 'pino-test', async () => {
        logger.info('This is a log message test')
        await once(stream, 'data')

        const linesMetric = agent.metrics.getMetric(LOGGING.LINES)
        assert.equal(linesMetric, undefined, `should not create ${LOGGING.LINES} metric`)
        const levelMetric = agent.metrics.getMetric(LOGGING.LEVELS.INFO)
        assert.equal(levelMetric, undefined, `should not create ${LOGGING.LEVELS.INFO} metric`)

        end()
      })
    })
  }
})

test('should honor msg key in merging object (issue 2410)', async (t) => {
  setup(t.nr, { application_logging: { enabled: true } })

  const { agent, config, pino } = t.nr
  const localStream = sink()
  const localLogger = pino({ base: undefined }, localStream)
  const message = 'pino unit test'
  const level = 'info'
  localLogger[level]({ msg: message })
  await once(localStream, 'data')
  assert.equal(agent.logs.getEvents().length, 1, 'should have 1 log in aggregator')
  const formattedLine = agent.logs.getEvents()[0]()
  validateLogLine({ line: formattedLine, message, level, config })
})
