/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test

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

tap.test('Errors', (t) => {
  t.autoend()
  let agent = null

  t.beforeEach(() => {
    if (agent) {
      helper.unloadAgent(agent)
    }
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: true
      }
    })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('agent attribute format', (t) => {
    t.autoend()
    const PARAMS = 4
    let trans = null
    let error = null
    t.beforeEach(() => {
      trans = new Transaction(agent)
      trans.url = '/'

      error = agent.errors
    })

    t.test('record captured params', (t) => {
      trans.trace.attributes.addAttribute(DESTS.TRANS_SCOPE, 'request.parameters.a', 'A')
      error.add(trans, new Error())
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      let params = errorTraces[0][PARAMS]
      t.same(params.agentAttributes, { 'request.parameters.a': 'A' })

      // Error events
      const errorEvents = getErrorEvents(error)
      params = errorEvents[0][2]
      t.same(params, { 'request.parameters.a': 'A' })
      t.end()
    })

    t.test('records custom parameters', (t) => {
      trans.trace.addCustomAttribute('a', 'A')
      error.add(trans, new Error())
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      let params = errorTraces[0][PARAMS]

      t.same(params.userAttributes, { a: 'A' })

      // error events
      const errorEvents = getErrorEvents(error)
      params = errorEvents[0][1]

      t.same(params, { a: 'A' })
      t.end()
    })

    t.test('merge custom parameters', (t) => {
      trans.trace.addCustomAttribute('a', 'A')
      error.add(trans, new Error(), { b: 'B' })
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      let params = errorTraces[0][PARAMS]

      t.same(params.userAttributes, {
        a: 'A',
        b: 'B'
      })

      // error events
      const errorEvents = getErrorEvents(error)
      params = errorEvents[0][1]

      t.same(params, {
        a: 'A',
        b: 'B'
      })
      t.end()
    })

    t.test('overrides existing custom attributes with new custom attributes', (t) => {
      trans.trace.custom.a = 'A'
      error.add(trans, new Error(), { a: 'AA' })
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      let params = errorTraces[0][PARAMS]

      t.same(params.userAttributes, {
        a: 'AA'
      })

      // error events
      const errorEvents = getErrorEvents(error)
      params = errorEvents[0][1]

      t.same(params, {
        a: 'AA'
      })
      t.end()
    })

    t.test('does not add custom attributes in high security mode', (t) => {
      agent.config.high_security = true
      error.add(trans, new Error(), { a: 'AA' })
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      let params = errorTraces[0][PARAMS]

      t.same(params.userAttributes, {})

      // error events
      const errorEvents = getErrorEvents(error)
      params = errorEvents[0][1]

      t.same(params, {})
      t.end()
    })

    t.test('redacts the error message in high security mode', (t) => {
      agent.config.high_security = true
      error.add(trans, new Error('this should not be here'), { a: 'AA' })
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      t.equal(errorTraces[0][2], '')
      t.equal(errorTraces[0][4].stack_trace[0], 'Error: <redacted>')
      t.end()
    })

    t.test('redacts the error message when strip_exception_messages.enabled', (t) => {
      agent.config.strip_exception_messages.enabled = true
      error.add(trans, new Error('this should not be here'), { a: 'AA' })
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      t.equal(errorTraces[0][2], '')
      t.equal(errorTraces[0][4].stack_trace[0], 'Error: <redacted>')
      t.end()
    })
  })

  t.test('transaction id with distributed tracing enabled', (t) => {
    t.autoend()
    let errorJSON
    let transaction
    let error

    t.beforeEach(() => {
      agent.config.distributed_tracing.enabled = true
      error = new Error('this is an error')
    })

    t.test('should have a transaction id when there is a transaction', (t) => {
      transaction = new Transaction(agent)

      agent.errors.add(transaction, error)
      agent.errors.onTransactionFinished(transaction)

      const errorTraces = getErrorTraces(agent.errors)
      errorJSON = errorTraces[0]

      const transactionId = errorJSON[5]
      t.equal(transactionId, transaction.id)
      transaction.end()
      t.end()
    })

    t.test('should not have a transaction id when there is no transaction', (t) => {
      agent.errors.add(null, error)

      const errorTraces = getErrorTraces(agent.errors)
      errorJSON = errorTraces[0]

      const transactionId = errorJSON[5]
      t.notOk(transactionId)
      t.end()
    })
  })

  t.test('guid attribute with distributed tracing enabled', (t) => {
    t.autoend()
    let errorJSON
    let transaction
    let error

    t.beforeEach(() => {
      agent.config.distributed_tracing.enabled = true
      error = new Error('this is an error')
    })

    t.test('should have a guid attribute when there is a transaction', (t) => {
      transaction = new Transaction(agent)
      const aggregator = agent.errors

      agent.errors.add(transaction, error)
      agent.errors.onTransactionFinished(transaction)

      const errorTraces = getErrorTraces(agent.errors)
      errorJSON = errorTraces[0]
      const attributes = getFirstEventIntrinsicAttributes(aggregator, t)

      const transactionId = errorJSON[5]
      t.equal(transactionId, transaction.id)
      t.equal(attributes.guid, transaction.id)
      transaction.end()
      t.end()
    })

    t.test('should not have a guid attribute when there is no transaction', (t) => {
      agent.errors.add(null, error)
      const aggregator = agent.errors

      const errorTraces = getErrorTraces(agent.errors)
      errorJSON = errorTraces[0]
      const attributes = getFirstEventIntrinsicAttributes(aggregator, t)

      const transactionId = errorJSON[5]
      t.notOk(transactionId)
      t.notOk(attributes.guid)
      t.end()
    })
  })

  t.test('transaction id with distributed tracing disabled', (t) => {
    t.autoend()
    let errorJSON
    let transaction
    let error

    t.beforeEach(() => {
      agent.config.distributed_tracing.enabled = false
      error = new Error('this is an error')
    })

    t.test('should have a transaction id when there is a transaction', (t) => {
      transaction = new Transaction(agent)

      agent.errors.add(transaction, error)
      agent.errors.onTransactionFinished(transaction)

      const errorTraces = getErrorTraces(agent.errors)
      errorJSON = errorTraces[0]

      const transactionId = errorJSON[5]
      t.equal(transactionId, transaction.id)
      transaction.end()
      t.end()
    })

    t.test('should not have a transaction id when there is no transaction', (t) => {
      agent.errors.add(null, error)

      const errorTraces = getErrorTraces(agent.errors)
      errorJSON = errorTraces[0]

      const transactionId = errorJSON[5]
      t.notOk(transactionId)
      t.end()
    })
  })

  t.test('guid attribute with distributed tracing disabled', (t) => {
    t.autoend()
    let errorJSON
    let transaction
    let error

    t.beforeEach(() => {
      agent.config.distributed_tracing.enabled = false
      error = new Error('this is an error')
    })

    t.test('should have a guid attribute when there is a transaction', (t) => {
      transaction = new Transaction(agent)
      const aggregator = agent.errors

      agent.errors.add(transaction, error)
      agent.errors.onTransactionFinished(transaction)

      const errorTraces = getErrorTraces(agent.errors)
      errorJSON = errorTraces[0]
      const attributes = getFirstEventIntrinsicAttributes(aggregator, t)

      const transactionId = errorJSON[5]
      t.equal(transactionId, transaction.id)
      t.equal(attributes.guid, transaction.id)
      transaction.end()
      t.end()
    })

    t.test('should not have a guid attribute when there is no transaction', (t) => {
      agent.errors.add(null, error)
      const aggregator = agent.errors

      const errorTraces = getErrorTraces(agent.errors)
      errorJSON = errorTraces[0]
      const attributes = getFirstEventIntrinsicAttributes(aggregator, t)

      const transactionId = errorJSON[5]
      t.notOk(transactionId)
      t.notOk(attributes.guid)
      t.end()
    })
  })

  t.test('display name', (t) => {
    t.autoend()
    const PARAMS = 4

    let trans
    let error

    t.test('should be in agent attributes if set by user', (t) => {
      agent.config.process_host.display_name = 'test-value'

      trans = new Transaction(agent)
      trans.url = '/'

      error = agent.errors
      error.add(trans, new Error())
      error.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      const params = errorTraces[0][PARAMS]
      t.same(params.agentAttributes, {
        'host.displayName': 'test-value'
      })
      t.end()
    })

    t.test('should not be in agent attributes if not set by user', (t) => {
      trans = new Transaction(agent)
      trans.url = '/'

      error = agent.errors
      error.add(trans, new Error())
      error.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      const params = errorTraces[0][PARAMS]
      t.same(params.agentAttributes, {})
      t.end()
    })
  })

  t.test('ErrorCollector', (t) => {
    t.autoend()
    let metrics = null
    let collector = null
    let harvester = null
    let errorCollector = null

    t.beforeEach(() => {
      metrics = new Metrics(5, {}, {})
      collector = {}
      harvester = { add() {} }

      errorCollector = new ErrorCollector(
        agent.config,
        new ErrorTraceAggregator(
          {
            periodMs: 60,
            transport: null,
            limit: 20
          },
          collector,
          harvester
        ),
        new ErrorEventAggregator(
          {
            periodMs: 60,
            transport: null,
            limit: 20
          },
          {
            collector,
            metrics,
            harvester
          }
        ),
        metrics
      )
    })

    t.afterEach(() => {
      errorCollector = null
      harvester = null
      collector = null
      metrics = null
    })

    t.test('should preserve the name field on errors', (t) => {
      const api = new API(agent)

      const testError = new Error('EVERYTHING IS BROKEN')
      testError.name = 'GAMEBREAKER'

      api.noticeError(testError)

      const errorTraces = getErrorTraces(agent.errors)
      const error = errorTraces[0]
      t.equal(error[error.length - 3], testError.name)
      t.end()
    })

    t.test('should not gather application errors if it is switched off by user config', (t) => {
      const error = new Error('this error will never be seen')
      agent.config.error_collector.enabled = false
      t.teardown(() => {
        agent.config.error_collector.enabled = true
      })

      const errorTraces = getErrorTraces(errorCollector)
      t.equal(errorTraces.length, 0)

      errorCollector.add(null, error)

      t.equal(errorTraces.length, 0)

      t.end()
    })

    t.test('should not gather user errors if it is switched off by user config', (t) => {
      const error = new Error('this error will never be seen')
      agent.config.error_collector.enabled = false
      t.teardown(() => {
        agent.config.error_collector.enabled = true
      })

      const errorTraces = getErrorTraces(errorCollector)
      t.equal(errorTraces.length, 0)

      errorCollector.addUserError(null, error)

      t.equal(errorTraces.length, 0)

      t.end()
    })

    t.test('should not gather errors if it is switched off by server config', (t) => {
      const error = new Error('this error will never be seen')
      agent.config.collect_errors = false
      t.teardown(() => {
        agent.config.collect_errors = true
      })

      const errorTraces = getErrorTraces(errorCollector)
      t.equal(errorTraces.length, 0)

      errorCollector.add(null, error)

      t.equal(errorTraces.length, 0)

      t.end()
    })

    t.test('should gather the same error in two transactions', (t) => {
      const error = new Error('this happened once')
      const first = new Transaction(agent)
      const second = new Transaction(agent)

      const errorTraces = getErrorTraces(agent.errors)
      t.equal(errorTraces.length, 0)

      agent.errors.add(first, error)
      t.equal(first.exceptions.length, 1)

      agent.errors.add(second, error)
      t.equal(second.exceptions.length, 1)

      first.end()
      t.equal(errorTraces.length, 1)

      second.end()
      t.equal(errorTraces.length, 2)
      t.end()
    })

    t.test('should not gather the same error twice in the same transaction', (t) => {
      const error = new Error('this happened once')

      const errorTraces = getErrorTraces(errorCollector)
      t.equal(errorTraces.length, 0)

      errorCollector.add(null, error)
      errorCollector.add(null, error)
      t.equal(errorTraces.length, 1)
      t.end()
    })

    t.test('should not break on read only objects', (t) => {
      const error = new Error('this happened once')
      Object.freeze(error)

      const errorTraces = getErrorTraces(errorCollector)
      t.equal(errorTraces.length, 0)

      errorCollector.add(null, error)
      errorCollector.add(null, error)

      t.equal(errorTraces.length, 1)
      t.end()
    })

    t.test('add()', (t) => {
      t.doesNotThrow(() => {
        const aggregator = agent.errors
        const error = new Error()
        Object.freeze(error)
        aggregator.add(error)
      }, 'when handling immutable errors')

      t.end()
    })

    t.test('when finalizing transactions', (t) => {
      t.autoend()
      let finalizeCollector = null

      t.beforeEach(() => {
        finalizeCollector = agent.errors
      })

      t.test('should capture errors for transactions ending in error', (t) => {
        finalizeCollector.onTransactionFinished(createTransaction(agent, 400))
        finalizeCollector.onTransactionFinished(createTransaction(agent, 500))

        const errorTraces = getErrorTraces(finalizeCollector)
        t.equal(errorTraces.length, 2)
        t.end()
      })

      t.test('should generate transaction error metric', (t) => {
        const transaction = createTransaction(agent, 200)

        finalizeCollector.add(transaction, new Error('error1'))
        finalizeCollector.add(transaction, new Error('error2'))

        finalizeCollector.onTransactionFinished(transaction)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        t.equal(metric.callCount, 2)
        t.end()
      })

      t.test('should generate transaction error metric when added from API', (t) => {
        const api = new API(agent)
        const transaction = createTransaction(agent, 200)

        agent.tracer.getTransaction = () => {
          return transaction
        }

        api.noticeError(new Error('error1'))
        api.noticeError(new Error('error2'))

        finalizeCollector.onTransactionFinished(transaction)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        t.equal(metric.callCount, 2)
        t.end()
      })

      t.test('should not generate transaction error metric for ignored error', (t) => {
        agent.config.error_collector.ignore_classes = ['Error']
        const transaction = createTransaction(agent, 200)

        finalizeCollector.add(transaction, new Error('error1'))
        finalizeCollector.add(transaction, new Error('error2'))

        finalizeCollector.onTransactionFinished(transaction)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        t.notOk(metric)
        t.end()
      })

      t.test('should not generate transaction error metric for expected error', (t) => {
        agent.config.error_collector.expected_classes = ['Error']
        const transaction = createTransaction(agent, 200)

        finalizeCollector.add(transaction, new Error('error1'))
        finalizeCollector.add(transaction, new Error('error2'))

        finalizeCollector.onTransactionFinished(transaction)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        t.notOk(metric)
        t.end()
      })

      t.test(
        'should generate transaction error metric for unexpected error via noticeError',
        (t) => {
          const api = new API(agent)
          const transaction = createTransaction(agent, 200)

          agent.tracer.getTransaction = () => {
            return transaction
          }

          api.noticeError(new Error('unexpected error'))
          api.noticeError(new Error('another unexpected error'))

          finalizeCollector.onTransactionFinished(transaction)

          const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
          t.equal(metric.callCount, 2)
          t.end()
        }
      )

      t.test(
        'should not generate transaction error metric for expected error via noticeError',
        (t) => {
          const api = new API(agent)
          const transaction = createTransaction(agent, 200)

          agent.tracer.getTransaction = () => {
            return transaction
          }

          api.noticeError(new Error('expected error'), {}, true)
          api.noticeError(new Error('another expected error'), {}, true)

          finalizeCollector.onTransactionFinished(transaction)

          const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')

          t.notOk(metric)
          t.end()
        }
      )

      t.test('should ignore errors if related transaction is ignored', (t) => {
        const transaction = createTransaction(agent, 500)
        transaction.ignore = true

        // add errors by various means
        finalizeCollector.add(transaction, new Error('no'))
        const error = new Error('ignored')
        const exception = new Exception({ error })
        transaction.addException(exception)
        finalizeCollector.onTransactionFinished(transaction)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        t.notOk(metric)
        t.end()
      })

      t.test('should ignore 404 errors for transactions', (t) => {
        finalizeCollector.onTransactionFinished(createTransaction(agent, 400))
        // 404 errors are ignored by default
        finalizeCollector.onTransactionFinished(createTransaction(agent, 404))
        finalizeCollector.onTransactionFinished(createTransaction(agent, 404))
        finalizeCollector.onTransactionFinished(createTransaction(agent, 404))
        finalizeCollector.onTransactionFinished(createTransaction(agent, 404))

        const errorTraces = getErrorTraces(finalizeCollector)
        t.equal(errorTraces.length, 1)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        t.equal(metric.callCount, 1)
        t.end()
      })

      t.test('should ignore 404 errors for transactions with exceptions attached', (t) => {
        const notIgnored = createTransaction(agent, 400)
        const error = new Error('bad request')
        const exception = new Exception({ error })
        notIgnored.addException(exception)
        finalizeCollector.onTransactionFinished(notIgnored)

        // 404 errors are ignored by default, but making sure the config is set
        finalizeCollector.config.error_collector.ignore_status_codes = [404]

        const ignored = createTransaction(agent, 404)
        agent.errors.add(ignored, new Error('ignored'))
        finalizeCollector.onTransactionFinished(ignored)

        const errorTraces = getErrorTraces(finalizeCollector)
        t.equal(errorTraces.length, 1)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        t.equal(metric.callCount, 1)
        t.end()
      })

      t.test(
        'should collect exceptions added with noticeError() API even if the status ' +
          'code is in ignore_status_codes config',
        (t) => {
          const api = new API(agent)
          const tx = createTransaction(agent, 404)

          agent.tracer.getTransaction = () => {
            return tx
          }

          // 404 errors are ignored by default, but making sure the config is set
          finalizeCollector.config.error_collector.ignore_status_codes = [404]

          // this should be ignored
          agent.errors.add(tx, new Error('should be ignored'))
          // this should go through
          api.noticeError(new Error('should go through'))
          finalizeCollector.onTransactionFinished(tx)

          const errorTraces = getErrorTraces(finalizeCollector)
          t.equal(errorTraces.length, 1)
          t.equal(errorTraces[0][2], 'should go through')
          t.end()
        }
      )
    })

    t.test('with no exception and no transaction', (t) => {
      t.test('should have no errors', (t) => {
        agent.errors.add(null, null)

        const errorTraces = getErrorTraces(agent.errors)
        t.equal(errorTraces.length, 0)
        t.end()
      })
      t.end()
    })

    t.test('with no error and a transaction with status code', (t) => {
      t.beforeEach(() => {
        agent.errors.add(new Transaction(agent), null)
      })

      t.test('should have no errors', (t) => {
        const errorTraces = getErrorTraces(agent.errors)
        t.equal(errorTraces.length, 0)
        t.end()
      })
      t.end()
    })

    t.test('with no error and a transaction with a status code', (t) => {
      t.autoend()
      let noErrorStatusTracer
      let errorJSON
      let transaction

      t.beforeEach(() => {
        noErrorStatusTracer = agent.errors

        transaction = new Transaction(agent)
        transaction.statusCode = 503 // PDX wut wut

        noErrorStatusTracer.add(transaction, null)
        noErrorStatusTracer.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(noErrorStatusTracer)
        errorJSON = errorTraces[0]
      })

      t.test('should have one error', (t) => {
        const errorTraces = getErrorTraces(noErrorStatusTracer)
        t.equal(errorTraces.length, 1)
        t.end()
      })

      t.test('should not care what time it was traced', (t) => {
        t.equal(errorJSON[0], 0)
        t.end()
      })

      t.test('should have the default scope', (t) => {
        t.equal(errorJSON[1], 'Unknown')
        t.end()
      })

      t.test('should have an HTTP status code error message', (t) => {
        t.equal(errorJSON[2], 'HttpError 503')
        t.end()
      })

      t.test('should default to a type of Error', (t) => {
        t.equal(errorJSON[3], 'Error')
        t.end()
      })

      t.test('should not have a stack trace in the params', (t) => {
        const params = errorJSON[4]
        t.notHas(params, 'stack_trace')
        t.end()
      })

      t.test('should have a transaction id', (t) => {
        const transactionId = errorJSON[5]
        t.equal(transactionId, transaction.id)
        t.end()
      })

      t.test('should have 6 elements in errorJson', (t) => {
        t.equal(errorJSON.length, 6)
        t.end()
      })
    })

    t.test('with transaction agent attrs, status code, and no error', (t) => {
      let errorJSON = null
      let params = null
      let transaction

      t.beforeEach(() => {
        transaction = new Transaction(agent)
        transaction.statusCode = 501
        transaction.url = '/'
        transaction.trace.attributes.addAttributes(DESTS.TRANS_SCOPE, {
          test_param: 'a value',
          thing: true
        })

        agent.errors.add(transaction, null)
        agent.errors.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(agent.errors)
        errorJSON = errorTraces[0]
        params = errorJSON[4]
      })

      t.test('should have one error', (t) => {
        const errorTraces = getErrorTraces(agent.errors)
        t.equal(errorTraces.length, 1)
        t.end()
      })

      t.test('should not care what time it was traced', (t) => {
        t.equal(errorJSON[0], 0)
        t.end()
      })

      t.test('should be scoped to the transaction', (t) => {
        t.equal(errorJSON[1], 'WebTransaction/WebFrameworkUri/(not implemented)')
        t.end()
      })

      t.test('should have an HTTP status code message', (t) => {
        t.equal(errorJSON[2], 'HttpError 501')
        t.end()
      })

      t.test('should default to  a type of Error', (t) => {
        t.equal(errorJSON[3], 'Error')
        t.end()
      })

      t.test('should not have a stack trace in the params', (t) => {
        t.notHas(params, 'stack_trace')
        t.end()
      })

      t.test('should have a transaction id', (t) => {
        const transactionId = errorJSON[5]
        t.equal(transactionId, transaction.id)
        t.end()
      })

      t.test('should not have a request URL', (t) => {
        t.notOk(params['request.uri'])
        t.end()
      })

      t.test('should parse out the first agent parameter', (t) => {
        t.equal(params.agentAttributes.test_param, 'a value')
        t.end()
      })

      t.test('should parse out the other agent parameter', (t) => {
        t.equal(params.agentAttributes.thing, true)
        t.end()
      })
      t.end()
    })

    t.test('with attributes.enabled disabled', (t) => {
      const transaction = new Transaction(agent)
      transaction.statusCode = 501

      transaction.url = '/test_action.json?test_param=a%20value&thing'

      agent.errors.add(transaction, null)
      agent.errors.onTransactionFinished(transaction)

      const errorTraces = getErrorTraces(agent.errors)
      const errorJSON = errorTraces[0]
      const params = errorJSON[4]

      t.notHas(params, 'request_params')
      t.end()
    })

    t.test('with attributes.enabled and attributes.exclude set', (t) => {
      agent.config.attributes.exclude = ['thing']
      agent.config.emit('attributes.exclude')

      const transaction = new Transaction(agent)
      transaction.statusCode = 501

      transaction.trace.attributes.addAttributes(DESTS.TRANS_SCOPE, {
        test_param: 'a value',
        thing: 5
      })

      agent.errors.add(transaction, null)
      agent._transactionFinished(transaction)

      const errorTraces = getErrorTraces(agent.errors)
      const errorJSON = errorTraces[0]
      const params = errorJSON[4]

      t.same(params.agentAttributes, { test_param: 'a value' })
      t.end()
    })

    t.test('with a thrown TypeError object and no transaction', (t) => {
      t.autoend()
      let typeErrorTracer
      let errorJSON

      t.beforeEach(() => {
        typeErrorTracer = agent.errors

        const exception = new Error('Dare to be the same!')

        typeErrorTracer.add(null, exception)

        const errorTraces = getErrorTraces(agent.errors)
        errorJSON = errorTraces[0]
      })

      t.test('should have one error', (t) => {
        const errorTraces = getErrorTraces(agent.errors)
        t.equal(errorTraces.length, 1)
        t.end()
      })

      t.test('should not care what time it was traced', (t) => {
        t.equal(errorJSON[0], 0)
        t.end()
      })

      t.test('should have the default scope', (t) => {
        t.equal(errorJSON[1], 'Unknown')
        t.end()
      })

      t.test('should fish the message out of the exception', (t) => {
        t.equal(errorJSON[2], 'Dare to be the same!')
        t.end()
      })

      t.test('should have a type of TypeError', (t) => {
        t.equal(errorJSON[3], 'Error')
        t.end()
      })

      t.test('should have a stack trace in the params', (t) => {
        const params = errorJSON[4]
        t.hasProp(params, 'stack_trace')
        t.equal(params.stack_trace[0], 'Error: Dare to be the same!')
        t.end()
      })

      t.test('should not have a transaction id', (t) => {
        const transactionId = errorJSON[5]
        t.notOk(transactionId)
        t.end()
      })
    })

    t.test('with a thrown TypeError and a transaction with no params', (t) => {
      t.autoend()
      let typeErrorTracer
      let errorJSON
      let transaction

      t.beforeEach(() => {
        typeErrorTracer = agent.errors

        transaction = new Transaction(agent)
        const exception = new TypeError('Dare to be different!')

        typeErrorTracer.add(transaction, exception)
        typeErrorTracer.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(typeErrorTracer)
        errorJSON = errorTraces[0]
      })

      t.test('should have one error', (t) => {
        const errorTraces = getErrorTraces(typeErrorTracer)
        t.equal(errorTraces.length, 1)
        t.end()
      })

      t.test('should not care what time it was traced', (t) => {
        t.equal(errorJSON[0], 0)
        t.end()
      })

      t.test('should have the default scope', (t) => {
        t.equal(errorJSON[1], 'Unknown')
        t.end()
      })

      t.test('should fish the message out of the exception', (t) => {
        t.equal(errorJSON[2], 'Dare to be different!')
        t.end()
      })

      t.test('should have a type of TypeError', (t) => {
        t.equal(errorJSON[3], 'TypeError')
        t.end()
      })

      t.test('should have a stack trace in the params', (t) => {
        const params = errorJSON[4]
        t.hasProp(params, 'stack_trace')
        t.equal(params.stack_trace[0], 'TypeError: Dare to be different!')
        t.end()
      })

      t.test('should have a transaction id', (t) => {
        const transactionId = errorJSON[5]
        t.equal(transactionId, transaction.id)
        t.end()
      })
    })

    t.test('with a thrown `TypeError` and a transaction with agent attrs', (t) => {
      t.autoend()
      let errorJSON = null
      let params = null
      let transaction

      t.beforeEach(() => {
        transaction = new Transaction(agent)
        const exception = new TypeError('wanted JSON, got XML')

        transaction.trace.attributes.addAttributes(DESTS.TRANS_SCOPE, {
          test_param: 'a value',
          thing: true
        })
        transaction.url = '/test_action.json'

        agent.errors.add(transaction, exception)
        agent.errors.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(agent.errors)
        errorJSON = errorTraces[0]
        params = errorJSON[4]
      })

      t.test('should have one error', (t) => {
        const errorTraces = getErrorTraces(agent.errors)
        t.equal(errorTraces.length, 1)
        t.end()
      })

      t.test('should not care what time it was traced', (t) => {
        t.equal(errorJSON[0], 0)
        t.end()
      })

      t.test("should have the URL's scope", (t) => {
        t.equal(errorJSON[1], 'WebTransaction/NormalizedUri/*')
        t.end()
      })

      t.test('should fish the message out of the exception', (t) => {
        t.equal(errorJSON[2], 'wanted JSON, got XML')
        t.end()
      })

      t.test('should have a type of TypeError', (t) => {
        t.equal(errorJSON[3], 'TypeError')
        t.end()
      })

      t.test('should have a stack trace in the params', (t) => {
        t.hasProp(params, 'stack_trace')
        t.equal(params.stack_trace[0], 'TypeError: wanted JSON, got XML')
        t.end()
      })

      t.test('should have a transaction id', (t) => {
        const transactionId = errorJSON[5]
        t.equal(transactionId, transaction.id)
        t.end()
      })

      t.test('should not have a request URL', (t) => {
        t.notOk(params['request.uri'])
        t.end()
      })

      t.test('should parse out the first agent parameter', (t) => {
        t.equal(params.agentAttributes.test_param, 'a value')
        t.end()
      })

      t.test('should parse out the other agent parameter', (t) => {
        t.equal(params.agentAttributes.thing, true)
        t.end()
      })
    })

    t.test('with a thrown string and a transaction', (t) => {
      t.autoend()
      let thrownTracer
      let errorJSON
      let transaction

      t.beforeEach(() => {
        thrownTracer = agent.errors

        transaction = new Transaction(agent)
        const exception = 'Dare to be different!'

        thrownTracer.add(transaction, exception)
        thrownTracer.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(thrownTracer)
        errorJSON = errorTraces[0]
      })

      t.test('should have one error', (t) => {
        const errorTraces = getErrorTraces(thrownTracer)
        t.equal(errorTraces.length, 1)
        t.end()
      })

      t.test('should not care what time it was traced', (t) => {
        t.equal(errorJSON[0], 0)
        t.end()
      })

      t.test('should have the default scope', (t) => {
        t.equal(errorJSON[1], 'Unknown')
        t.end()
      })

      t.test('should turn the string into the message', (t) => {
        t.equal(errorJSON[2], 'Dare to be different!')
        t.end()
      })

      t.test('should default to a type of Error', (t) => {
        t.equal(errorJSON[3], 'Error')
        t.end()
      })

      t.test('should have no stack trace', (t) => {
        t.notHas(errorJSON[4], 'stack_trace')
        t.end()
      })

      t.test('should have a transaction id', (t) => {
        const transactionId = errorJSON[5]
        t.equal(transactionId, transaction.id)
        t.end()
      })
    })

    t.test('with a thrown string and a transaction with agent parameters', (t) => {
      t.autoend()
      let errorJSON = null
      let params = null
      let transaction

      t.beforeEach(() => {
        transaction = new Transaction(agent)
        const exception = 'wanted JSON, got XML'

        transaction.trace.attributes.addAttributes(DESTS.TRANS_SCOPE, {
          test_param: 'a value',
          thing: true
        })

        transaction.url = '/test_action.json'

        agent.errors.add(transaction, exception)
        agent.errors.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(agent.errors)
        errorJSON = errorTraces[0]
        params = errorJSON[4]
      })

      t.test('should have one error', (t) => {
        const errorTraces = getErrorTraces(agent.errors)
        t.equal(errorTraces.length, 1)
        t.end()
      })

      t.test('should not care what time it was traced', (t) => {
        t.equal(errorJSON[0], 0)
        t.end()
      })

      t.test("should have the transaction's name", (t) => {
        t.equal(errorJSON[1], 'WebTransaction/NormalizedUri/*')
        t.end()
      })

      t.test('should turn the string into the message', (t) => {
        t.equal(errorJSON[2], 'wanted JSON, got XML')
        t.end()
      })

      t.test('should default to a type of Error', (t) => {
        t.equal(errorJSON[3], 'Error')
        t.end()
      })

      t.test('should not have a stack trace in the params', (t) => {
        t.notHas(params, 'stack_trace')
        t.end()
      })

      t.test('should have a transaction id', (t) => {
        const transactionId = errorJSON[5]
        t.equal(transactionId, transaction.id)
        t.end()
      })

      t.test('should not have a request URL', (t) => {
        t.notOk(params['request.uri'])
        t.end()
      })

      t.test('should parse out the first agent parameter', (t) => {
        t.equal(params.agentAttributes.test_param, 'a value')
        t.end()
      })

      t.test('should parse out the other agent parameter', (t) => {
        t.equal(params.agentAttributes.thing, true)
        t.end()
      })
    })

    t.test('with an internal server error (500) and an exception', (t) => {
      t.autoend()
      const name = 'WebTransaction/Uri/test-request/zxrkbl'
      let error

      t.beforeEach(() => {
        errorCollector = agent.errors

        const transaction = new Transaction(agent)
        const exception = new Exception({ error: new Error('500 test error') })

        transaction.addException(exception)
        transaction.url = '/test-request/zxrkbl'
        transaction.name = 'WebTransaction/Uri/test-request/zxrkbl'
        transaction.statusCode = 500
        transaction.end()
        error = getErrorTraces(errorCollector)[0]
      })

      t.test("should associate errors with the transaction's name", (t) => {
        const errorName = error[1]

        t.equal(errorName, name)
        t.end()
      })

      t.test('should associate errors with a message', (t) => {
        const message = error[2]

        t.match(message, /500 test error/)
        t.end()
      })

      t.test('should associate errors with a message class', (t) => {
        const messageClass = error[3]

        t.equal(messageClass, 'Error')
        t.end()
      })

      t.test('should associate errors with parameters', (t) => {
        const params = error[4]

        t.ok(params && params.stack_trace)
        t.equal(params.stack_trace[0], 'Error: 500 test error')
        t.end()
      })
    })

    t.test('with a tracer unavailable (503) error', (t) => {
      t.autoend()
      const name = 'WebTransaction/Uri/test-request/zxrkbl'
      let error

      t.beforeEach(() => {
        errorCollector = agent.errors

        const transaction = new Transaction(agent)
        transaction.url = '/test-request/zxrkbl'
        transaction.name = 'WebTransaction/Uri/test-request/zxrkbl'
        transaction.statusCode = 503
        transaction.end()
        error = getErrorTraces(errorCollector)[0]
      })

      t.test("should associate errors with the transaction's name", (t) => {
        const errorName = error[1]
        t.equal(errorName, name)
        t.end()
      })

      t.test('should associate errors with a message', (t) => {
        const message = error[2]
        t.equal(message, 'HttpError 503')
        t.end()
      })
      t.test('should associate errors with an error type', (t) => {
        const messageClass = error[3]
        t.equal(messageClass, 'Error')
        t.end()
      })
    })

    t.test('should allow throwing null', (t) => {
      const api = new API(agent)

      try {
        api.startBackgroundTransaction('job', () => {
          throw null
        })
      } catch (err) {
        t.equal(err, null)
      }
      t.end()
    })

    t.test('should copy parameters from background transactions', async (t) => {
      const api = new API(agent)

      await api.startBackgroundTransaction('job', () => {
        api.addCustomAttribute('jobType', 'timer')
        api.noticeError(new Error('record an error'))
        agent.getTransaction().end()

        const errorTraces = getErrorTraces(agent.errors)

        t.equal(errorTraces.length, 1)
        t.equal(errorTraces[0][2], 'record an error')
      })
    })

    t.test('should generate expected error metric for expected errors', (t) => {
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.EXPECTED)
      t.equal(metric.callCount, 2)
      t.end()
    })

    t.test('should not generate expected error metric for unexpected errors', (t) => {
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.EXPECTED)
      t.notOk(metric)
      t.end()
    })

    t.test('should not generate expected error metric for ignored errors', (t) => {
      agent.config.error_collector.expected_classes = ['Error']
      agent.config.error_collector.ignore_classes = ['Error'] // takes precedence
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.EXPECTED)
      t.notOk(metric)
      t.end()
    })

    t.test('should generate all error metric for unexpected errors', (t) => {
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.ALL)
      t.equal(metric.callCount, 2)
      t.end()
    })

    t.test('should not generate all error metric for expected errors', (t) => {
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.ALL)
      t.notOk(metric)
      t.end()
    })

    t.test('should not generate all error metric for ignored errors', (t) => {
      agent.config.error_collector.ignore_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.ALL)
      t.notOk(metric)
      t.end()
    })

    t.test('should generate web error metric for unexpected web errors', (t) => {
      const transaction = createWebTransaction(agent)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.WEB)
      t.equal(metric.callCount, 2)
      t.end()
    })

    t.test('should not generate web error metric for expected web errors', (t) => {
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.WEB)
      t.notOk(metric)
      t.end()
    })

    t.test('should not generate web error metric for ignored web errors', (t) => {
      agent.config.error_collector.ignore_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.WEB)
      t.notOk(metric)
      t.end()
    })

    t.test('should not generate web error metric for unexpected non-web errors', (t) => {
      const transaction = createBackgroundTransaction(agent)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.WEB)
      t.notOk(metric)
      t.end()
    })

    t.test('should generate other error metric for unexpected non-web errors', (t) => {
      const transaction = createBackgroundTransaction(agent)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.OTHER)
      t.equal(metric.callCount, 2)
      t.end()
    })

    t.test('should not generate other error metric for expected non-web errors', (t) => {
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createBackgroundTransaction(agent)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.OTHER)
      t.notOk(metric)
      t.end()
    })

    t.test('should not generate other error metric for ignored non-web errors', (t) => {
      agent.config.error_collector.ignore_classes = ['Error']
      const transaction = createBackgroundTransaction(agent)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.OTHER)
      t.notOk(metric)
      t.end()
    })

    t.test('should not generate other error metric for unexpected web errors', (t) => {
      const transaction = createWebTransaction(agent)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.OTHER)
      t.notOk(metric)
      t.end()
    })

    t.test('clearAll()', (t) => {
      let aggregator

      t.beforeEach(() => {
        aggregator = agent.errors
      })

      t.test('clears collected errors', (t) => {
        aggregator.add(null, new Error('error1'))

        t.equal(getErrorTraces(aggregator).length, 1)
        t.equal(getErrorEvents(aggregator).length, 1)

        aggregator.clearAll()

        t.equal(getErrorTraces(aggregator).length, 0)
        t.equal(getErrorEvents(aggregator).length, 0)
        t.end()
      })
      t.end()
    })
  })

  t.test('traced errors', (t) => {
    t.autoend()
    let aggregator

    t.beforeEach(() => {
      aggregator = agent.errors
    })

    t.test('without transaction', (t) => {
      t.autoend()
      t.test('should contain no intrinsic attributes', (t) => {
        const error = new Error('some error')
        aggregator.add(null, error)

        const errorTraces = getErrorTraces(aggregator)
        t.equal(errorTraces.length, 1)

        const attributes = getFirstErrorIntrinsicAttributes(aggregator, t)
        t.ok(typeof attributes === 'object')
        t.end()
      })

      t.test('should contain supplied custom attributes, with filter rules', (t) => {
        agent.config.error_collector.attributes.exclude.push('c')
        agent.config.emit('error_collector.attributes.exclude')
        const error = new Error('some error')
        const customAttributes = { a: 'b', c: 'ignored' }
        aggregator.add(null, error, customAttributes)

        const attributes = getFirstErrorCustomAttributes(aggregator, t)
        t.equal(attributes.a, 'b')
        t.notOk(attributes.c)
        t.end()
      })
    })

    t.test('on transaction finished', (t) => {
      t.autoend()
      t.test('should generate an event if the transaction is an HTTP error', (t) => {
        const transaction = createTransaction(agent, 500)
        aggregator.add(transaction)

        transaction.end()
        const collectedError = getErrorTraces(aggregator)[0]
        t.ok(collectedError)
        t.end()
      })

      t.test('should contain CAT intrinsic parameters', (t) => {
        agent.config.cross_application_tracer.enabled = true
        agent.config.distributed_tracing.enabled = false

        const transaction = createTransaction(agent, 200)

        transaction.referringTransactionGuid = '1234'
        transaction.incomingCatId = '2345'

        const error = new Error('some error')
        aggregator.add(transaction, error)

        transaction.end()
        const attributes = getFirstErrorIntrinsicAttributes(aggregator, t)

        t.ok(typeof attributes === 'object')
        t.ok(typeof attributes.path_hash === 'string')
        t.equal(attributes.referring_transaction_guid, '1234')
        t.equal(attributes.client_cross_process_id, '2345')
        t.end()
      })

      t.test('should contain DT intrinsic parameters', (t) => {
        agent.config.distributed_tracing.enabled = true
        agent.config.primary_application_id = 'test'
        agent.config.account_id = 1
        const transaction = createTransaction(agent, 200)

        const error = new Error('some error')
        aggregator.add(transaction, error)

        transaction.end()
        const attributes = getFirstErrorIntrinsicAttributes(aggregator, t)

        t.ok(typeof attributes === 'object')
        t.equal(attributes.traceId, transaction.traceId)
        t.equal(attributes.guid, transaction.id)
        t.equal(attributes.priority, transaction.priority)
        t.equal(attributes.sampled, transaction.sampled)
        t.notOk(attributes.parentId)
        t.notOk(attributes.parentSpanId)
        t.equal(transaction.sampled, true)
        t.ok(transaction.priority > 1)
        t.end()
      })

      t.test('should contain DT intrinsic parameters', (t) => {
        agent.config.distributed_tracing.enabled = true
        agent.config.primary_application_id = 'test'
        agent.config.account_id = 1
        const transaction = createTransaction(agent, 200)
        const payload = transaction._createDistributedTracePayload().text()
        transaction.isDistributedTrace = null
        transaction._acceptDistributedTracePayload(payload)

        const error = new Error('some error')
        aggregator.add(transaction, error)

        transaction.end()
        const attributes = getFirstErrorIntrinsicAttributes(aggregator, t)

        t.ok(typeof attributes === 'object')
        t.equal(attributes.traceId, transaction.traceId)
        t.equal(attributes.guid, transaction.id)
        t.equal(attributes.priority, transaction.priority)
        t.equal(attributes.sampled, transaction.sampled)
        t.equal(attributes['parent.type'], 'App')
        t.equal(attributes['parent.app'], agent.config.primary_application_id)
        t.equal(attributes['parent.account'], agent.config.account_id)
        t.notOk(attributes.parentId)
        t.notOk(attributes.parentSpanId)
        t.end()
      })

      t.test('should contain Synthetics intrinsic parameters', (t) => {
        const transaction = createTransaction(agent, 200)

        transaction.syntheticsData = {
          version: 1,
          accountId: 123,
          resourceId: 'resId',
          jobId: 'jobId',
          monitorId: 'monId'
        }

        const error = new Error('some error')
        aggregator.add(transaction, error)

        transaction.end()
        const attributes = getFirstErrorIntrinsicAttributes(aggregator, t)

        t.ok(typeof attributes === 'object')
        t.equal(attributes.synthetics_resource_id, 'resId')
        t.equal(attributes.synthetics_job_id, 'jobId')
        t.equal(attributes.synthetics_monitor_id, 'monId')
        t.end()
      })

      t.test('should contain custom parameters', (t) => {
        const transaction = createTransaction(agent, 500)
        const error = new Error('some error')
        const customParameters = { a: 'b' }
        aggregator.add(transaction, error, customParameters)

        transaction.end()
        const attributes = getFirstErrorCustomAttributes(aggregator, t)
        t.equal(attributes.a, 'b')
        t.end()
      })

      t.test('should merge supplied custom params with those on the trace', (t) => {
        agent.config.attributes.enabled = true
        const transaction = createTransaction(agent, 500)
        transaction.trace.addCustomAttribute('a', 'b')
        const error = new Error('some error')

        const customParameters = { c: 'd' }
        aggregator.add(transaction, error, customParameters)

        transaction.end()
        const attributes = getFirstErrorCustomAttributes(aggregator, t)
        t.equal(attributes.a, 'b')
        t.equal(attributes.c, 'd')
        t.end()
      })
      t.end()
    })
  })

  t.test('error events', (t) => {
    t.autoend()
    let aggregator

    t.beforeEach(() => {
      aggregator = agent.errors
    })

    t.test('should omit the error message when in high security mode', (t) => {
      agent.config.high_security = true
      agent.errors.add(null, new Error('some error'))
      const events = getErrorEvents(agent.errors)
      t.equal(events[0][0]['error.message'], '')
      agent.config.high_security = false
      t.end()
    })

    t.test('not spill over reservoir size', (t) => {
      if (agent) {
        helper.unloadAgent(agent)
      }
      agent = helper.loadMockedAgent({ error_collector: { max_event_samples_stored: 10 } })

      for (let i = 0; i < 20; i++) {
        agent.errors.add(null, new Error('some error'))
      }

      const events = getErrorEvents(agent.errors)
      t.equal(events.length, 10)
      t.end()
    })

    t.test('without transaction', (t) => {
      t.test('using add()', (t) => {
        t.test('should contain intrinsic attributes', (t) => {
          const error = new Error('some error')
          const nowSeconds = Date.now() / 1000
          aggregator.add(null, error)

          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.ok(typeof attributes === 'object')
          t.equal(attributes.type, 'TransactionError')
          t.ok(typeof attributes['error.class'] === 'string')
          t.ok(typeof attributes['error.message'] === 'string')
          t.ok(Math.abs(attributes.timestamp - nowSeconds) <= 1)
          t.equal(attributes.transactionName, 'Unknown')
          t.end()
        })

        t.test('should not contain guid intrinsic attributes', (t) => {
          const error = new Error('some error')
          aggregator.add(null, error)

          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.notOk(attributes.guid)
          t.end()
        })

        t.test('should set transactionName to Unknown', (t) => {
          const error = new Error('some error')
          aggregator.add(null, error)

          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes.transactionName, 'Unknown')
          t.end()
        })

        t.test('should contain supplied custom attributes, with filter rules', (t) => {
          agent.config.attributes.enabled = true
          agent.config.attributes.exclude.push('c')
          agent.config.emit('attributes.exclude')
          const error = new Error('some error')
          const customAttributes = { a: 'b', c: 'ignored' }
          aggregator.add(null, error, customAttributes)

          const attributes = getFirstEventCustomAttributes(aggregator, t)
          t.equal(Object.keys(attributes).length, 1)
          t.equal(attributes.a, 'b')
          t.notOk(attributes.c)
          t.end()
        })

        t.test('should contain agent attributes', (t) => {
          agent.config.attributes.enabled = true
          const error = new Error('some error')
          aggregator.add(null, error, { a: 'a' })

          const agentAttributes = getFirstEventAgentAttributes(aggregator, t)
          const customAttributes = getFirstEventCustomAttributes(aggregator, t)

          t.equal(Object.keys(customAttributes).length, 1)
          t.equal(Object.keys(agentAttributes).length, 0)
          t.end()
        })
        t.end()
      })

      t.test('using noticeError() API', (t) => {
        let api
        t.beforeEach(() => {
          api = new API(agent)
        })

        t.test('should contain intrinsic parameters', (t) => {
          const error = new Error('some error')
          const nowSeconds = Date.now() / 1000
          api.noticeError(error)

          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.ok(typeof attributes === 'object')
          t.equal(attributes.type, 'TransactionError')
          t.ok(typeof attributes['error.class'] === 'string')
          t.ok(typeof attributes['error.message'] === 'string')
          t.ok(Math.abs(attributes.timestamp - nowSeconds) <= 1)
          t.equal(attributes.transactionName, 'Unknown')
          t.end()
        })

        t.test('should set transactionName to Unknown', (t) => {
          const error = new Error('some error')
          api.noticeError(error)

          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes.transactionName, 'Unknown')
          t.end()
        })

        t.test('should contain expected attributes, with filter rules', (t) => {
          agent.config.attributes.enabled = true
          agent.config.attributes.exclude = ['c']
          agent.config.emit('attributes.exclude')
          const error = new Error('some error')
          let customAttributes = { a: 'b', c: 'ignored' }
          api.noticeError(error, customAttributes)

          const agentAttributes = getFirstEventAgentAttributes(aggregator, t)
          customAttributes = getFirstEventCustomAttributes(aggregator, t)

          t.equal(Object.keys(customAttributes).length, 1)
          t.notOk(customAttributes.c)
          t.equal(Object.keys(agentAttributes).length, 0)
          t.end()
        })

        t.test('should preserve expected flag for noticeError', (t) => {
          const error = new Error('some noticed error')
          api.noticeError(error, null, true)

          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes['error.expected'], true)
          t.end()
        })
        t.test('unexpected noticeError should default to expected: false', (t) => {
          const error = new Error('another noticed error')
          api.noticeError(error)

          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes['error.expected'], false)
          t.end()
        })
        t.test('noticeError expected:true should be definable without customAttributes', (t) => {
          const error = new Error('yet another noticed expected error')
          api.noticeError(error, true)

          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes['error.expected'], true)
          t.end()
        })
        t.test('noticeError expected:false should be definable without customAttributes', (t) => {
          const error = new Error('yet another noticed unexpected error')
          api.noticeError(error, false)

          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes['error.expected'], false)
          t.end()
        })
        t.test(
          'noticeError should not interfere with agentAttributes and customAttributes',
          (t) => {
            const error = new Error('and even yet another noticed error')
            let customAttributes = { a: 'b', c: 'd' }

            api.noticeError(error, customAttributes, true)

            const agentAttributes = getFirstEventAgentAttributes(aggregator, t)
            const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
            customAttributes = getFirstEventCustomAttributes(aggregator, t)

            t.equal(Object.keys(customAttributes).length, 2)
            t.ok(customAttributes.c)
            t.equal(attributes['error.expected'], true)
            t.equal(Object.keys(agentAttributes).length, 0)
            t.end()
          }
        )
        t.end()
      })
      t.end()
    })

    t.test('on transaction finished', (t) => {
      t.test('should generate an event if the transaction is an HTTP error', (t) => {
        const transaction = createTransaction(agent, 500)
        aggregator.add(transaction)

        transaction.end()

        const errorEvents = getErrorEvents(aggregator)
        const collectedError = errorEvents[0]
        t.ok(collectedError)
        t.end()
      })

      t.test('should contain required intrinsic attributes', (t) => {
        const transaction = createTransaction(agent, 200)

        const error = new Error('some error')
        const nowSeconds = Date.now() / 1000
        aggregator.add(transaction, error)

        transaction.end()
        const attributes = getFirstEventIntrinsicAttributes(aggregator, t)

        t.ok(typeof attributes === 'object')
        t.equal(attributes.type, 'TransactionError')
        t.ok(typeof attributes['error.class'] === 'string')
        t.ok(typeof attributes['error.message'] === 'string')
        t.equal(attributes.guid, transaction.id)
        t.ok(Math.abs(attributes.timestamp - nowSeconds) <= 1)
        t.equal(attributes.transactionName, transaction.name)
        t.end()
      })

      t.test('transaction-specific intrinsic attributes on a transaction', (t) => {
        let transaction
        let error

        t.beforeEach(() => {
          transaction = createTransaction(agent, 500)
          error = new Error('some error')
          aggregator.add(transaction, error)
        })

        t.test('includes transaction duration', (t) => {
          transaction.end()
          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes.duration, transaction.timer.getDurationInMillis() / 1000)
          t.end()
        })

        t.test('includes queueDuration if available', (t) => {
          transaction.measure(NAMES.QUEUETIME, null, 100)
          transaction.end()
          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes.queueDuration, 0.1)
          t.end()
        })

        t.test('includes externalDuration if available', (t) => {
          transaction.measure(NAMES.EXTERNAL.ALL, null, 100)
          transaction.end()
          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes.externalDuration, 0.1)
          t.end()
        })

        t.test('includes databaseDuration if available', (t) => {
          transaction.measure(NAMES.DB.ALL, null, 100)
          transaction.end()
          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes.databaseDuration, 0.1)
          t.end()
        })

        t.test('includes externalCallCount if available', (t) => {
          transaction.measure(NAMES.EXTERNAL.ALL, null, 100)
          transaction.measure(NAMES.EXTERNAL.ALL, null, 100)
          transaction.end()
          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes.externalCallCount, 2)
          t.end()
        })

        t.test('includes databaseCallCount if available', (t) => {
          transaction.measure(NAMES.DB.ALL, null, 100)
          transaction.measure(NAMES.DB.ALL, null, 100)
          transaction.end()
          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes.databaseCallCount, 2)
          t.end()
        })

        t.test('includes internal synthetics attributes', (t) => {
          transaction.syntheticsData = {
            version: 1,
            accountId: 123,
            resourceId: 'resId',
            jobId: 'jobId',
            monitorId: 'monId'
          }
          transaction.end()
          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes['nr.syntheticsResourceId'], 'resId')
          t.equal(attributes['nr.syntheticsJobId'], 'jobId')
          t.equal(attributes['nr.syntheticsMonitorId'], 'monId')
          t.end()
        })

        t.test('includes internal transactionGuid attribute', (t) => {
          transaction.end()
          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes['nr.transactionGuid'], transaction.id)
          t.end()
        })

        t.test('includes guid attribute', (t) => {
          transaction.end()
          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes.guid, transaction.id)
          t.end()
        })

        t.test('includes traceId attribute', (t) => {
          transaction.referringTransactionGuid = '1234'
          transaction.end()
          const attributes = getFirstEventIntrinsicAttributes(aggregator, t)
          t.equal(attributes.traceId, transaction.traceId)
          t.end()
        })

        t.test('includes http port if the transaction is a web transaction', (t) => {
          const http = require('http')

          helper.unloadAgent(agent)
          agent = helper.instrumentMockedAgent()

          const server = http.createServer(function createServerCb(req, res) {
            t.ok(agent.getTransaction())
            // Return HTTP error, so that when the transaction ends, an error
            // event is generated.
            res.statusCode = 500
            res.end()
          })

          server.listen(0, 'localhost', () => {
            const port = server.address().port
            http.get({ port: port, host: 'localhost' })
          })

          agent.on('transactionFinished', function (tx) {
            process.nextTick(() => {
              const attributes = getFirstEventIntrinsicAttributes(agent.errors, t)
              t.equal(attributes.port, tx.port)

              server.close()
              t.end()
            })
          })
        })
        t.end()
      })

      t.test('should contain custom attributes, with filter rules', (t) => {
        agent.config.attributes.exclude.push('c')
        agent.config.emit('attributes.exclude')
        const transaction = createTransaction(agent, 500)
        const error = new Error('some error')
        const customAttributes = { a: 'b', c: 'ignored' }
        aggregator.add(transaction, error, customAttributes)

        transaction.end()
        const attributes = getFirstEventCustomAttributes(aggregator, t)
        t.equal(attributes.a, 'b')
        t.notOk(attributes.c)
        t.end()
      })

      t.test('should merge new custom attrs with trace custom attrs', (t) => {
        const transaction = createTransaction(agent, 500)
        transaction.trace.addCustomAttribute('a', 'b')
        const error = new Error('some error')

        const customAttributes = { c: 'd' }
        aggregator.add(transaction, error, customAttributes)

        transaction.end()
        const attributes = getFirstEventCustomAttributes(aggregator, t)
        t.equal(Object.keys(attributes).length, 2)
        t.equal(attributes.a, 'b')
        t.equal(attributes.c, 'd')
        t.end()
      })

      t.test('should contain agent attributes', (t) => {
        agent.config.attributes.enabled = true
        const transaction = createTransaction(agent, 500)
        transaction.trace.attributes.addAttribute(DESTS.TRANS_SCOPE, 'host.displayName', 'myHost')
        const error = new Error('some error')
        aggregator.add(transaction, error, { a: 'a' })

        transaction.end()
        const agentAttributes = getFirstEventAgentAttributes(aggregator, t)
        const customAttributes = getFirstEventCustomAttributes(aggregator, t)

        t.equal(Object.keys(customAttributes).length, 1)
        t.equal(customAttributes.a, 'a')
        t.equal(Object.keys(agentAttributes).length, 1)
        t.equal(agentAttributes['host.displayName'], 'myHost')
        t.end()
      })
      t.end()
    })
  })
})

function getErrorTraces(errorCollector) {
  return errorCollector.traceAggregator.errors
}

function getErrorEvents(errorCollector) {
  return errorCollector.eventAggregator.getEvents()
}

function getFirstErrorIntrinsicAttributes(aggregator, t) {
  return getFirstError(aggregator, t)[4].intrinsics
}

function getFirstErrorCustomAttributes(aggregator, t) {
  return getFirstError(aggregator, t)[4].userAttributes
}

function getFirstError(aggregator, t) {
  const errors = getErrorTraces(aggregator)
  t.equal(errors.length, 1)
  return errors[0]
}

function getFirstEventIntrinsicAttributes(aggregator, t) {
  return getFirstEvent(aggregator, t)[0]
}

function getFirstEventCustomAttributes(aggregator, t) {
  return getFirstEvent(aggregator, t)[1]
}

function getFirstEventAgentAttributes(aggregator, t) {
  return getFirstEvent(aggregator, t)[2]
}

function getFirstEvent(aggregator, t) {
  const events = getErrorEvents(aggregator)
  t.equal(events.length, 1)
  return events[0]
}

test('When using the async listener', (t) => {
  t.autoend()

  let agent = null
  let transaction = null
  let active = null
  let json = null

  t.beforeEach((t) => {
    agent = helper.instrumentMockedAgent()

    helper.temporarilyOverrideTapUncaughtBehavior(tap, t)
  })

  t.afterEach(() => {
    transaction.end()

    helper.unloadAgent(agent)
    agent = null
    transaction = null
    active = null
    json = null
  })

  t.test('should not have a domain active', (t) => {
    executeThrowingTransaction(() => {
      t.notOk(active)
      t.end()
    })
  })

  t.test('should find a single error', (t) => {
    executeThrowingTransaction(() => {
      const errorTraces = getErrorTraces(agent.errors)
      t.equal(errorTraces.length, 1)
      t.end()
    })
  })

  t.test('should find traced error', (t) => {
    executeThrowingTransaction(() => {
      t.ok(json)
      t.end()
    })
  })

  t.test('should have 6 elements in the trace', (t) => {
    executeThrowingTransaction(() => {
      t.equal(json.length, 6)
      t.end()
    })
  })

  t.test('should have the default name', (t) => {
    executeThrowingTransaction(() => {
      const { 1: name } = json
      t.equal(name, 'Unknown')
      t.end()
    })
  })

  t.test("should have the error's message", (t) => {
    executeThrowingTransaction(() => {
      const { 2: message } = json
      t.equal(message, 'sample error')
      t.end()
    })
  })

  t.test("should have the error's constructor name (type)", (t) => {
    executeThrowingTransaction(() => {
      const { 3: name } = json
      t.equal(name, 'Error')
      t.end()
    })
  })

  t.test('should default to passing the stack trace as a parameter', (t) => {
    executeThrowingTransaction(() => {
      const { 4: params } = json
      t.ok(params)
      t.ok(params.stack_trace)
      t.equal(params.stack_trace[0], 'Error: sample error')
      t.end()
    })
  })

  function executeThrowingTransaction(handledErrorCallback) {
    process.nextTick(() => {
      process.once('uncaughtException', () => {
        const errorTraces = getErrorTraces(agent.errors)
        json = errorTraces[0]

        return handledErrorCallback()
      })

      const disruptor = agent.tracer.transactionProxy(function transactionProxyCb() {
        transaction = agent.getTransaction()
        active = process.domain

        // trigger the error handler
        throw new Error('sample error')
      })

      disruptor()
    })
  }
})
