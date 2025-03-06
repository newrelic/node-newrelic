/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const Exception = require('../../../lib/errors').Exception
const ErrorCollector = require('../../../lib/errors/error-collector')
const ErrorTraceAggregator = require('../../../lib/errors/error-trace-aggregator')
const ErrorEventAggregator = require('../../../lib/errors/error-event-aggregator')

const Transaction = require('../../../lib/transaction')
const Metrics = require('../../../lib/metrics')

const API = require('../../../api')
const DESTS = require('../../../lib/config/attribute-filter').DESTINATIONS
const NAMES = require('../../../lib/metrics/names')
const http = require('http')
const Segment = require('#agentlib/transaction/trace/segment.js')

function createTransaction(agent, code, isWeb) {
  if (typeof isWeb === 'undefined') {
    isWeb = true
  }

  const transaction = new Transaction(agent)
  if (isWeb) {
    transaction.type = Transaction.TYPES.WEB
    transaction.name = 'WebTransaction/TestJS/path'
    transaction.url = '/TestJS/path'
    transaction.statusCode = code
  } else {
    transaction.type = Transaction.TYPES.BG
    transaction.name = 'OtherTransaction'
  }
  return transaction
}

function createWebTransaction(agent, code) {
  return createTransaction(agent, code)
}

function createBackgroundTransaction(agent) {
  return createTransaction(agent, null, false)
}

function getErrorTraces(errorCollector) {
  return errorCollector.traceAggregator.errors
}

function getErrorEvents(errorCollector) {
  return errorCollector.eventAggregator.getEvents()
}

function getFirstErrorIntrinsicAttributes(aggregator) {
  return getFirstError(aggregator)[4].intrinsics
}

function getFirstErrorCustomAttributes(aggregator) {
  return getFirstError(aggregator)[4].userAttributes
}

function getFirstError(aggregator) {
  const errors = getErrorTraces(aggregator)
  assert.equal(errors.length, 1)
  return errors[0]
}

function getFirstEventIntrinsicAttributes(aggregator) {
  return getFirstEvent(aggregator)[0]
}

function getFirstEventCustomAttributes(aggregator) {
  return getFirstEvent(aggregator)[1]
}

function getFirstEventAgentAttributes(aggregator) {
  return getFirstEvent(aggregator)[2]
}

function getFirstEvent(aggregator) {
  const events = getErrorEvents(aggregator)
  assert.equal(events.length, 1)
  return events[0]
}

test('Errors', async (t) => {
  function beforeEach(ctx) {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({ attributes: { enabled: true } })

    ctx.nr.tx = new Transaction(ctx.nr.agent)
    ctx.nr.tx.url = '/'

    ctx.nr.errors = ctx.nr.agent.errors
  }

  function afterEach(ctx) {
    helper.unloadAgent(ctx.nr.agent)
  }

  await t.test('agent attribute format', async (t) => {
    const PARAMS = 4

    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('record captured params', (t) => {
      const { agent, errors, tx } = t.nr
      tx.trace.attributes.addAttribute(DESTS.TRANS_SCOPE, 'request.parameters.a', 'A')
      errors.add(tx, Error())
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(errors)
      let params = errorTraces[0][PARAMS]
      assert.deepEqual(params.agentAttributes, { 'request.parameters.a': 'A' })

      // Error events
      const errorEvents = getErrorEvents(errors)
      params = errorEvents[0][2]
      assert.deepEqual(params, { 'request.parameters.a': 'A' })
    })

    await t.test('record custom parameters', (t) => {
      const { agent, errors, tx } = t.nr
      tx.trace.addCustomAttribute('a', 'A')
      errors.add(tx, Error())
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(errors)
      let params = errorTraces[0][PARAMS]
      assert.deepEqual(params.userAttributes, { a: 'A' })

      const errorEvents = getErrorEvents(errors)
      params = errorEvents[0][1]
      assert.deepEqual(params, { a: 'A' })
    })

    await t.test('merge custom parameters', (t) => {
      const { agent, errors, tx } = t.nr
      tx.trace.addCustomAttribute('a', 'A')
      errors.add(tx, Error(), { b: 'B' })
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(errors)
      let params = errorTraces[0][PARAMS]
      assert.deepEqual(params.userAttributes, { a: 'A', b: 'B' })

      const errorEvents = getErrorEvents(errors)
      params = errorEvents[0][1]
      assert.deepEqual(params, { a: 'A', b: 'B' })
    })

    await t.test('overrides existing custom attributes with new custom attributes', (t) => {
      const { agent, errors, tx } = t.nr
      tx.trace.custom.a = 'A'
      errors.add(tx, Error(), { a: 'AA' })
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(errors)
      let params = errorTraces[0][PARAMS]
      assert.deepEqual(params.userAttributes, { a: 'AA' })

      const errorEvents = getErrorEvents(errors)
      params = errorEvents[0][1]
      assert.deepEqual(params, { a: 'AA' })
    })

    await t.test('does not add custom attributes in high security mode', (t) => {
      const { agent, errors, tx } = t.nr
      agent.config.high_security = true
      errors.add(tx, Error(), { a: 'AA' })
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(errors)
      let params = errorTraces[0][PARAMS]
      assert.deepEqual(params.userAttributes, {})

      const errorEvents = getErrorEvents(errors)
      params = errorEvents[0][1]
      assert.deepEqual(params, {})
    })

    await t.test('redacts the error message in high security mode', (t) => {
      const { agent, errors, tx } = t.nr
      agent.config.high_security = true
      errors.add(tx, Error('should be omitted'), { a: 'AA' })
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(errors)
      assert.equal(errorTraces[0][2], '')
      assert.equal(errorTraces[0][4].stack_trace[0], 'Error: <redacted>')
    })

    await t.test('redacts the error message when strip_exception_messages.enabled', (t) => {
      const { agent, errors, tx } = t.nr
      agent.config.strip_exception_messages.enabled = true
      errors.add(tx, Error('should be omitted'), { a: 'AA' })
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(errors)
      assert.equal(errorTraces[0][2], '')
      assert.equal(errorTraces[0][4].stack_trace[0], 'Error: <redacted>')
    })
  })

  await t.test('transaction id with distributed tracing enabled', async (t) => {
    t.beforeEach((ctx) => {
      beforeEach(ctx)
      ctx.nr.agent.config.distributed_tracing.enabled = true
    })
    t.afterEach(afterEach)

    await t.test('should have a transaction id when there is a transaction', (t) => {
      const { agent } = t.nr
      const tx = new Transaction(agent)

      agent.errors.add(tx, Error('boom'))
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(agent.errors)
      const errorJSON = errorTraces[0]
      const transactionId = errorJSON[5]

      assert.equal(transactionId, tx.id)
      tx.end()
    })

    await t.test('should not have a transaction id when there is no transaction', (t) => {
      const { agent } = t.nr

      agent.errors.add(null, Error('boom'))

      const errorTraces = getErrorTraces(agent.errors)
      const errorJSON = errorTraces[0]
      const transactionId = errorJSON[5]
      assert.equal(transactionId, undefined)
    })
  })

  await t.test('guid attribute with distributed tracing enabled', async (t) => {
    t.beforeEach((ctx) => {
      beforeEach(ctx)
      ctx.nr.agent.config.distributed_tracing.enabled = true
    })
    t.afterEach(afterEach)

    await t.test('should have a guid attribute when there is a transaction', (t) => {
      const { agent, errors } = t.nr
      const tx = new Transaction(agent)

      agent.errors.add(tx, Error('boom'))
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(agent.errors)
      const errorJSON = errorTraces[0]
      const transactionId = errorJSON[5]
      const attributes = getFirstEventIntrinsicAttributes(errors)

      assert.equal(transactionId, tx.id)
      assert.equal(attributes.guid, tx.id)
      tx.end()
    })

    await t.test('should not have a guid attribute when there is no transaction', (t) => {
      const { agent, errors } = t.nr
      agent.errors.add(null, Error('boom'))

      const errorTraces = getErrorTraces(agent.errors)
      const errorJSON = errorTraces[0]
      const transactionId = errorJSON[5]
      const attributes = getFirstEventIntrinsicAttributes(errors)

      assert.equal(transactionId, undefined)
      assert.equal(attributes.guid, undefined)
    })
  })

  await t.test('transaction id with distributed tracing disabled', async (t) => {
    t.beforeEach((ctx) => {
      beforeEach(ctx)
      ctx.nr.agent.config.distributed_tracing.enabled = false
    })
    t.afterEach(afterEach)

    await t.test('should have a transaction id when there is a transaction', (t) => {
      const { agent } = t.nr
      const tx = new Transaction(agent)

      agent.errors.add(tx, Error('boom'))
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(agent.errors)
      const errorJSON = errorTraces[0]
      const transactionId = errorJSON[5]

      assert.equal(transactionId, tx.id)
      tx.end()
    })

    await t.test('should not have a transaction id when there is no transaction', (t) => {
      const { agent } = t.nr

      agent.errors.add(null, Error('boom'))

      const errorTraces = getErrorTraces(agent.errors)
      const errorJSON = errorTraces[0]
      const transactionId = errorJSON[5]
      assert.equal(transactionId, undefined)
    })
  })

  await t.test('guid attribute with distributed tracing disabled', async (t) => {
    t.beforeEach((ctx) => {
      beforeEach(ctx)
      ctx.nr.agent.config.distributed_tracing.enabled = false
    })
    t.afterEach(afterEach)

    await t.test('should have a guid attribute when there is a transaction', (t) => {
      const { agent, errors } = t.nr
      const tx = new Transaction(agent)

      agent.errors.add(tx, Error('boom'))
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(agent.errors)
      const errorJSON = errorTraces[0]
      const transactionId = errorJSON[5]
      const attributes = getFirstEventIntrinsicAttributes(errors)

      assert.equal(transactionId, tx.id)
      assert.equal(attributes.guid, tx.id)
      tx.end()
    })

    await t.test('should not have a guid attribute when there is no transaction', (t) => {
      const { agent, errors } = t.nr
      agent.errors.add(null, Error('boom'))

      const errorTraces = getErrorTraces(agent.errors)
      const errorJSON = errorTraces[0]
      const transactionId = errorJSON[5]
      const attributes = getFirstEventIntrinsicAttributes(errors)

      assert.equal(transactionId, undefined)
      assert.equal(attributes.guid, undefined)
    })
  })

  await t.test('display name', async (t) => {
    const PARAMS = 4
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should be in agent attributes if set by user', (t) => {
      // This test skips the beforeEach because:
      // 1. beforeEach creates a new agent
      // 2. beforeEach creates a new transaction
      // 3. transaction creates a new trace
      // 4. trace invokes getDisplayHost(), thus caching the default value
      // 5. test function is invoked
      // 6. agent config is updated
      // 7. new transaction is created
      // 8. new transaction creates a new trace
      // 9. new trace invokes getDisplayHost()
      // 10. getDisplayHost() returns the original cached value because the agent has been reused
      helper.unloadAgent(t.nr.agent)
      const agent = helper.loadMockedAgent({
        attributes: { enabled: true },
        process_host: {
          display_name: 'test-value'
        }
      })
      t.after(() => helper.unloadAgent(agent))

      const tx = new Transaction(agent)
      tx.url = '/'

      const errors = agent.errors
      errors.add(tx, Error())
      errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(errors)
      const params = errorTraces[0][PARAMS]
      assert.deepEqual(params.agentAttributes, { 'host.displayName': 'test-value' })
    })

    await t.test('should not be in agent attributes if not set by user', (t) => {
      const { errors, tx } = t.nr

      errors.add(tx, Error())
      errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(errors)
      const params = errorTraces[0][PARAMS]
      assert.deepEqual(params.agentAttributes, {})
    })
  })

  await t.test('ErrorCollector', async (t) => {
    t.beforeEach((ctx) => {
      beforeEach(ctx)

      ctx.nr.metrics = new Metrics(5, {}, {})
      ctx.nr.collector = {}
      ctx.nr.harvester = {
        add() {}
      }

      ctx.nr.errorCollector = new ErrorCollector(
        ctx.nr.agent.config,
        new ErrorTraceAggregator(
          { periodMs: 60, transport: null, limit: 20 },
          ctx.nr.collector,
          ctx.nr.harvester
        ),
        new ErrorEventAggregator(
          { periodMs: 60, transport: null, limit: 20 },
          {
            collector: ctx.nr.collector,
            metrics: ctx.nr.metrics,
            harvester: ctx.nr.harvester
          }
        ),
        ctx.nr.metrics
      )
    })

    t.afterEach(afterEach)

    await t.test('should preserve the name field on errors', (t) => {
      const { agent, errors } = t.nr
      const api = new API(agent)
      const testError = Error('EVERYTHING IS BROKEN')
      testError.name = 'GAMEBREAKER'

      api.noticeError(testError)

      const errorTraces = getErrorTraces(errors)
      const error = errorTraces[0]
      assert.equal(error[error.length - 3], testError.name)
    })

    await t.test(
      'should not gather application errors if it is switched off by user config',
      (t) => {
        const { agent, errorCollector } = t.nr
        agent.config.error_collector.enabled = false

        const errorTraces = getErrorTraces(errorCollector)
        assert.equal(errorTraces.length, 0)

        errorCollector.add(null, Error('boom'))
        assert.equal(errorTraces.length, 0)
      }
    )

    await t.test('should not gather user errors if it is switched off by user config', (t) => {
      const { agent, errorCollector } = t.nr
      agent.config.error_collector.enabled = false

      const errorTraces = getErrorTraces(errorCollector)
      assert.equal(errorTraces.length, 0)

      errorCollector.addUserError(null, Error('boom'))
      assert.equal(errorTraces.length, 0)
    })

    await t.test('should not gather errors if it is switched off by server config', (t) => {
      const { agent, errorCollector } = t.nr
      agent.config.collect_errors = false

      const errorTraces = getErrorTraces(errorCollector)
      assert.equal(errorTraces.length, 0)

      errorCollector.add(null, Error('boom'))
      assert.equal(errorTraces.length, 0)
    })

    await t.test('should gather the same error in two transactions', (t) => {
      const { agent, errors } = t.nr
      const error = Error('this happened once')
      const first = new Transaction(agent)
      const second = new Transaction(agent)

      const errorTraces = getErrorTraces(errors)
      assert.equal(errorTraces.length, 0)

      errors.add(first, error)
      assert.equal(first.exceptions.length, 1)

      errors.add(second, error)
      assert.equal(second.exceptions.length, 1)

      first.end()
      assert.equal(errorTraces.length, 1)

      second.end()
      assert.equal(errorTraces.length, 2)
    })

    await t.test('should not gather the same error twice in the same transaction', (t) => {
      const { errorCollector } = t.nr
      const error = Error('this happened once')

      const errorTraces = getErrorTraces(errorCollector)
      assert.equal(errorTraces.length, 0)

      errorCollector.add(null, error)
      errorCollector.add(null, error)
      assert.equal(errorTraces.length, 1)
    })

    await t.test('should not break on read only objects', (t) => {
      const { errorCollector } = t.nr
      const error = Error('this happened once')
      Object.freeze(error)

      const errorTraces = getErrorTraces(errorCollector)
      assert.equal(errorTraces.length, 0)

      errorCollector.add(null, error)
      errorCollector.add(null, error)
      assert.equal(errorTraces.length, 1)
    })

    await t.test('add()', (t) => {
      const { errors } = t.nr
      assert.doesNotThrow(() => {
        const error = Error()
        Object.freeze(error)
        errors.add(error)
      }, 'when handling immutable errors')
    })

    await t.test('when finalizing transactions', async (t) => {
      // We must unload the singleton agent in this nested test prior to any
      // of the subtests running. Otherwise, we will get an error about the agent
      // already being created when `loadMockedAgent` is invoked.
      helper.unloadAgent(t.nr.agent)
      t.beforeEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)
        beforeEach(ctx)
      })

      await t.test('should capture errors for transactions ending in error', (t) => {
        const { agent, errors } = t.nr
        errors.onTransactionFinished(createTransaction(agent, 400))
        errors.onTransactionFinished(createTransaction(agent, 500))

        const errorTraces = getErrorTraces(errors)
        assert.equal(errorTraces.length, 2)
      })

      await t.test('should generate transaction error metric', (t) => {
        const { agent, errors } = t.nr
        const tx = createTransaction(agent, 200)

        errors.add(tx, Error('error1'))
        errors.add(tx, Error('erorr2'))
        errors.onTransactionFinished(tx)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        assert.equal(metric.callCount, 2)
      })

      await t.test('should generate transaction error metric when added from API', (t) => {
        const { agent, errors } = t.nr
        const api = new API(agent)
        const tx = createTransaction(agent, 200)

        agent.tracer.getTransaction = () => {
          return tx
        }
        api.noticeError(Error('error1'))
        api.noticeError(Error('error2'))
        errors.onTransactionFinished(tx)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        assert.equal(metric.callCount, 2)
      })

      await t.test('should not generate transaction error metric for ignored error', (t) => {
        const { agent, errors } = t.nr
        agent.config.error_collector.ignore_classes = ['Error']
        const tx = createTransaction(agent, 200)

        errors.add(tx, Error('error1'))
        errors.add(tx, Error('error2'))
        errors.onTransactionFinished(tx)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        assert.equal(metric, undefined)
      })

      await t.test('should not generate transaction error metric for expected error', (t) => {
        const { agent, errors } = t.nr
        agent.config.error_collector.expected_classes = ['Error']
        const tx = createTransaction(agent, 200)

        errors.add(tx, Error('error1'))
        errors.add(tx, Error('error2'))
        errors.onTransactionFinished(tx)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        assert.equal(metric, undefined)
      })

      await t.test(
        'should generate transaction error metric for unexpected error via noticeError',
        (t) => {
          const { agent, errors } = t.nr
          const api = new API(agent)
          const tx = createTransaction(agent, 200)

          agent.tracer.getTransaction = () => tx

          api.noticeError(Error('unexpected error'))
          api.noticeError(Error('another unexpected error'))
          errors.onTransactionFinished(tx)

          const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
          assert.equal(metric.callCount, 2)
        }
      )

      await t.test(
        'should not generate transaction error metric for expected error via noticeError',
        (t) => {
          const { agent, errors } = t.nr
          const api = new API(agent)
          const tx = createTransaction(agent, 200)

          agent.tracer.getTransaction = () => tx

          api.noticeError(Error('expected error'), {}, true)
          api.noticeError(Error('another expected error'), {}, true)
          errors.onTransactionFinished(tx)

          const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
          assert.equal(metric, undefined)
        }
      )

      await t.test('should ignore errors if related transaction is ignored', (t) => {
        const { agent, errors } = t.nr
        const tx = createTransaction(agent, 500)
        tx.ignore = true

        // Add errors by various means
        errors.add(tx, Error('no'))
        const error = Error('ignored')
        const exception = new Exception({ error })
        tx.addException(exception)
        errors.onTransactionFinished(tx)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        assert.equal(metric, undefined)
      })

      await t.test('should ignore 404 errors for transactions', (t) => {
        const { agent, errors } = t.nr
        errors.onTransactionFinished(createTransaction(agent, 400))
        // 404 errors are ignored by default
        errors.onTransactionFinished(createTransaction(agent, 404))
        errors.onTransactionFinished(createTransaction(agent, 404))
        errors.onTransactionFinished(createTransaction(agent, 404))
        errors.onTransactionFinished(createTransaction(agent, 404))

        const errorTraces = getErrorTraces(errors)
        assert.equal(errorTraces.length, 1)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        assert.equal(metric.callCount, 1)
      })

      await t.test('should ignore 404 errors for transactions with exceptions attached', (t) => {
        const { agent, errors } = t.nr
        const notIgnored = createTransaction(agent, 400)
        const error = Error('bad request')
        const exception = new Exception({ error })
        notIgnored.addException(exception)
        errors.onTransactionFinished(notIgnored)

        // 404 errors are ignored by default, but making sure the config is set
        errors.config.error_collector.ignore_status_codes = [404]

        const ignored = createTransaction(agent, 404)
        agent.errors.add(ignored, Error('ignored'))
        errors.onTransactionFinished(ignored)

        const errorTraces = getErrorTraces(errors)
        assert.equal(errorTraces.length, 1)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        assert.equal(metric.callCount, 1)
      })

      await t.test(
        'should collect exceptions added with noticeError() API even if the status ' +
          'code is in ignore_status_codes config',
        (t) => {
          const { agent, errors } = t.nr
          const api = new API(agent)
          const tx = createTransaction(agent, 404)

          agent.tracer.getTransaction = () => {
            return tx
          }

          // 404 errors are ignored by default, but making sure the config is set
          errors.config.error_collector.ignore_status_codes = [404]

          // this should be ignored
          agent.errors.add(tx, new Error('should be ignored'))
          // this should go through
          api.noticeError(new Error('should go through'))
          errors.onTransactionFinished(tx)

          const errorTraces = getErrorTraces(errors)
          assert.equal(errorTraces.length, 1)
          assert.equal(errorTraces[0][2], 'should go through')
        }
      )
    })

    await t.test('with no exception and no transaction', async (t) => {
      helper.unloadAgent(t.nr.agent)
      await t.test('should have no errors', (t) => {
        const { errors } = t.nr
        errors.add(null, null)

        const errorTraces = getErrorTraces(errors)
        assert.equal(errorTraces.length, 0)
      })
    })

    await t.test('with no error and a transaction without status code', async (t) => {
      helper.unloadAgent(t.nr.agent)
      t.beforeEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)
        beforeEach(ctx)
        t.nr.errors.add(new Transaction(ctx.nr.agent), null)
      })

      await t.test('should have no errors', (t) => {
        const { errors } = t.nr
        const errorTraces = getErrorTraces(errors)
        assert.equal(errorTraces.length, 0)
      })
    })

    await t.test('with no error and a transaction with a status code', async (t) => {
      helper.unloadAgent(t.nr.agent)
      t.beforeEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)
        beforeEach(ctx)

        ctx.nr.errors.add(new Transaction(ctx.nr.agent), null)

        ctx.nr.tx = new Transaction(ctx.nr.agent)
        ctx.nr.tx.statusCode = 503

        ctx.nr.errors.add(ctx.nr.tx, null)
        ctx.nr.errors.onTransactionFinished(ctx.nr.tx)

        ctx.nr.errorTraces = getErrorTraces(ctx.nr.errors)
        ctx.nr.errorJSON = ctx.nr.errorTraces[0]
      })

      await t.test('should have no errors', (t) => {
        const { errorTraces } = t.nr
        assert.equal(errorTraces.length, 1)
      })

      await t.test('should not care what time it was traced', (t) => {
        const { errorJSON } = t.nr
        assert.equal(errorJSON[0], 0)
      })

      await t.test('should have the default scope', (t) => {
        const { errorJSON } = t.nr
        assert.equal(errorJSON[1], 'Unknown')
      })

      await t.test('should have an HTTP status code error message', (t) => {
        const { errorJSON } = t.nr
        assert.equal(errorJSON[2], 'HttpError 503')
      })

      await t.test('should default to a type of Error', (t) => {
        const { errorJSON } = t.nr
        assert.equal(errorJSON[3], 'Error')
      })

      await t.test('should not have a stack trace in the params', (t) => {
        const { errorJSON } = t.nr
        assert.equal(errorJSON[4].stack_trace, undefined)
      })

      await t.test('should have a transaction id', (t) => {
        const { errorJSON, tx } = t.nr
        assert.equal(errorJSON[5], tx.id)
      })

      await t.test('should have 6 elements in errorJson', (t) => {
        const { errorJSON } = t.nr
        assert.equal(errorJSON.length, 6)
      })
    })

    await t.test('with transaction agent attrs, status code, and no error', async (t) => {
      helper.unloadAgent(t.nr.agent)
      t.beforeEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)
        beforeEach(ctx)

        ctx.nr.tx.statusCode = 501
        ctx.nr.tx.trace.attributes.addAttributes(DESTS.TRANS_SCOPE, {
          test_param: 'a value',
          thing: true
        })

        ctx.nr.errors.add(ctx.nr.tx, null)
        ctx.nr.errors.onTransactionFinished(ctx.nr.tx)

        ctx.nr.errorTraces = getErrorTraces(ctx.nr.errors)
        ctx.nr.errorJSON = ctx.nr.errorTraces[0]
        ctx.nr.params = ctx.nr.errorJSON[4]
      })

      await t.test('should have one error', (t) => {
        const { errors } = t.nr
        const errorTraces = getErrorTraces(errors)
        assert.equal(errorTraces.length, 1)
      })

      await t.test('should not care what time it was traced', (t) => {
        const { errorJSON } = t.nr
        assert.equal(errorJSON[0], 0)
      })

      await t.test('should be scoped to the transaction', (t) => {
        const { errorJSON } = t.nr
        assert.equal(errorJSON[1], 'WebTransaction/WebFrameworkUri/(not implemented)')
      })

      await t.test('should have an HTTP status code message', (t) => {
        const { errorJSON } = t.nr
        assert.equal(errorJSON[2], 'HttpError 501')
      })

      await t.test('should default to  a type of Error', (t) => {
        const { errorJSON } = t.nr
        assert.equal(errorJSON[3], 'Error')
      })

      await t.test('should not have a stack trace in the params', (t) => {
        const { params } = t.nr
        assert.equal(params.stack_trace, undefined)
      })

      await t.test('should have a transaction id', (t) => {
        const { errorJSON, tx } = t.nr
        const transactionId = errorJSON[5]
        assert.equal(transactionId, tx.id)
      })

      await t.test('should not have a request URL', (t) => {
        const { params } = t.nr
        assert.equal(params['request.uri'], undefined)
      })

      await t.test('should parse out the first agent parameter', (t) => {
        const { params } = t.nr
        assert.equal(params.agentAttributes.test_param, 'a value')
      })

      await t.test('should parse out the other agent parameter', (t) => {
        const { params } = t.nr
        assert.equal(params.agentAttributes.thing, true)
      })
    })

    await t.test('with attributes.enabled disabled', (t) => {
      const { agent, errors } = t.nr
      const tx = new Transaction(agent)

      tx.statusCode = 501
      tx.url = '/test_action.json?test_param=a%20value&thing'

      errors.add(tx, null)
      errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(errors)
      const errorJSON = errorTraces[0]
      const params = errorJSON[4]
      assert.equal(params.request_params, undefined)
    })

    await t.test('with attributes.enabled and attributes.exclude set', (t) => {
      const { agent, errors } = t.nr

      agent.config.attributes.exclude = ['thing']
      agent.config.emit('attributes.exclude')

      const tx = new Transaction(agent)
      tx.statusCode = 501
      tx.trace.attributes.addAttributes(DESTS.TRANS_SCOPE, {
        test_param: 'a value',
        thing: 5
      })

      errors.add(tx, null)
      agent._transactionFinished(tx)

      const errorTraces = getErrorTraces(errors)
      const errorJSON = errorTraces[0]
      const params = errorJSON[4]
      assert.deepEqual(params.agentAttributes, { test_param: 'a value' })
    })

    await t.test('with a thrown TypeError object and no transaction', async (t) => {
      helper.unloadAgent(t.nr.agent)
      t.beforeEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)

        const exception = Error('Dare to be the same!')
        ctx.nr.errors.add(null, exception)

        ctx.nr.errorTraces = getErrorTraces(ctx.nr.errors)
        ctx.nr.errorJSON = ctx.nr.errorTraces[0]
      })

      await t.test('should have one error', (t) => {
        assert.equal(t.nr.errorTraces.length, 1)
      })

      await t.test('should not care what time it was traced', (t) => {
        assert.equal(t.nr.errorJSON[0], 0)
      })

      await t.test('should have the default scope', (t) => {
        assert.equal(t.nr.errorJSON[1], 'Unknown')
      })

      await t.test('should fish the message out of the exception', (t) => {
        assert.equal(t.nr.errorJSON[2], 'Dare to be the same!')
      })

      await t.test('should have a type of TypeError', (t) => {
        assert.equal(t.nr.errorJSON[3], 'Error')
      })

      await t.test('should have a stack trace in the params', (t) => {
        const params = t.nr.errorJSON[4]
        assert.equal(Object.hasOwn(params, 'stack_trace'), true)
        assert.equal(params.stack_trace[0], 'Error: Dare to be the same!')
      })

      await t.test('should not have a transaction id', (t) => {
        const transactionId = t.nr.errorJSON[5]
        assert.equal(transactionId, undefined)
      })
    })

    await t.test('with a thrown TypeError and a transaction with no params', async (t) => {
      helper.unloadAgent(t.nr.agent)
      t.beforeEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)

        ctx.nr.tx = new Transaction(ctx.nr.agent)
        const exception = new TypeError('Dare to be different!')
        ctx.nr.errors.add(ctx.nr.tx, exception)
        ctx.nr.errors.onTransactionFinished(ctx.nr.tx)

        ctx.nr.errorTraces = getErrorTraces(ctx.nr.errors)
        ctx.nr.errorJSON = ctx.nr.errorTraces[0]
      })

      await t.test('should have one error', (t) => {
        assert.equal(t.nr.errorTraces.length, 1)
      })

      await t.test('should not care what time it was traced', (t) => {
        assert.equal(t.nr.errorJSON[0], 0)
      })

      await t.test('should have the default scope', (t) => {
        assert.equal(t.nr.errorJSON[1], 'Unknown')
      })

      await t.test('should fish the message out of the exception', (t) => {
        assert.equal(t.nr.errorJSON[2], 'Dare to be different!')
      })

      await t.test('should have a type of TypeError', (t) => {
        assert.equal(t.nr.errorJSON[3], 'TypeError')
      })

      await t.test('should have a stack trace in the params', (t) => {
        const params = t.nr.errorJSON[4]
        assert.equal(Object.hasOwn(params, 'stack_trace'), true)
        assert.equal(params.stack_trace[0], 'TypeError: Dare to be different!')
      })

      await t.test('should have a transaction id', (t) => {
        const transactionId = t.nr.errorJSON[5]
        assert.equal(transactionId, t.nr.tx.id)
      })
    })

    await t.test('with a thrown TypeError and a transaction with agent attrs', async (t) => {
      helper.unloadAgent(t.nr.agent)
      t.beforeEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)

        const tx = new Transaction(ctx.nr.agent)
        const exception = new TypeError('wanted JSON, got XML')
        ctx.nr.tx = tx

        tx.trace.attributes.addAttributes(DESTS.TRANS_SCOPE, {
          test_param: 'a value',
          thing: true
        })
        tx.url = '/test_action.json'

        ctx.nr.errors.add(tx, exception)
        ctx.nr.errors.onTransactionFinished(tx)

        ctx.nr.errorTraces = getErrorTraces(ctx.nr.errors)
        ctx.nr.errorJSON = ctx.nr.errorTraces[0]
        ctx.nr.params = ctx.nr.errorJSON[4]
      })

      await t.test('should have one error', (t) => {
        assert.equal(t.nr.errorTraces.length, 1)
      })

      await t.test('should not care what time it was traced', (t) => {
        assert.equal(t.nr.errorJSON[0], 0)
      })

      await t.test("should have the URL's scope", (t) => {
        assert.equal(t.nr.errorJSON[1], 'WebTransaction/NormalizedUri/*')
      })

      await t.test('should fish the message out of the exception', (t) => {
        assert.equal(t.nr.errorJSON[2], 'wanted JSON, got XML')
      })

      await t.test('should have a type of TypeError', (t) => {
        assert.equal(t.nr.errorJSON[3], 'TypeError')
      })

      await t.test('should have a stack trace in the params', (t) => {
        const { params } = t.nr
        assert.equal(Object.hasOwn(params, 'stack_trace'), true)
        assert.equal(params.stack_trace[0], 'TypeError: wanted JSON, got XML')
      })

      await t.test('should have a transaction id', (t) => {
        const transactionId = t.nr.errorJSON[5]
        assert.equal(transactionId, t.nr.tx.id)
      })

      await t.test('should not have a request URL', (t) => {
        assert.equal(t.nr.params['request.uri'], undefined)
      })

      await t.test('should parse out the first agent parameter', (t) => {
        assert.equal(t.nr.params.agentAttributes.test_param, 'a value')
      })

      await t.test('should parse out the other agent parameter', (t) => {
        assert.equal(t.nr.params.agentAttributes.thing, true)
      })
    })

    await t.test('with a thrown string and a transaction', async (t) => {
      helper.unloadAgent(t.nr.agent)
      t.beforeEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)

        const tx = new Transaction(ctx.nr.agent)
        const exception = 'Dare to be different!'
        ctx.nr.tx = tx

        ctx.nr.errors.add(tx, exception)
        ctx.nr.errors.onTransactionFinished(tx)

        ctx.nr.errorTraces = getErrorTraces(ctx.nr.errors)
        ctx.nr.errorJSON = ctx.nr.errorTraces[0]
      })

      await t.test('should have one error', (t) => {
        assert.equal(t.nr.errorTraces.length, 1)
      })

      await t.test('should not care what time it was traced', (t) => {
        assert.equal(t.nr.errorJSON[0], 0)
      })

      await t.test('should have the default scope', (t) => {
        assert.equal(t.nr.errorJSON[1], 'Unknown')
      })

      await t.test('should turn the string into the message', (t) => {
        assert.equal(t.nr.errorJSON[2], 'Dare to be different!')
      })

      await t.test('should default to a type of Error', (t) => {
        assert.equal(t.nr.errorJSON[3], 'Error')
      })

      await t.test('should have no stack trace', (t) => {
        assert.equal(t.nr.errorJSON[4].stack_trace, undefined)
      })

      await t.test('should have a transaction id', (t) => {
        const transactionId = t.nr.errorJSON[5]
        assert.equal(transactionId, t.nr.tx.id)
      })
    })

    await t.test('with a thrown string and a transaction with agent parameters', async (t) => {
      helper.unloadAgent(t.nr.agent)
      t.beforeEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)

        const tx = new Transaction(ctx.nr.agent)
        const exception = 'wanted JSON, got XML'
        ctx.nr.tx = tx

        tx.trace.attributes.addAttributes(DESTS.TRANS_SCOPE, {
          test_param: 'a value',
          thing: true
        })
        tx.url = '/test_action.json'

        ctx.nr.errors.add(tx, exception)
        ctx.nr.errors.onTransactionFinished(tx)

        ctx.nr.errorTraces = getErrorTraces(ctx.nr.errors)
        ctx.nr.errorJSON = ctx.nr.errorTraces[0]
        ctx.nr.params = ctx.nr.errorJSON[4]
      })

      await t.test('should have one error', (t) => {
        assert.equal(t.nr.errorTraces.length, 1)
      })

      await t.test('should not care what time it was traced', (t) => {
        assert.equal(t.nr.errorJSON[0], 0)
      })

      await t.test("should have the transaction's name", (t) => {
        assert.equal(t.nr.errorJSON[1], 'WebTransaction/NormalizedUri/*')
      })

      await t.test('should turn the string into the message', (t) => {
        assert.equal(t.nr.errorJSON[2], 'wanted JSON, got XML')
      })

      await t.test('should default to a type of Error', (t) => {
        assert.equal(t.nr.errorJSON[3], 'Error')
      })

      await t.test('should not have a stack trace in the params', (t) => {
        assert.equal(t.nr.params.stack_trace, undefined)
      })

      await t.test('should have a transaction id', (t) => {
        const transactionId = t.nr.errorJSON[5]
        assert.equal(transactionId, t.nr.tx.id)
      })

      await t.test('should not have a request URL', (t) => {
        assert.equal(t.nr.params['request.uri'], undefined)
      })

      await t.test('should parse out the first agent parameter', (t) => {
        assert.equal(t.nr.params.agentAttributes.test_param, 'a value')
      })

      await t.test('should parse out the other agent parameter', (t) => {
        assert.equal(t.nr.params.agentAttributes.thing, true)
      })
    })

    await t.test('with an internal server error (500) and an exception', async (t) => {
      helper.unloadAgent(t.nr.agent)
      t.beforeEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)

        const tx = new Transaction(ctx.nr.agent)
        const exception = new Exception({ error: Error('500 test error') })
        ctx.nr.tx = tx

        tx.addException(exception)
        tx.url = '/test-request/zxrkbl'
        tx.name = 'WebTransaction/Uri/test-request/zxrkbl'
        tx.statusCode = 500
        tx.end()

        ctx.nr.error = getErrorTraces(ctx.nr.errors)[0]
      })

      await t.test("should associate errors with the transaction's name", (t) => {
        const errorName = t.nr.error[1]
        assert.equal(errorName, 'WebTransaction/Uri/test-request/zxrkbl')
      })

      await t.test('should associate errors with a message', (t) => {
        const message = t.nr.error[2]
        assert.match(message, /500 test error/)
      })

      await t.test('should associate errors with a message class', (t) => {
        const messageClass = t.nr.error[3]
        assert.equal(messageClass, 'Error')
      })

      await t.test('should associate errors with parameters', (t) => {
        const params = t.nr.error[4]
        assert.ok(params && params.stack_trace)
        assert.equal(params.stack_trace[0], 'Error: 500 test error')
      })
    })

    await t.test('with tracer unavailable (503) error', async (t) => {
      helper.unloadAgent(t.nr.agent)
      t.beforeEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)

        const tx = new Transaction(ctx.nr.agent)
        ctx.nr.tx = tx

        tx.url = '/test-request/zxrkbl'
        tx.name = 'WebTransaction/Uri/test-request/zxrkbl'
        tx.statusCode = 503
        tx.end()

        ctx.nr.error = getErrorTraces(ctx.nr.errors)[0]
      })

      await t.test("should associate errors with the transaction's name", (t) => {
        const errorName = t.nr.error[1]
        assert.equal(errorName, 'WebTransaction/Uri/test-request/zxrkbl')
      })

      await t.test('should associate errors with a message', (t) => {
        const message = t.nr.error[2]
        assert.equal(message, 'HttpError 503')
      })

      await t.test('should associate errors with an error type', (t) => {
        const messageClass = t.nr.error[3]
        assert.equal(messageClass, 'Error')
      })
    })

    await t.test('should allow throwing null', (t) => {
      const { agent } = t.nr
      const api = new API(agent)

      try {
        api.startBackgroundTransaction('job', () => {
          // eslint-disable-next-line no-throw-literal
          throw null
        })
      } catch (err) {
        assert.equal(err, null)
      }
    })

    await t.test('should copy parameters from background transactions', (t, end) => {
      const { agent, errors } = t.nr
      const api = new API(agent)

      api.startBackgroundTransaction('job', () => {
        api.addCustomAttribute('jobType', 'timer')
        api.noticeError(new Error('record an error'))
        agent.getTransaction().end()

        const errorTraces = getErrorTraces(errors)

        assert.equal(errorTraces.length, 1)
        assert.equal(errorTraces[0][2], 'record an error')
        end()
      })
    })

    await t.test('should generate expected error metric for expected errors', (t) => {
      const { agent, errors } = t.nr
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.EXPECTED)
      assert.equal(metric.callCount, 2)
    })

    await t.test('should not generate expected error metric for unexpected errors', (t) => {
      const { agent, errors } = t.nr
      const transaction = createTransaction(agent, 200)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.EXPECTED)
      assert.equal(metric, undefined)
    })

    await t.test('should not generate expected error metric for ignored errors', (t) => {
      const { agent, errors } = t.nr
      agent.config.error_collector.expected_classes = ['Error']
      agent.config.error_collector.ignore_classes = ['Error'] // takes precedence
      const transaction = createTransaction(agent, 200)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.EXPECTED)
      assert.equal(metric, undefined)
    })

    await t.test('should generate all error metric for unexpected errors', (t) => {
      const { agent, errors } = t.nr
      const transaction = createTransaction(agent, 200)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      assert.equal(metric.callCount, 2)
    })

    await t.test('should not generate all error metric for expected errors', (t) => {
      const { agent, errors } = t.nr
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errors.add(transaction, new Error('error1'))
      errors.add(transaction, new Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      assert.equal(metric, undefined)
    })

    await t.test('should not generate all error metric for ignored errors', (t) => {
      const { agent, errors } = t.nr
      agent.config.error_collector.ignore_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      assert.equal(metric, undefined)
    })

    await t.test('should generate web error metric for unexpected web errors', (t) => {
      const { agent, errors } = t.nr
      const transaction = createWebTransaction(agent)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      assert.equal(metric.callCount, 2)
    })

    await t.test('should not generate web error metric for expected web errors', (t) => {
      const { agent, errors } = t.nr
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      assert.equal(metric, undefined)
    })

    await t.test('should not generate web error metric for ignored web errors', (t) => {
      const { agent, errors } = t.nr
      agent.config.error_collector.ignore_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      assert.equal(metric, undefined)
    })

    await t.test('should not generate web error metric for unexpected non-web errors', (t) => {
      const { agent, errors } = t.nr
      const transaction = createBackgroundTransaction(agent)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      assert.equal(metric, undefined)
    })

    await t.test('should generate other error metric for unexpected non-web errors', (t) => {
      const { agent, errors } = t.nr
      const transaction = createBackgroundTransaction(agent)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)
      assert.equal(metric.callCount, 2)
    })

    await t.test('should not generate other error metric for expected non-web errors', (t) => {
      const { agent, errors } = t.nr
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createBackgroundTransaction(agent)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)
      assert.equal(metric, undefined)
    })

    await t.test('should not generate other error metric for ignored non-web errors', (t) => {
      const { agent, errors } = t.nr
      agent.config.error_collector.ignore_classes = ['Error']
      const transaction = createBackgroundTransaction(agent)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)
      assert.equal(metric, undefined)
    })

    await t.test('should not generate other error metric for unexpected web errors', (t) => {
      const { agent, errors } = t.nr
      const transaction = createWebTransaction(agent)

      errors.add(transaction, Error('error1'))
      errors.add(transaction, Error('error2'))

      errors.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)
      assert.equal(metric, undefined)
    })

    await t.test('clearAll() clears collected errors', (t) => {
      const { errors } = t.nr
      errors.add(null, new Error('error1'))

      assert.equal(getErrorTraces(errors).length, 1)
      assert.equal(getErrorEvents(errors).length, 1)

      errors.clearAll()

      assert.equal(getErrorTraces(errors).length, 0)
      assert.equal(getErrorEvents(errors).length, 0)
    })
  })

  await t.test('traced errors', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('without transaction', async (t) => {
      helper.unloadAgent(t.nr.agent)

      await t.test('should contain no intrinsic attributes', (t) => {
        const { errors } = t.nr
        const error = Error('some error')
        errors.add(null, error)

        const errorTraces = getErrorTraces(errors)
        assert.equal(errorTraces.length, 1)

        const attributes = getFirstErrorIntrinsicAttributes(errors)
        assert.equal(typeof attributes === 'object', true)
      })

      await t.test('should contain supplied custom attributes, with filter rules', (t) => {
        const { agent, errors } = t.nr
        agent.config.error_collector.attributes.exclude.push('c')
        agent.config.emit('error_collector.attributes.exclude')
        const error = Error('some error')
        const customAttributes = { a: 'b', c: 'ignored' }
        errors.add(null, error, customAttributes)

        const attributes = getFirstErrorCustomAttributes(errors)
        assert.equal(attributes.a, 'b')
        assert.equal(attributes.c, undefined)
      })
    })

    await t.test('on transaction finished', async (t) => {
      helper.unloadAgent(t.nr.agent)

      await t.test('should generate an event if the transaction is an HTTP error', (t) => {
        const { agent, errors } = t.nr
        const transaction = createTransaction(agent, 500)
        errors.add(transaction)

        transaction.end()
        const collectedError = getErrorTraces(errors)[0]
        assert.ok(collectedError)
      })

      await t.test('should contain CAT intrinsic parameters', (t) => {
        const { agent, errors } = t.nr
        agent.config.cross_application_tracer.enabled = true
        agent.config.distributed_tracing.enabled = false

        const transaction = createTransaction(agent, 200)

        transaction.referringTransactionGuid = '1234'
        transaction.incomingCatId = '2345'

        const error = Error('some error')
        errors.add(transaction, error)

        transaction.end()
        const attributes = getFirstErrorIntrinsicAttributes(errors)

        assert.ok(typeof attributes === 'object')
        assert.ok(typeof attributes.path_hash === 'string')
        assert.equal(attributes.referring_transaction_guid, '1234')
        assert.equal(attributes.client_cross_process_id, '2345')
      })

      await t.test('should contain DT intrinsic parameters', (t) => {
        const { agent, errors } = t.nr
        agent.config.distributed_tracing.enabled = true
        agent.config.primary_application_id = 'test'
        agent.config.account_id = 1
        const transaction = createTransaction(agent, 200)

        const error = new Error('some error')
        errors.add(transaction, error)

        transaction.end()
        const attributes = getFirstErrorIntrinsicAttributes(errors)

        assert.ok(typeof attributes === 'object')
        assert.equal(attributes.traceId, transaction.traceId)
        assert.equal(attributes.guid, transaction.id)
        assert.equal(attributes.priority, transaction.priority)
        assert.equal(attributes.sampled, transaction.sampled)
        assert.equal(attributes.parentId, undefined)
        assert.equal(attributes.parentSpanId, undefined)
        assert.equal(transaction.sampled, true)
        assert.ok(transaction.priority > 1)
      })

      await t.test('should contain DT intrinsic parameters', (t) => {
        const { agent, errors } = t.nr
        agent.config.distributed_tracing.enabled = true
        agent.config.primary_application_id = 'test'
        agent.config.account_id = 1
        const transaction = createTransaction(agent, 200)
        const payload = transaction._createDistributedTracePayload().text()
        transaction.isDistributedTrace = null
        transaction._acceptDistributedTracePayload(payload)

        const error = Error('some error')
        errors.add(transaction, error)

        transaction.end()
        const attributes = getFirstErrorIntrinsicAttributes(errors)

        assert.ok(typeof attributes === 'object')
        assert.equal(attributes.traceId, transaction.traceId)
        assert.equal(attributes.guid, transaction.id)
        assert.equal(attributes.priority, transaction.priority)
        assert.equal(attributes.sampled, transaction.sampled)
        assert.equal(attributes['parent.type'], 'App')
        assert.equal(attributes['parent.app'], agent.config.primary_application_id)
        assert.equal(attributes['parent.account'], agent.config.account_id)
        assert.equal(attributes.parentId, undefined)
        assert.equal(attributes.parentSpanId, undefined)
      })

      await t.test('should contain Synthetics intrinsic parameters', (t) => {
        const { agent, errors } = t.nr
        const transaction = createTransaction(agent, 200)

        transaction.syntheticsData = {
          version: 1,
          accountId: 123,
          resourceId: 'resId',
          jobId: 'jobId',
          monitorId: 'monId'
        }

        const error = Error('some error')
        errors.add(transaction, error)

        transaction.end()
        const attributes = getFirstErrorIntrinsicAttributes(errors)

        assert.ok(typeof attributes === 'object')
        assert.equal(attributes.synthetics_resource_id, 'resId')
        assert.equal(attributes.synthetics_job_id, 'jobId')
        assert.equal(attributes.synthetics_monitor_id, 'monId')
      })

      await t.test('should contain custom parameters', (t) => {
        const { agent, errors } = t.nr
        const transaction = createTransaction(agent, 500)
        const error = Error('some error')
        const customParameters = { a: 'b' }
        errors.add(transaction, error, customParameters)

        transaction.end()
        const attributes = getFirstErrorCustomAttributes(errors)
        assert.equal(attributes.a, 'b')
      })

      await t.test('should merge supplied custom params with those on the trace', (t) => {
        const { agent, errors } = t.nr
        agent.config.attributes.enabled = true
        const transaction = createTransaction(agent, 500)
        transaction.trace.addCustomAttribute('a', 'b')
        const error = Error('some error')

        const customParameters = { c: 'd' }
        errors.add(transaction, error, customParameters)

        transaction.end()
        const attributes = getFirstErrorCustomAttributes(errors)
        assert.equal(attributes.a, 'b')
        assert.equal(attributes.c, 'd')
      })
    })
  })

  await t.test('error events', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should use passed in segment', (t) => {
      const { agent, errors } = t.nr
      const transaction = createTransaction(agent, 500)
      const err = new Error('some error')
      const segment = new Segment({
        config: transaction.agent.config,
        name: 'Test segment name',
        root: transaction.trace.root
      })
      errors.add(transaction, err, null, segment)
      const exceptions = transaction.exceptions[0]
      assert.equal(exceptions.error, err)

      // spanId is the segment id of the exception
      const spanId = exceptions.agentAttributes['spanId']
      assert(spanId, segment.id)
      transaction.end()
    })

    await t.test('should omit the error message when in high security mode', (t) => {
      const { agent } = t.nr
      agent.config.high_security = true
      agent.errors.add(null, new Error('some error'))
      const events = getErrorEvents(agent.errors)
      assert.equal(events[0][0]['error.message'], '')
      agent.config.high_security = false
    })

    await t.test('not spill over reservoir size', (t) => {
      helper.unloadAgent(t.nr.agent)
      const agent = helper.loadMockedAgent({ error_collector: { max_event_samples_stored: 10 } })
      t.after(() => helper.unloadAgent(agent))

      for (let i = 0; i < 20; i++) {
        agent.errors.add(null, Error('some error'))
      }

      const events = getErrorEvents(agent.errors)
      assert.equal(events.length, 10)
    })

    await t.test('without transaction', async (t) => {
      helper.unloadAgent(t.nr.agent)

      await t.test('using add()', async (t) => {
        helper.unloadAgent(t.nr.agent)

        await t.test('should contain intrinsic attributes', (t) => {
          const { errors } = t.nr
          const error = Error('some error')
          const nowSeconds = Date.now() / 1000
          errors.add(null, error)

          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.ok(typeof attributes === 'object')
          assert.equal(attributes.type, 'TransactionError')
          assert.ok(typeof attributes['error.class'] === 'string')
          assert.ok(typeof attributes['error.message'] === 'string')
          assert.ok(Math.abs(attributes.timestamp - nowSeconds) <= 1)
          assert.equal(attributes.transactionName, 'Unknown')
        })

        await t.test('should not contain guid intrinsic attributes', (t) => {
          const { errors } = t.nr
          const error = Error('some error')
          errors.add(null, error)

          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes.guid, undefined)
        })

        await t.test('should set transactionName to Unknown', (t) => {
          const { errors } = t.nr
          const error = Error('some error')
          errors.add(null, error)

          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes.transactionName, 'Unknown')
        })

        await t.test('should contain supplied custom attributes, with filter rules', (t) => {
          const { agent, errors } = t.nr
          agent.config.attributes.enabled = true
          agent.config.attributes.exclude.push('c')
          agent.config.emit('attributes.exclude')
          const error = Error('some error')
          const customAttributes = { a: 'b', c: 'ignored' }
          errors.add(null, error, customAttributes)

          const attributes = getFirstEventCustomAttributes(errors)
          assert.equal(Object.keys(attributes).length, 1)
          assert.equal(attributes.a, 'b')
          assert.equal(attributes.c, undefined)
        })

        await t.test('should contain agent attributes', (t) => {
          const { agent, errors } = t.nr
          agent.config.attributes.enabled = true
          const error = Error('some error')
          errors.add(null, error, { a: 'a' })

          const agentAttributes = getFirstEventAgentAttributes(errors)
          const customAttributes = getFirstEventCustomAttributes(errors)

          assert.equal(Object.keys(customAttributes).length, 1)
          assert.equal(Object.keys(agentAttributes).length, 0)
        })
      })

      await t.test('using noticeError() API', async (t) => {
        helper.unloadAgent(t.nr.agent)
        t.beforeEach((ctx) => {
          helper.unloadAgent(ctx.nr.agent)
          beforeEach(ctx)
          ctx.nr.api = new API(ctx.nr.agent)
        })

        await t.test('should contain intrinsic parameters', (t) => {
          const { api, errors } = t.nr
          const error = Error('some error')
          const nowSeconds = Date.now() / 1000
          api.noticeError(error)

          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.ok(typeof attributes === 'object')
          assert.equal(attributes.type, 'TransactionError')
          assert.ok(typeof attributes['error.class'] === 'string')
          assert.ok(typeof attributes['error.message'] === 'string')
          assert.ok(Math.abs(attributes.timestamp - nowSeconds) <= 1)
          assert.equal(attributes.transactionName, 'Unknown')
        })

        await t.test('should set transactionName to Unknown', (t) => {
          const { api, errors } = t.nr
          const error = Error('some error')
          api.noticeError(error)

          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes.transactionName, 'Unknown')
        })

        await t.test('should contain expected attributes, with filter rules', (t) => {
          const { agent, api, errors } = t.nr
          agent.config.attributes.enabled = true
          agent.config.attributes.exclude = ['c']
          agent.config.emit('attributes.exclude')
          const error = Error('some error')
          let customAttributes = { a: 'b', c: 'ignored' }
          api.noticeError(error, customAttributes)

          const agentAttributes = getFirstEventAgentAttributes(errors)
          customAttributes = getFirstEventCustomAttributes(errors)

          assert.equal(Object.keys(customAttributes).length, 1)
          assert.equal(customAttributes.c, undefined)
          assert.equal(Object.keys(agentAttributes).length, 0)
        })

        await t.test('should preserve expected flag for noticeError', (t) => {
          const { api, errors } = t.nr
          const error = Error('some noticed error')
          api.noticeError(error, null, true)

          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes['error.expected'], true)
        })

        await t.test('unexpected noticeError should default to expected: false', (t) => {
          const { api, errors } = t.nr
          const error = Error('another noticed error')
          api.noticeError(error)

          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes['error.expected'], false)
        })

        await t.test(
          'noticeError expected:true should be definable without customAttributes',
          (t) => {
            const { api, errors } = t.nr
            const error = Error('yet another noticed expected error')
            api.noticeError(error, true)

            const attributes = getFirstEventIntrinsicAttributes(errors)
            assert.equal(attributes['error.expected'], true)
          }
        )

        await t.test(
          'noticeError expected:false should be definable without customAttributes',
          (t) => {
            const { api, errors } = t.nr
            const error = Error('yet another noticed unexpected error')
            api.noticeError(error, false)

            const attributes = getFirstEventIntrinsicAttributes(errors)
            assert.equal(attributes['error.expected'], false)
          }
        )

        await t.test(
          'noticeError should not interfere with agentAttributes and customAttributes',
          (t) => {
            const { api, errors } = t.nr
            const error = Error('and even yet another noticed error')
            let customAttributes = { a: 'b', c: 'd' }

            api.noticeError(error, customAttributes, true)

            const agentAttributes = getFirstEventAgentAttributes(errors)
            const attributes = getFirstEventIntrinsicAttributes(errors)
            customAttributes = getFirstEventCustomAttributes(errors)

            assert.equal(Object.keys(customAttributes).length, 2)
            assert.ok(customAttributes.c)
            assert.equal(attributes['error.expected'], true)
            assert.equal(Object.keys(agentAttributes).length, 0)
          }
        )
      })
    })

    await t.test('on transaction finished', async (t) => {
      helper.unloadAgent(t.nr.agent)

      await t.test('should generate an event if the transaction is an HTTP error', (t) => {
        const { agent, errors } = t.nr
        const transaction = createTransaction(agent, 500)
        errors.add(transaction)

        transaction.end()

        const errorEvents = getErrorEvents(errors)
        const collectedError = errorEvents[0]
        assert.ok(collectedError)
      })

      await t.test('should contain required intrinsic attributes', (t) => {
        const { agent, errors } = t.nr
        const transaction = createTransaction(agent, 200)

        const error = Error('some error')
        const nowSeconds = Date.now() / 1000
        errors.add(transaction, error)

        transaction.end()
        const attributes = getFirstEventIntrinsicAttributes(errors)

        assert.ok(typeof attributes === 'object')
        assert.equal(attributes.type, 'TransactionError')
        assert.ok(typeof attributes['error.class'] === 'string')
        assert.ok(typeof attributes['error.message'] === 'string')
        assert.equal(attributes.guid, transaction.id)
        assert.ok(Math.abs(attributes.timestamp - nowSeconds) <= 1)
        assert.equal(attributes.transactionName, transaction.name)
      })

      await t.test('transaction-specific intrinsic attributes on a transaction', async (t) => {
        helper.unloadAgent(t.nr.agent)
        t.beforeEach((ctx) => {
          helper.unloadAgent(ctx.nr.agent)
          beforeEach(ctx)

          ctx.nr.tx = createTransaction(ctx.nr.agent, 500)
          ctx.nr.error = Error('some error')
          ctx.nr.errors.add(ctx.nr.tx, ctx.nr.error)
        })

        await t.test('includes transaction duration', (t) => {
          const { errors, tx } = t.nr
          tx.end()
          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes.duration, tx.timer.getDurationInMillis() / 1000)
        })

        await t.test('includes queueDuration if available', (t) => {
          const { errors, tx } = t.nr
          tx.measure(NAMES.QUEUETIME, null, 100)
          tx.end()
          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes.queueDuration, 0.1)
        })

        await t.test('includes externalDuration if available', (t) => {
          const { errors, tx } = t.nr
          tx.measure(NAMES.EXTERNAL.ALL, null, 100)
          tx.end()
          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes.externalDuration, 0.1)
        })

        await t.test('includes databaseDuration if available', (t) => {
          const { errors, tx } = t.nr
          tx.measure(NAMES.DB.ALL, null, 100)
          tx.end()
          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes.databaseDuration, 0.1)
        })

        await t.test('includes externalCallCount if available', (t) => {
          const { errors, tx } = t.nr
          tx.measure(NAMES.EXTERNAL.ALL, null, 100)
          tx.measure(NAMES.EXTERNAL.ALL, null, 100)
          tx.end()
          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes.externalCallCount, 2)
        })

        await t.test('includes databaseCallCount if available', (t) => {
          const { errors, tx } = t.nr
          tx.measure(NAMES.DB.ALL, null, 100)
          tx.measure(NAMES.DB.ALL, null, 100)
          tx.end()
          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes.databaseCallCount, 2)
        })

        await t.test('includes internal synthetics attributes', (t) => {
          const { errors, tx } = t.nr
          tx.syntheticsData = {
            version: 1,
            accountId: 123,
            resourceId: 'resId',
            jobId: 'jobId',
            monitorId: 'monId'
          }
          tx.end()
          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes['nr.syntheticsResourceId'], 'resId')
          assert.equal(attributes['nr.syntheticsJobId'], 'jobId')
          assert.equal(attributes['nr.syntheticsMonitorId'], 'monId')
        })

        await t.test('includes internal transactionGuid attribute', (t) => {
          const { errors, tx } = t.nr
          tx.end()
          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes['nr.transactionGuid'], tx.id)
        })

        await t.test('includes guid attribute', (t) => {
          const { errors, tx } = t.nr
          tx.end()
          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes.guid, tx.id)
        })

        await t.test('includes traceId attribute', (t) => {
          const { errors, tx } = t.nr
          tx.referringTransactionGuid = '1234'
          tx.end()
          const attributes = getFirstEventIntrinsicAttributes(errors)
          assert.equal(attributes.traceId, tx.traceId)
        })

        await t.test('includes http port if the transaction is a web transaction', (t, end) => {
          helper.unloadAgent(t.nr.agent)
          const agent = helper.instrumentMockedAgent()
          t.after(() => helper.unloadAgent(agent))

          const server = http.createServer(function createServerCb(req, res) {
            assert.ok(agent.getTransaction())
            // Return HTTP error, so that when the transaction ends, an error
            // event is generated.
            res.statusCode = 500
            res.end()
          })

          server.listen(0, 'localhost', () => {
            const port = server.address().port
            http.get({ port, host: 'localhost' })
          })

          agent.on('transactionFinished', function (tx) {
            process.nextTick(() => {
              const attributes = getFirstEventIntrinsicAttributes(agent.errors)
              assert.equal(attributes.port, tx.port)

              server.close()
              end()
            })
          })
        })
      })

      await t.test('should contain custom attributes, with filter rules', (t) => {
        const { agent, errors } = t.nr
        agent.config.attributes.exclude.push('c')
        agent.config.emit('attributes.exclude')
        const transaction = createTransaction(agent, 500)
        const error = Error('some error')
        const customAttributes = { a: 'b', c: 'ignored' }
        errors.add(transaction, error, customAttributes)

        transaction.end()
        const attributes = getFirstEventCustomAttributes(errors)
        assert.equal(attributes.a, 'b')
        assert.equal(attributes.c, undefined)
      })

      await t.test('should merge new custom attrs with trace custom attrs', (t) => {
        const { agent, errors } = t.nr
        const transaction = createTransaction(agent, 500)
        transaction.trace.addCustomAttribute('a', 'b')
        const error = Error('some error')

        const customAttributes = { c: 'd' }
        errors.add(transaction, error, customAttributes)

        transaction.end()
        const attributes = getFirstEventCustomAttributes(errors)
        assert.equal(Object.keys(attributes).length, 2)
        assert.equal(attributes.a, 'b')
        assert.equal(attributes.c, 'd')
      })

      await t.test('should contain agent attributes', (t) => {
        const { agent, errors } = t.nr
        agent.config.attributes.enabled = true
        const transaction = createTransaction(agent, 500)
        transaction.trace.attributes.addAttribute(DESTS.TRANS_SCOPE, 'host.displayName', 'myHost')
        const error = new Error('some error')
        errors.add(transaction, error, { a: 'a' })

        transaction.end()
        const agentAttributes = getFirstEventAgentAttributes(errors)
        const customAttributes = getFirstEventCustomAttributes(errors)

        assert.equal(Object.keys(customAttributes).length, 1)
        assert.equal(customAttributes.a, 'a')
        assert.equal(Object.keys(agentAttributes).length, 1)
        assert.equal(agentAttributes['host.displayName'], 'myHost')
      })
    })
  })
})

test('When using the async listener', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()

    ctx.nr.uncaughtHandler = () => ctx.diagnostic('uncaught handler not defined')
    ctx.nr.listeners = process.listeners('uncaughtException')
    process.removeAllListeners('uncaughtException')
    process.once('uncaughtException', () => {
      ctx.nr.uncaughtHandler()
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    for (const l of ctx.nr.listeners) {
      process.on('uncaughtException', l)
    }
  })

  await t.test('should not have a domain active', (t, end) => {
    const { agent } = t.nr
    let active
    t.nr.uncaughtHandler = () => {
      assert.equal(active, undefined)
      end()
    }
    process.nextTick(() => {
      const disruptor = agent.tracer.transactionProxy(() => {
        active = process.domain
        throw Error('sample error')
      })
      disruptor()
    })
  })

  await t.test('should find a single error', (t, end) => {
    const { agent } = t.nr
    t.nr.uncaughtHandler = () => {
      const traces = getErrorTraces(agent.errors)
      assert.equal(traces.length, 1)
      end()
    }
    process.nextTick(() => {
      const disruptor = agent.tracer.transactionProxy(() => {
        throw Error('sample error')
      })
      disruptor()
    })
  })

  await t.test('should find traced error', (t, end) => {
    const { agent } = t.nr
    t.nr.uncaughtHandler = () => {
      const traces = getErrorTraces(agent.errors)
      assert.notEqual(traces[0], undefined)
      end()
    }
    process.nextTick(() => {
      const disruptor = agent.tracer.transactionProxy(() => {
        throw Error('sample error')
      })
      disruptor()
    })
  })

  await t.test('should have 6 elements in the trace', (t, end) => {
    const { agent } = t.nr
    t.nr.uncaughtHandler = () => {
      const traces = getErrorTraces(agent.errors)
      assert.equal(traces[0].length, 6)
      end()
    }
    process.nextTick(() => {
      const disruptor = agent.tracer.transactionProxy(() => {
        throw Error('sample error')
      })
      disruptor()
    })
  })

  await t.test('should have the default name', (t, end) => {
    const { agent } = t.nr
    t.nr.uncaughtHandler = () => {
      const traces = getErrorTraces(agent.errors)
      assert.equal(traces[0][1], 'Unknown')
      end()
    }
    process.nextTick(() => {
      const disruptor = agent.tracer.transactionProxy(() => {
        throw Error('sample error')
      })
      disruptor()
    })
  })

  await t.test('should have the error message', (t, end) => {
    const { agent } = t.nr
    t.nr.uncaughtHandler = () => {
      const traces = getErrorTraces(agent.errors)
      assert.equal(traces[0][2], 'sample error')
      end()
    }
    process.nextTick(() => {
      const disruptor = agent.tracer.transactionProxy(() => {
        throw Error('sample error')
      })
      disruptor()
    })
  })

  await t.test('should have the error constructor name (type)', (t, end) => {
    const { agent } = t.nr
    t.nr.uncaughtHandler = () => {
      const traces = getErrorTraces(agent.errors)
      assert.equal(traces[0][3], 'Error')
      end()
    }
    process.nextTick(() => {
      const disruptor = agent.tracer.transactionProxy(() => {
        throw Error('sample error')
      })
      disruptor()
    })
  })

  await t.test('should default to passing the stack trace as a parameter', (t, end) => {
    const { agent } = t.nr
    t.nr.uncaughtHandler = () => {
      const traces = getErrorTraces(agent.errors)
      const params = traces[0][4]
      assert.notEqual(params, undefined)
      assert.notEqual(params.stack_trace, undefined)
      assert.equal(params.stack_trace[0], 'Error: sample error')
      end()
    }
    process.nextTick(() => {
      const disruptor = agent.tracer.transactionProxy(() => {
        throw Error('sample error')
      })
      disruptor()
    })
  })
})

test('_processErrors', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      attributes: { enabled: true }
    })

    const tx = new Transaction(ctx.nr.agent)
    tx.url = '/'
    ctx.nr.tx = tx

    ctx.nr.errorCollector = ctx.nr.agent.errors
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('invalid errorType should return no iterableProperty', (t) => {
    const { errorCollector, tx } = t.nr
    const errorType = 'invalid'
    const result = errorCollector._getIterableProperty(tx, errorType)

    assert.equal(result, null)
  })

  await t.test('if errorType is transaction, should return no iterableProperty', (t) => {
    const { errorCollector, tx } = t.nr
    const errorType = 'transaction'
    const result = errorCollector._getIterableProperty(tx, errorType)

    assert.equal(result, null)
  })

  await t.test('if type is user, return an array of objects', (t) => {
    const { errorCollector, tx } = t.nr
    const errorType = 'user'
    const result = errorCollector._getIterableProperty(tx, errorType)

    assert.deepEqual(result, [])
  })

  await t.test('if type is transactionException, return an array of objects', (t) => {
    const { errorCollector, tx } = t.nr
    const errorType = 'transactionException'
    const result = errorCollector._getIterableProperty(tx, errorType)

    assert.deepEqual(result, [])
  })

  await t.test(
    'if iterableProperty is null and errorType is not transaction, do not modify collectedErrors or expectedErrors',
    (t) => {
      const { errorCollector, tx } = t.nr
      const errorType = 'error'
      const collectedErrors = 0
      const expectedErrors = 0
      const result = errorCollector._processErrors(tx, collectedErrors, expectedErrors, errorType)

      assert.deepEqual(result, [collectedErrors, expectedErrors])
    }
  )
})
