/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const { sink, once } = require('pino/test/helper')
const split = require('split2')
const { truncate } = require('../../../lib/util/application-logging')
const helper = require('../../lib/agent_helper')
const { removeMatchedModules } = require('../../lib/cache-buster')
const { LOGGING } = require('../../../lib/metrics/names')
const { originalMsgAssertion } = require('./helpers')
const semver = require('semver')
const { version: pinoVersion } = require('pino/package')
require('../../lib/logging-helper')

tap.test('Pino instrumentation', (t) => {
  t.autoend()

  function setupAgent(context, config) {
    context.agent = helper.instrumentMockedAgent(config)
    context.agent.config.entity_guid = 'test-guid'
    context.pino = require('pino')
    context.stream = sink()
    context.logger = context.pino({ level: 'debug' }, context.stream)
    return context.agent.config
  }

  t.beforeEach(async (t) => {
    removeMatchedModules(/pino/)

    t.context.pino = null
    t.context.agent = null
    t.context.stream = null
    t.context.logger = null
  })

  t.afterEach((t) => {
    if (t.context.agent) {
      helper.unloadAgent(t.context.agent)
    }
  })

  t.test('logging disabled', async (t) => {
    setupAgent(t.context, { application_logging: { enabled: false } })
    const { agent, pino, stream } = t.context
    const disabledLogger = pino({ level: 'info' }, stream)
    const message = 'logs are not enriched'
    disabledLogger.info(message)
    const line = await once(stream, 'data')
    originalMsgAssertion({
      t,
      logLine: line,
      hostname: agent.config.getHostnameSafe()
    })
    t.equal(line.msg, message, 'msg should not change')
    const metric = agent.metrics.getMetric(LOGGING.LIBS.PINO)
    t.notOk(metric, `should not create ${LOGGING.LIBS.PINO} metric when logging is disabled`)
    t.end()
  })

  t.test('logging enabled', (t) => {
    setupAgent(t.context, { application_logging: { enabled: true } })
    const { agent } = t.context
    const metric = agent.metrics.getMetric(LOGGING.LIBS.PINO)
    t.equal(metric.callCount, 1, `should create ${LOGGING.LIBS.PINO} metric`)
    t.end()
  })

  t.test('local_decorating', (t) => {
    setupAgent(t.context, {
      application_logging: {
        enabled: true,
        local_decorating: { enabled: true },
        forwarding: { enabled: false },
        metrics: { enabled: false }
      }
    })
    const { agent, logger, stream } = t.context
    const message = 'pino decorating test'
    helper.runInTransaction(agent, 'pino-test', async () => {
      logger.info(message)
      const line = await once(stream, 'data')
      originalMsgAssertion({
        t,
        includeLocalDecorating: true,
        hostname: agent.config.getHostnameSafe(),
        logLine: line
      })
      t.same(agent.logs.getEvents(), [], 'should not add any logs to log aggregator')
      t.end()
    })
  })

  t.test('forwarding', (t) => {
    t.autoend()
    t.beforeEach((t) => {
      t.context.config = setupAgent(t.context, {
        application_logging: {
          enabled: true,
          local_decorating: { enabled: false },
          forwarding: { enabled: true },
          metrics: { enabled: false }
        }
      })
    })

    t.test('should have proper metadata outside of a transaction', async (t) => {
      const { agent, config, logger, stream } = t.context
      const message = 'pino unit test'
      const level = 'info'
      logger[level](message)
      const line = await once(stream, 'data')
      originalMsgAssertion({
        t,
        hostname: agent.config.getHostnameSafe(),
        logLine: line
      })
      t.equal(agent.logs.getEvents().length, 1, 'should have 1 log in aggregator')
      const formattedLine = agent.logs.getEvents()[0]()
      t.validateAnnotations({ line: formattedLine, message, level, config })
      t.end()
    })

    t.test('should not crash nor enqueue log line when invalid json', async (t) => {
      const { agent, config, pino } = t.context
      // When you log an object that will be the first arg to the logger level
      // the 2nd arg is the message
      const message = { 'pino "unit test': 'prop' }
      const testMsg = 'this is a test'
      const level = 'info'
      const localStream = split((data) => data)
      const logger = pino({ level: 'debug' }, localStream)
      logger[level](message, testMsg)
      await once(localStream, 'data')
      t.equal(agent.logs.getEvents().length, 1, 'should have 1 logs in aggregator')
      // We added this test when this was broken but has since been fixed in 8.15.1
      // See: https://github.com/pinojs/pino/pull/1779/files
      if (semver.gte(pinoVersion, '8.15.1')) {
        const formattedLine = agent.logs.getEvents()[0]()
        t.validateAnnotations({ line: formattedLine, message: testMsg, level, config })
      } else {
        t.notOk(agent.logs.getEvents()[0](), 'should not return a log line if invalid')
        t.notOk(agent.logs._toPayloadSync(), 'should not send any logs')
      }
      t.end()
    })

    t.test('should have proper error keys when error is present', async (t) => {
      const { agent, config, logger, stream } = t.context
      const err = new Error('This is a test')
      const level = 'error'
      logger[level](err)
      const line = await once(stream, 'data')
      originalMsgAssertion({
        t,
        hostname: agent.config.getHostnameSafe(),
        logLine: line,
        level: 50
      })
      t.equal(agent.logs.getEvents().length, 1, 'should have 1 log in aggregator')
      const formattedLine = agent.logs.getEvents()[0]()
      t.validateAnnotations({
        line: formattedLine,
        message: err.message,
        level,
        config
      })
      t.equal(formattedLine['error.class'], 'Error', 'should have Error as error.class')
      t.equal(formattedLine['error.message'], err.message, 'should have proper error.message')
      t.equal(formattedLine['error.stack'], truncate(err.stack), 'should have proper error.stack')
      t.notOk(formattedLine.err, 'should not have err key')
      t.end()
    })

    t.test('should add proper trace info in transaction', (t) => {
      const { agent, config, logger, stream } = t.context
      helper.runInTransaction(agent, 'pino-test', async (tx) => {
        const level = 'info'
        const message = 'My debug test'
        logger[level](message)
        const meta = agent.getLinkingMetadata()
        const line = await once(stream, 'data')
        originalMsgAssertion({
          t,
          hostname: agent.config.getHostnameSafe(),
          logLine: line
        })
        t.equal(
          agent.logs.getEvents().length,
          0,
          'should have not have log in aggregator while transaction is active'
        )
        tx.end()
        t.equal(
          agent.logs.getEvents().length,
          1,
          'should have log in aggregator after transaction ends'
        )

        const formattedLine = agent.logs.getEvents()[0]()
        t.validateAnnotations({ line: formattedLine, message, level, config })
        t.equal(formattedLine['trace.id'], meta['trace.id'])
        t.equal(formattedLine['span.id'], meta['span.id'])
        t.end()
      })
    })

    t.test(
      'should assign hostname from NR linking metadata when not defined as a core chinding',
      async (t) => {
        const { agent, config, pino } = t.context
        const localStream = sink()
        const localLogger = pino({ base: undefined }, localStream)
        const message = 'pino unit test'
        const level = 'info'
        localLogger[level](message)
        const line = await once(localStream, 'data')
        t.notOk(line.pid, 'should not have pid when overriding base chindings')
        t.notOk(line.hostname, 'should not have hostname when overriding base chindings')
        t.equal(agent.logs.getEvents().length, 1, 'should have 1 log in aggregator')
        const formattedLine = agent.logs.getEvents()[0]()
        t.validateAnnotations({ line: formattedLine, message, level, config })
        t.end()
      }
    )

    t.test('should properly handle child loggers', (t) => {
      const { agent, config, logger, stream } = t.context
      const childLogger = logger.child({ module: 'child' })
      helper.runInTransaction(agent, 'pino-test', async (tx) => {
        // these are defined in opposite order because the log aggregator is LIFO
        const messages = ['this is a child message', 'my parent logger message']
        const level = 'info'
        logger[level](messages[1])
        const meta = agent.getLinkingMetadata()
        const line = await once(stream, 'data')
        originalMsgAssertion({
          t,
          hostname: agent.config.getHostnameSafe(),
          logLine: line
        })
        childLogger[level](messages[0])
        const childLine = await once(stream, 'data')
        originalMsgAssertion({
          t,
          hostname: agent.config.getHostnameSafe(),
          logLine: childLine
        })
        t.equal(
          agent.logs.getEvents().length,
          0,
          'should have not have log in aggregator while transaction is active'
        )
        tx.end()
        t.equal(
          agent.logs.getEvents().length,
          2,
          'should have log in aggregator after transaction ends'
        )

        agent.logs.getEvents().forEach((logLine, index) => {
          const formattedLine = logLine()
          t.validateAnnotations({
            line: formattedLine,
            message: messages[index],
            level,
            config
          })
          t.equal(formattedLine['trace.id'], meta['trace.id'], 'should be expected trace.id value')
          t.equal(formattedLine['span.id'], meta['span.id'], 'should be expected span.id value')
        })
        t.end()
      })
    })
  })

  t.test('metrics', (t) => {
    t.autoend()

    t.test('should count logger metrics', (t) => {
      setupAgent(t.context, {
        application_logging: {
          enabled: true,
          local_decorating: { enabled: false },
          forwarding: { enabled: false },
          metrics: { enabled: true }
        }
      })
      const { agent, pino, stream } = t.context

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
    configValues.forEach(({ name, config }) => {
      t.test(`should not count logger metrics when ${name}`, (t) => {
        setupAgent(t.context, config)
        const { agent, logger, stream } = t.context
        helper.runInTransaction(agent, 'pino-test', async () => {
          logger.info('This is a log message test')
          await once(stream, 'data')

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
