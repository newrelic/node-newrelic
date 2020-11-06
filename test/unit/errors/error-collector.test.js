/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
tap.mochaGlobals()

const expect = require('chai').expect
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
  if (typeof isWeb === 'undefined') isWeb = true

  var transaction = new Transaction(agent)
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

describe('Errors', function() {
  var agent = null

  beforeEach(function() {
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: true
      }
    })
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  describe('agent attribute format', function() {
    var PARAMS = 4
    var trans = null
    var error = null

    beforeEach(function() {
      trans = new Transaction(agent)
      trans.url = '/'

      error = agent.errors
    })

    it('record captured params', function() {
      trans.trace.attributes.addAttribute(
        DESTS.TRANS_SCOPE,
        'request.parameters.a',
        'A'
      )
      error.add(trans, new Error())
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      var params = errorTraces[0][PARAMS]
      expect(params.agentAttributes).deep.equals({'request.parameters.a': 'A'})

      // Error events
      const errorEvents = getErrorEvents(error)
      params = errorEvents[0][2]
      expect(params).deep.equals({'request.parameters.a': 'A'})
    })

    it('records custom parameters', function() {
      trans.trace.addCustomAttribute('a', 'A')
      error.add(trans, new Error())
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      var params = errorTraces[0][PARAMS]

      expect(params.userAttributes).deep.equals({a: 'A'})

      // error events
      const errorEvents = getErrorEvents(error)
      params = errorEvents[0][1]

      expect(params).deep.equals({a: 'A'})
    })

    it('merge custom parameters', function() {
      trans.trace.addCustomAttribute('a', 'A')
      error.add(trans, new Error(), {b: 'B'})
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      var params = errorTraces[0][PARAMS]

      expect(params.userAttributes).deep.equals({
        a: 'A',
        b: 'B'
      })

      // error events
      const errorEvents = getErrorEvents(error)
      params = errorEvents[0][1]

      expect(params).deep.equals({
        a: 'A',
        b: 'B'
      })
    })

    it('overrides existing custom attributes with new custom attributes', function() {
      trans.trace.custom.a = 'A'
      error.add(trans, new Error(), {a: 'AA'})
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      var params = errorTraces[0][PARAMS]

      expect(params.userAttributes).deep.equals({
        a: 'AA'
      })

      // error events
      const errorEvents = getErrorEvents(error)
      params = errorEvents[0][1]

      expect(params).deep.equals({
        a: 'AA'
      })
    })

    it('does not add custom attributes in high security mode', function() {
      agent.config.high_security = true
      error.add(trans, new Error(), {a: 'AA'})
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      var params = errorTraces[0][PARAMS]

      expect(params.userAttributes).deep.equals({})

      // error events
      const errorEvents = getErrorEvents(error)
      params = errorEvents[0][1]

      expect(params).deep.equals({})
    })

    it('redacts the error message in high security mode', function() {
      agent.config.high_security = true
      error.add(trans, new Error('this should not be here'), {a: 'AA'})
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      expect(errorTraces[0][2]).to.equal('')
      expect(errorTraces[0][4].stack_trace[0]).to.equal('Error: <redacted>')
    })

    it('redacts the error message when strip_exception_messages.enabled', function() {
      agent.config.strip_exception_messages.enabled = true
      error.add(trans, new Error('this should not be here'), {a: 'AA'})
      agent.errors.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      expect(errorTraces[0][2]).to.equal('')
      expect(errorTraces[0][4].stack_trace[0]).to.equal('Error: <redacted>')
    })
  })

  describe('display name', function() {
    var PARAMS = 4

    var trans, error

    it('should be in agent attributes if set by user', function() {
      agent.config.process_host.display_name = 'test-value'

      trans = new Transaction(agent)
      trans.url = '/'

      error = agent.errors
      error.add(trans, new Error())
      error.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      var params = errorTraces[0][PARAMS]
      expect(params.agentAttributes).deep.equals({
        'host.displayName': 'test-value'
      })
    })

    it('should not be in agent attributes if not set by user', function() {
      trans = new Transaction(agent)
      trans.url = '/'

      error = agent.errors
      error.add(trans, new Error())
      error.onTransactionFinished(trans)

      const errorTraces = getErrorTraces(error)
      var params = errorTraces[0][PARAMS]
      expect(params.agentAttributes).deep.equals({})
    })
  })

  describe('ErrorCollector', function() {
    let metrics = null
    let errorCollector = null

    beforeEach(function() {
      metrics = new Metrics(5, {}, {})

      errorCollector = new ErrorCollector(
        agent.config,
        new ErrorTraceAggregator({
          periodMs: 60,
          transport: null,
          limit: 20
        }, {}),
        new ErrorEventAggregator({
          periodMs: 60,
          transport: null,
          limit: 20
        }, {}, metrics),
        metrics
      )
    })

    afterEach(() => {
      errorCollector = null
      metrics = null
    })

    it('should preserve the name field on errors', function() {
      var api = new API(agent)

      var testError = new Error("EVERYTHING IS BROKEN")
      testError.name = "GAMEBREAKER"

      api.noticeError(testError)

      const errorTraces = getErrorTraces(agent.errors)
      var error = errorTraces[0]
      expect(error[error.length - 2]).equal(testError.name)
    })

    it('should not gather appliction errors if it is switched off by user config', function() {
      var error = new Error('this error will never be seen')
      agent.config.error_collector.enabled = false

      const errorTraces = getErrorTraces(errorCollector)
      expect(errorTraces.length).equal(0)

      errorCollector.add(null, error)

      expect(errorTraces.length).equal(0)

      agent.config.error_collector.enabled = true
    })

    it('should not gather user errors if it is switched off by user config', function() {
      var error = new Error('this error will never be seen')
      agent.config.error_collector.enabled = false

      const errorTraces = getErrorTraces(errorCollector)
      expect(errorTraces.length).equal(0)

      errorCollector.addUserError(null, error)

      expect(errorTraces.length).equal(0)

      agent.config.error_collector.enabled = true
    })

    it('should not gather errors if it is switched off by server config', function() {
      var error = new Error('this error will never be seen')
      agent.config.collect_errors = false

      const errorTraces = getErrorTraces(errorCollector)
      expect(errorTraces.length).equal(0)

      errorCollector.add(null, error)

      expect(errorTraces.length).equal(0)

      agent.config.collect_errors = true
    })

    it('should gather the same error in two transactions', function() {
      var error = new Error('this happened once')
      var first = new Transaction(agent)
      var second = new Transaction(agent)

      const errorTraces = getErrorTraces(agent.errors)
      expect(errorTraces.length).equal(0)

      agent.errors.add(first, error)
      expect(first.exceptions.length).equal(1)

      agent.errors.add(second, error)
      expect(second.exceptions.length).equal(1)

      first.end()
      expect(errorTraces.length).equal(1)

      second.end()
      expect(errorTraces.length).equal(2)
    })

    it('should not gather the same error twice in the same transaction', function() {
      const error = new Error('this happened once')

      const errorTraces = getErrorTraces(errorCollector)
      expect(errorTraces.length).equal(0)

      errorCollector.add(null, error)
      errorCollector.add(null, error)
      expect(errorTraces.length).equal(1)
    })

    it('should not break on read only objects', function() {
      var error = new Error('this happened once')
      Object.freeze(error)

      const errorTraces = getErrorTraces(errorCollector)
      expect(errorTraces.length).equal(0)

      errorCollector.add(null, error)
      errorCollector.add(null, error)

      expect(errorTraces.length).equal(1)
    })

    describe('add()', function() {
      var aggregator

      beforeEach(function() {
        aggregator = agent.errors
      })

      describe('when handling immutable errors', function() {
        it('should not break', function() {
          var error = new Error()
          Object.freeze(error)
          aggregator.add(error)
        })
      })
    })

    describe('when finalizing transactions', function() {
      let finalizeCollector = null

      beforeEach(function() {
        finalizeCollector = agent.errors
      })

      it('should capture errors for transactions ending in error', function() {
        finalizeCollector.onTransactionFinished(createTransaction(agent, 400))
        finalizeCollector.onTransactionFinished(createTransaction(agent, 500))

        const errorTraces = getErrorTraces(finalizeCollector)
        expect(errorTraces.length).equal(2)
      })

      it('should generate transaction error metric', function() {
        const transaction = createTransaction(agent, 200)

        finalizeCollector.add(transaction, new Error('error1'))
        finalizeCollector.add(transaction, new Error('error2'))

        finalizeCollector.onTransactionFinished(transaction)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        expect(metric.callCount).to.equal(2)
      })

      it('should generate transaction error metric when added from API', function() {
        const api = new API(agent)
        const transaction = createTransaction(agent, 200)

        agent.tracer.getTransaction = function() {
          return transaction
        }

        api.noticeError(new Error('error1'))
        api.noticeError(new Error('error2'))

        finalizeCollector.onTransactionFinished(transaction)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        expect(metric.callCount).to.equal(2)
      })

      it('should not generate transaction error metric for ignored error', function() {
        agent.config.error_collector.ignore_classes = ['Error']
        const transaction = createTransaction(agent, 200)

        finalizeCollector.add(transaction, new Error('error1'))
        finalizeCollector.add(transaction, new Error('error2'))

        finalizeCollector.onTransactionFinished(transaction)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        expect(metric).to.not.exist
      })

      it('should not generate transaction error metric for expected error', function() {
        agent.config.error_collector.expected_classes = ['Error']
        const transaction = createTransaction(agent, 200)

        finalizeCollector.add(transaction, new Error('error1'))
        finalizeCollector.add(transaction, new Error('error2'))

        finalizeCollector.onTransactionFinished(transaction)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        expect(metric).to.not.exist
      })

      it('should ignore errors if related transaction is ignored', function() {
        const transaction = createTransaction(agent, 500)
        transaction.ignore = true

        // add errors by various means
        finalizeCollector.add(transaction, new Error("no"))
        const error = new Error('ignored')
        const exception = new Exception({error})
        transaction.addException(exception)
        finalizeCollector.onTransactionFinished(transaction)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        expect(metric).to.be.undefined
      })

      it('should ignore 404 errors for transactions', function() {
        finalizeCollector.onTransactionFinished(createTransaction(agent, 400))
        // 404 errors are ignored by default
        finalizeCollector.onTransactionFinished(createTransaction(agent, 404))
        finalizeCollector.onTransactionFinished(createTransaction(agent, 404))
        finalizeCollector.onTransactionFinished(createTransaction(agent, 404))
        finalizeCollector.onTransactionFinished(createTransaction(agent, 404))

        const errorTraces = getErrorTraces(finalizeCollector)
        expect(errorTraces.length).equal(1)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        expect(metric.callCount).to.equal(1)
      })

      it('should ignore 404 errors for transactions with exceptions attached', () => {
        var notIgnored = createTransaction(agent, 400)
        const error = new Error('bad request')
        const exception = new Exception({error})
        notIgnored.addException(exception)
        finalizeCollector.onTransactionFinished(notIgnored)

        // 404 errors are ignored by default, but making sure the config is set
        finalizeCollector.config.error_collector.ignore_status_codes = [404]

        let ignored = createTransaction(agent, 404)
        agent.errors.add(ignored, new Error('ignored'))
        finalizeCollector.onTransactionFinished(ignored)

        const errorTraces = getErrorTraces(finalizeCollector)
        expect(errorTraces.length).equal(1)

        const metric = agent.metrics.getMetric('Errors/WebTransaction/TestJS/path')
        expect(metric.callCount).to.equal(1)
      })

      it('should collect exceptions added with noticeError() API even if the status ' +
          'code is in ignore_status_codes config', function() {
        var api = new API(agent)
        var tx = createTransaction(agent, 404)

        agent.tracer.getTransaction = function() {
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
        expect(errorTraces.length).equal(1)
        expect(errorTraces[0][2]).equal('should go through')
      })
    })

    describe('with no exception and no transaction', function() {
      it('should have no errors', function() {
        agent.errors.add(null, null)

        const errorTraces = getErrorTraces(agent.errors)
        expect(errorTraces.length).equal(0)
      })
    })

    describe('with no error and a transaction with status code', function() {
      beforeEach(function() {
        agent.errors.add(new Transaction (agent), null)
      })

      it('should have no errors', function() {
        const errorTraces = getErrorTraces(agent.errors)
        expect(errorTraces.length).equal(0)
      })
    })

    describe('with no error and a transaction with a status code', function() {
      var noErrorStatusTracer
      var errorJSON

      beforeEach(function() {
        noErrorStatusTracer = agent.errors

        var transaction = new Transaction (agent)
        transaction.statusCode = 503 // PDX wut wut

        noErrorStatusTracer.add(transaction, null)
        noErrorStatusTracer.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(noErrorStatusTracer)
        errorJSON = errorTraces[0]
      })

      it('should have one error', function() {
        const errorTraces = getErrorTraces(noErrorStatusTracer)
        expect(errorTraces.length).equal(1)
      })

      it('should not care what time it was traced', function() {
        expect(errorJSON[0]).equal(0)
      })

      it('should have the default scope', function() {
        expect(errorJSON[1]).equal('Unknown')
      })

      it('should have an HTTP status code error message', function() {
        expect(errorJSON[2]).equal('HttpError 503')
      })

      it('should default to a type of Error', function() {
        expect(errorJSON[3]).equal('Error')
      })

      it('should not have a stack trace in the params', function() {
        var params = errorJSON[4]
        expect(params).to.not.have.property('stack_trace')
      })
    })

    describe('with transaction agent attrs, status code, and no error', function() {
      var errorJSON = null
      var params = null

      beforeEach(function() {
        var transaction = new Transaction(agent)
        transaction.statusCode = 501
        transaction.url = '/'
        transaction.trace.attributes.addAttributes(
          DESTS.TRANS_SCOPE,
          {
            test_param: 'a value',
            thing: true
          }
        )

        agent.errors.add(transaction, null)
        agent.errors.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(agent.errors)
        errorJSON = errorTraces[0]
        params = errorJSON[4]
      })

      it('should have one error', function() {
        const errorTraces = getErrorTraces(agent.errors)
        expect(errorTraces.length).equal(1)
      })

      it('should not care what time it was traced', function() {
        expect(errorJSON[0]).equal(0)
      })

      it('should be scoped to the transaction', function() {
        expect(errorJSON[1]).equal('WebTransaction/WebFrameworkUri/(not implemented)')
      })

      it('should have an HTTP status code message', function() {
        expect(errorJSON[2]).equal('HttpError 501')
      })

      it('should default to  a type of Error', function() {
        expect(errorJSON[3]).equal('Error')
      })

      it('should not have a stack trace in the params', function() {
        expect(params).to.not.have.property('stack_trace')
      })

      it('should have a request URL', function() {
        expect(params['request.uri'] = '/test_action.json')
      })

      it('should parse out the first agent parameter', function() {
        expect(params.agentAttributes.test_param).equal('a value')
      })

      it('should parse out the other agent parameter', function() {
        expect(params.agentAttributes.thing).equal(true)
      })
    })

    it('with attributes.enabled disabled', function() {
      var transaction = new Transaction(agent)
      transaction.statusCode = 501

      transaction.url = '/test_action.json?test_param=a%20value&thing'

      agent.errors.add(transaction, null)
      agent.errors.onTransactionFinished(transaction)

      const errorTraces = getErrorTraces(agent.errors)
      var errorJSON = errorTraces[0]
      var params = errorJSON[4]

      expect(params).to.not.have.property('request_params')
    })

    it('with attributes.enabled and attributes.exclude set', function() {
      agent.config.attributes.exclude = ['thing']
      agent.config.emit('attributes.exclude')

      var transaction = new Transaction(agent)
      transaction.statusCode = 501

      transaction.trace.attributes.addAttributes(
        DESTS.TRANS_SCOPE,
        {
          test_param: 'a value',
          thing: 5
        }
      )

      agent.errors.add(transaction, null)
      agent._transactionFinished(transaction)

      const errorTraces = getErrorTraces(agent.errors)
      var errorJSON = errorTraces[0]
      var params = errorJSON[4]

      expect(params.agentAttributes).to.eql({test_param: 'a value'})
    })

    describe('with a thrown TypeError object and no transaction', function() {
      var typeErrorTracer
      var errorJSON


      beforeEach(function() {
        typeErrorTracer = agent.errors

        var exception = new Error('Dare to be the same!')

        typeErrorTracer.add(null, exception)

        const errorTraces = getErrorTraces(agent.errors)
        errorJSON = errorTraces[0]
      })

      it('should have one error', function() {
        const errorTraces = getErrorTraces(agent.errors)
        expect(errorTraces.length).equal(1)
      })

      it('should not care what time it was traced', function() {
        expect(errorJSON[0]).equal(0)
      })

      it('should have the default scope', function() {
        expect(errorJSON[1]).equal('Unknown')
      })

      it('should fish the message out of the exception', function() {
        expect(errorJSON[2]).equal('Dare to be the same!')
      })

      it('should have a type of TypeError', function() {
        expect(errorJSON[3]).equal('Error')
      })

      it('should have a stack trace in the params', function() {
        var params = errorJSON[4]
        expect(params).to.have.property('stack_trace')
        expect(params.stack_trace[0]).equal('Error: Dare to be the same!')
      })
    })

    describe('with a thrown TypeError and a transaction with no params', () => {
      var typeErrorTracer
      var errorJSON


      beforeEach(function() {
        typeErrorTracer = agent.errors

        var transaction = new Transaction(agent)
        var exception = new TypeError('Dare to be different!')

        typeErrorTracer.add(transaction, exception)
        typeErrorTracer.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(typeErrorTracer)
        errorJSON = errorTraces[0]
      })

      it('should have one error', function() {
        const errorTraces = getErrorTraces(typeErrorTracer)
        expect(errorTraces.length).equal(1)
      })

      it('should not care what time it was traced', function() {
        expect(errorJSON[0]).equal(0)
      })

      it('should have the default scope', function() {
        expect(errorJSON[1]).equal('Unknown')
      })

      it('should fish the message out of the exception', function() {
        expect(errorJSON[2]).equal('Dare to be different!')
      })

      it('should have a type of TypeError', function() {
        expect(errorJSON[3]).equal('TypeError')
      })

      it('should have a stack trace in the params', function() {
        var params = errorJSON[4]
        expect(params).to.have.property('stack_trace')
        expect(params.stack_trace[0]).equal('TypeError: Dare to be different!')
      })
    })

    describe('with a thrown `TypeError` and a transaction with agent attrs', function() {
      var errorJSON = null
      var params = null

      beforeEach(function() {
        var transaction = new Transaction(agent)
        var exception = new TypeError('wanted JSON, got XML')

        transaction.trace.attributes.addAttributes(
          DESTS.TRANS_SCOPE,
          {
            test_param: 'a value',
            thing: true
          }
        )
        transaction.url = '/test_action.json'

        agent.errors.add(transaction, exception)
        agent.errors.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(agent.errors)
        errorJSON = errorTraces[0]
        params = errorJSON[4]
      })

      it('should have one error', function() {
        const errorTraces = getErrorTraces(agent.errors)
        expect(errorTraces.length).equal(1)
      })

      it('should not care what time it was traced', function() {
        expect(errorJSON[0]).equal(0)
      })

      it('should have the URL\'s scope', function() {
        expect(errorJSON[1]).equal('WebTransaction/NormalizedUri/*')
      })

      it('should fish the message out of the exception', function() {
        expect(errorJSON[2]).equal('wanted JSON, got XML')
      })

      it('should have a type of TypeError', function() {
        expect(errorJSON[3]).equal('TypeError')
      })

      it('should have a stack trace in the params', function() {
        expect(params).to.have.property('stack_trace')
        expect(params.stack_trace[0]).equal('TypeError: wanted JSON, got XML')
      })

      it('should have a request URL', function() {
        expect(params['request.uri'] = '/test_action.json')
      })

      it('should parse out the first agent parameter', function() {
        expect(params.agentAttributes.test_param).equal('a value')
      })

      it('should parse out the other agent parameter', function() {
        expect(params.agentAttributes.thing).equal(true)
      })
    })

    describe('with a thrown string and a transaction', function() {
      var thrownTracer
      var errorJSON


      beforeEach(function() {
        thrownTracer = agent.errors

        var transaction = new Transaction(agent)
        var exception = 'Dare to be different!'

        thrownTracer.add(transaction, exception)
        thrownTracer.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(thrownTracer)
        errorJSON = errorTraces[0]
      })

      it('should have one error', function() {
        const errorTraces = getErrorTraces(thrownTracer)
        expect(errorTraces.length).equal(1)
      })

      it('should not care what time it was traced', function() {
        expect(errorJSON[0]).equal(0)
      })

      it('should have the default scope', function() {
        expect(errorJSON[1]).equal('Unknown')
      })

      it('should turn the string into the message', function() {
        expect(errorJSON[2]).equal('Dare to be different!')
      })

      it('should default to a type of Error', function() {
        expect(errorJSON[3]).equal('Error')
      })

      it('should have no stack trace', function() {
        expect(errorJSON[4]).to.not.have.property('stack_trace')
      })
    })

    describe('with a thrown string and a transaction with agent parameters', function() {
      var errorJSON = null
      var params = null

      beforeEach(function() {
        var transaction = new Transaction(agent)
        var exception = 'wanted JSON, got XML'

        transaction.trace.attributes.addAttributes(
          DESTS.TRANS_SCOPE,
          {
            test_param: 'a value',
            thing: true
          }
        )

        transaction.url = '/test_action.json'

        agent.errors.add(transaction, exception)
        agent.errors.onTransactionFinished(transaction)

        const errorTraces = getErrorTraces(agent.errors)
        errorJSON = errorTraces[0]
        params = errorJSON[4]
      })

      it('should have one error', function() {
        const errorTraces = getErrorTraces(agent.errors)
        expect(errorTraces.length).equal(1)
      })

      it('should not care what time it was traced', function() {
        expect(errorJSON[0]).equal(0)
      })

      it('should have the transaction\'s name', function() {
        expect(errorJSON[1]).equal('WebTransaction/NormalizedUri/*')
      })

      it('should turn the string into the message', function() {
        expect(errorJSON[2]).equal('wanted JSON, got XML')
      })

      it('should default to a type of Error', function() {
        expect(errorJSON[3]).equal('Error')
      })

      it('should not have a stack trace in the params', function() {
        expect(params).to.not.have.property('stack_trace')
      })

      it('should have a request URL', function() {
        expect(params['request.uri'] = '/test_action.json')
      })

      it('should parse out the first agent parameter', function() {
        expect(params.agentAttributes.test_param).equal('a value')
      })

      it('should parse out the other agent parameter', function() {
        expect(params.agentAttributes.thing).equal(true)
      })
    })

    describe('with an internal server error (500) and an exception', function() {
      let name = 'WebTransaction/Uri/test-request/zxrkbl'
      let error

      beforeEach(function() {
        errorCollector = agent.errors

        let transaction = new Transaction(agent)
        const exception = new Exception({error: new Error('500 test error')})

        transaction.addException(exception)
        transaction.url = '/test-request/zxrkbl'
        transaction.name = 'WebTransaction/Uri/test-request/zxrkbl'
        transaction.statusCode = 500
        transaction.end()
        error = getErrorTraces(errorCollector)[0]
      })

      it('should associate errors with the transaction\'s name', function() {
        var errorName = error[1]

        expect(errorName).equal(name)
      })

      it('should associate errors with a message', function() {
        var message = error[2]

        expect(message).match(/500 test error/)
      })

      it('should associate errors with a message class', function() {
        var messageClass = error[3]

        expect(messageClass).equal('Error')
      })

      it('should associate errors with parameters', function() {
        var params = error[4]

        expect(params).to.exist.and.have.property('stack_trace')
        expect(params.stack_trace[0]).equal('Error: 500 test error')
      })
    })

    describe('with a tracer unavailable (503) error', function() {
      var name = 'WebTransaction/Uri/test-request/zxrkbl'
      var error

      beforeEach(function() {
        errorCollector = agent.errors

        var transaction = new Transaction(agent)
        transaction.url = '/test-request/zxrkbl'
        transaction.name = 'WebTransaction/Uri/test-request/zxrkbl'
        transaction.statusCode = 503
        transaction.end()
        error = getErrorTraces(errorCollector)[0]
      })

      it('should associate errors with the transaction\'s name', function() {
        var errorName = error[1]
        expect(errorName).equal(name)
      })

      it('should associate errors with a message', function() {
        var message = error[2]
        expect(message).equal('HttpError 503')
      })
      it('should associate errors with an error type', function() {
        var messageClass = error[3]
        expect(messageClass).equal('Error')
      })
    })

    it('should allow throwing null', function() {
      var api = new API(agent)

      try {
        api.startBackgroundTransaction('job', function() {
          throw null
        })
      } catch (err) {
        expect(err).equal(null)
      }
    })

    it('should copy parameters from background transactions', function(done) {
      const api = new API(agent)

      api.startBackgroundTransaction('job', function() {
        api.addCustomAttribute('jobType', 'timer')
        api.noticeError(new Error('record an error'))
        agent.getTransaction().end()

        const errorTraces = getErrorTraces(agent.errors)

        expect(errorTraces.length).equal(1)
        expect(errorTraces[0][2]).equal('record an error')
        done()
      })
    })

    it('should generate expected error metric for expected errors', function() {
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.EXPECTED)
      expect(metric.callCount).to.equal(2)
    })

    it('should not generate expected error metric for unexpected errors', function() {
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.EXPECTED)
      expect(metric).to.not.exist
    })

    it('should not generate expected error metric for ignored errors', function() {
      agent.config.error_collector.expected_classes = ['Error']
      agent.config.error_collector.ignore_classes = ['Error'] // takes prescedence
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = agent.metrics.getMetric(NAMES.ERRORS.EXPECTED)
      expect(metric).to.not.exist
    })

    it('should generate all error metric for unexpected errors', function() {
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.ALL)
      expect(metric.callCount).to.equal(2)
    })

    it('should not generate all error metric for expected errors', function() {
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.ALL)
      expect(metric).to.not.exist
    })

    it('should not generate all error metric for ignored errors', function() {
      agent.config.error_collector.ignore_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.ALL)
      expect(metric).to.not.exist
    })

    it('should generate web error metric for unexpected web errors', function() {
      const transaction = createWebTransaction(agent)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.WEB)
      expect(metric.callCount).to.equal(2)
    })

    it('should not generate web error metric for expected web errors', function() {
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.WEB)
      expect(metric).to.not.exist
    })

    it('should not generate web error metric for ignored web errors', function() {
      agent.config.error_collector.ignore_classes = ['Error']
      const transaction = createTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.WEB)
      expect(metric).to.not.exist
    })

    it('should not generate web error metric for unexpected non-web errors', function() {
      const transaction = createBackgroundTransaction(agent)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.WEB)
      expect(metric).to.not.exist
    })

    it('should generate other error metric for unexpected non-web errors', function() {
      const transaction = createBackgroundTransaction(agent)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.OTHER)
      expect(metric.callCount).to.equal(2)
    })

    it('should not generate other error metric for expected non-web errors', function() {
      agent.config.error_collector.expected_classes = ['Error']
      const transaction = createBackgroundTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.OTHER)
      expect(metric).to.not.exist
    })

    it('should not generate other error metric for ignored non-web errors', function() {
      agent.config.error_collector.ignore_classes = ['Error']
      const transaction = createBackgroundTransaction(agent, 200)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.OTHER)
      expect(metric).to.not.exist
    })

    it('should not generate other error metric for unexpected web errors', function() {
      const transaction = createWebTransaction(agent)

      errorCollector.add(transaction, new Error('error1'))
      errorCollector.add(transaction, new Error('error2'))

      errorCollector.onTransactionFinished(transaction)

      const metric = metrics.getMetric(NAMES.ERRORS.OTHER)
      expect(metric).to.not.exist
    })

    describe('clearAll()', function() {
      var aggregator

      beforeEach(function() {
        aggregator = agent.errors
      })

      it('clears collected errors', function() {
        aggregator.add(null, new Error('error1'))

        expect(getErrorTraces(aggregator)).length(1)
        expect(getErrorEvents(aggregator)).length(1)

        aggregator.clearAll()

        expect(getErrorTraces(aggregator)).length(0)
        expect(getErrorEvents(aggregator)).length(0)
      })
    })
  })

  describe('traced errors', function() {
    var aggregator

    beforeEach(function() {
      aggregator = agent.errors
    })

    describe('without transaction', function() {
      it('should contain no intrinsic attributes', function() {
        var error = new Error('some error')
        aggregator.add(null, error)

        const errorTraces = getErrorTraces(aggregator)
        expect(errorTraces).length(1)

        var attributes = getFirstErrorIntrinsicAttributes(aggregator)
        expect(attributes).to.be.a('Object')
      })

      it('should contain supplied custom attributes, with filter rules', function() {
        agent.config.error_collector.attributes.exclude.push('c')
        agent.config.emit('error_collector.attributes.exclude')
        var error = new Error('some error')
        var customAttributes = { a: 'b', c: 'ignored' }
        aggregator.add(null, error, customAttributes)

        var attributes = getFirstErrorCustomAttributes(aggregator)
        expect(attributes.a).equal('b')
        expect(attributes.c).to.be.undefined
      })
    })

    describe('on transaction finished', function() {
      it('should generate an event if the transaction is an HTTP error', function() {
        var transaction = createTransaction(agent, 500)
        aggregator.add(transaction)

        transaction.end()
        var collectedError = getErrorTraces(aggregator)[0]
        expect(collectedError).to.exist
      })

      it('should contain CAT intrinsic parameters', function() {
        var transaction = createTransaction(agent, 200)

        transaction.referringTransactionGuid = '1234'
        transaction.incomingCatId = '2345'

        var error = new Error('some error')
        aggregator.add(transaction, error)

        transaction.end()
        var attributes = getFirstErrorIntrinsicAttributes(aggregator)

        expect(attributes).to.be.a('Object')
        expect(attributes.path_hash).to.be.a('string')
        expect(attributes.referring_transaction_guid).equal('1234')
        expect(attributes.client_cross_process_id).equal('2345')
      })

      it('should contain DT intrinsic parameters', function() {
        agent.config.distributed_tracing.enabled = true
        agent.config.primary_application_id = 'test'
        agent.config.account_id = 1
        var transaction = createTransaction(agent, 200)

        var error = new Error('some error')
        aggregator.add(transaction, error)

        transaction.end()
        var attributes = getFirstErrorIntrinsicAttributes(aggregator)

        expect(attributes).to.be.a('Object')
        expect(attributes.traceId).to.equal(transaction.traceId)
        expect(attributes.guid).to.equal(transaction.id)
        expect(attributes.priority).to.equal(transaction.priority)
        expect(attributes.sampled).to.equal(transaction.sampled)
        expect(attributes.parentId).to.be.undefined
        expect(attributes.parentSpanId).to.be.undefined
        expect(transaction.sampled).to.equal(true)
        expect(transaction.priority).to.be.greaterThan(1)
      })

      it('should contain DT intrinsic parameters', function() {
        agent.config.distributed_tracing.enabled = true
        agent.config.primary_application_id = 'test'
        agent.config.account_id = 1
        let transaction = createTransaction(agent, 200)
        let payload = transaction._createDistributedTracePayload().text()
        transaction.isDistributedTrace = null
        transaction._acceptDistributedTracePayload(payload)

        var error = new Error('some error')
        aggregator.add(transaction, error)

        transaction.end()
        var attributes = getFirstErrorIntrinsicAttributes(aggregator)

        expect(attributes).to.be.a('Object')
        expect(attributes.traceId).to.equal(transaction.traceId)
        expect(attributes.guid).to.equal(transaction.id)
        expect(attributes.priority).to.equal(transaction.priority)
        expect(attributes.sampled).to.equal(transaction.sampled)
        expect(attributes['parent.type']).to.equal('App')
        expect(attributes['parent.app']).to.equal(agent.config.primary_application_id)
        expect(attributes['parent.account']).to.equal(agent.config.account_id)
        expect(attributes.parentId).to.be.undefined
        expect(attributes.parentSpanId).to.be.undefined
      })

      it('should contain Synthetics intrinsic parameters', function() {
        var transaction = createTransaction(agent, 200)

        transaction.syntheticsData = {
          version: 1,
          accountId: 123,
          resourceId: 'resId',
          jobId: 'jobId',
          monitorId: 'monId'
        }

        var error = new Error('some error')
        aggregator.add(transaction, error)

        transaction.end()
        var attributes = getFirstErrorIntrinsicAttributes(aggregator)

        expect(attributes).to.be.a('Object')
        expect(attributes.synthetics_resource_id).equal('resId')
        expect(attributes.synthetics_job_id).equal('jobId')
        expect(attributes.synthetics_monitor_id).equal('monId')
      })

      it('should contain custom parameters', function() {
        var transaction = createTransaction(agent, 500)
        var error = new Error('some error')
        var customParameters = { a: 'b' }
        aggregator.add(transaction, error, customParameters)

        transaction.end()
        var attributes = getFirstErrorCustomAttributes(aggregator)
        expect(attributes.a).equal('b')
      })

      it('should merge supplied custom params with those on the trace', () => {
        agent.config.attributes.enabled = true
        var transaction = createTransaction(agent, 500)
        transaction.trace.addCustomAttribute('a', 'b')
        var error = new Error('some error')

        var customParameters = { c: 'd' }
        aggregator.add(transaction, error, customParameters)

        transaction.end()
        var attributes = getFirstErrorCustomAttributes(aggregator)
        expect(attributes.a).equal('b')
        expect(attributes.c).equal('d')
      })
    })
  })

  describe('error events', function() {
    var aggregator

    beforeEach(function() {
      aggregator = agent.errors
    })

    it('should omit the error message when in high security mode', function() {
      agent.config.high_security = true
      agent.errors.add(null, new Error('some error'))
      var events = getErrorEvents(agent.errors)
      expect(events[0][0]['error.message']).to.equal('')
      agent.config.high_security = false
    })

    it('not spill over reservoir size', function() {
      if (agent) helper.unloadAgent(agent)
      agent = helper.loadMockedAgent({error_collector: {max_event_samples_stored: 10}})

      for (var i = 0; i < 20; i++) {
        agent.errors.add(null, new Error('some error'))
      }

      var events = getErrorEvents(agent.errors)
      expect(events).length(10)
    })

    describe('without transaction', function() {
      describe('using add()', function() {
        it('should contain intrinsic attributes', function() {
          var error = new Error('some error')
          var nowSeconds = Date.now() / 1000
          aggregator.add(null, error)

          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes).to.be.a('Object')
          expect(attributes.type).equal('TransactionError')
          expect(attributes['error.class']).to.be.a('string')
          expect(attributes['error.message']).to.be.a('string')
          expect(attributes.timestamp).closeTo(nowSeconds, 1)
          expect(attributes.transactionName).equal('Unknown')
        })

        it('should set transactionName to Unknown', function() {
          var error = new Error('some error')
          aggregator.add(null, error)

          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes.transactionName).equal('Unknown')
        })

        it('should contain supplied custom attributes, with filter rules', function() {
          agent.config.attributes.enabled = true
          agent.config.attributes.exclude.push('c')
          agent.config.emit('attributes.exclude')
          var error = new Error('some error')
          var customAttributes = { a: 'b', c: 'ignored' }
          aggregator.add(null, error, customAttributes)

          var attributes = getFirstEventCustomAttributes(aggregator)
          expect(Object.keys(attributes)).length(1)
          expect(attributes.a).equal('b')
          expect(attributes.c).to.be.undefined
        })

        it('should contain agent attributes', function() {
          agent.config.attributes.enabled = true
          var error = new Error('some error')
          aggregator.add(null, error, { a: 'a' })

          var agentAttributes = getFirstEventAgentAttributes(aggregator)
          var customAttributes = getFirstEventCustomAttributes(aggregator)

          expect(Object.keys(customAttributes)).length(1)
          expect(Object.keys(agentAttributes)).length(0)
        })
      })

      describe('using noticeError() API', function() {
        var api

        beforeEach(function() {
          api = new API(agent)
        })

        it('should contain intrinsic parameters', function() {
          var error = new Error('some error')
          var nowSeconds = Date.now() / 1000
          api.noticeError(error)

          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes).to.be.a('Object')
          expect(attributes.type).equal('TransactionError')
          expect(attributes['error.class']).to.be.a('string')
          expect(attributes['error.message']).to.be.a('string')
          expect(attributes.timestamp).closeTo(nowSeconds, 1)
          expect(attributes.transactionName).equal('Unknown')
        })

        it('should set transactionName to Unknown', function() {
          var error = new Error('some error')
          api.noticeError(error)

          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes.transactionName).equal('Unknown')
        })

        it('should contain expected attributes, with filter rules', function() {
          agent.config.attributes.enabled = true
          agent.config.attributes.exclude = ['c']
          agent.config.emit('attributes.exclude')
          var error = new Error('some error')
          var customAttributes = { a: 'b', c: 'ignored' }
          api.noticeError(error, customAttributes)

          var agentAttributes = getFirstEventAgentAttributes(aggregator)
          var customAttributes = getFirstEventCustomAttributes(aggregator)

          expect(Object.keys(customAttributes)).length(1)
          expect(customAttributes.c).to.be.undefined
          expect(Object.keys(agentAttributes)).length(0)
        })
      })
    })

    describe('on transaction finished', function() {
      it('should generate an event if the transaction is an HTTP error', function() {
        var transaction = createTransaction(agent, 500)
        aggregator.add(transaction)

        transaction.end()

        const errorEvents = getErrorEvents(aggregator)
        var collectedError = errorEvents[0]
        expect(collectedError).to.exist
      })

      it('should contain required intrinsic attributes', function() {
        var transaction = createTransaction(agent, 200)

        var error = new Error('some error')
        var nowSeconds = Date.now() / 1000
        aggregator.add(transaction, error)

        transaction.end()
        var attributes = getFirstEventIntrinsicAttributes(aggregator)

        expect(attributes).to.be.a('Object')
        expect(attributes.type).equal('TransactionError')
        expect(attributes['error.class']).to.be.a('string')
        expect(attributes['error.message']).to.be.a('string')
        expect(attributes.timestamp).closeTo(nowSeconds, 1)
        expect(attributes.transactionName).equal(transaction.name)
      })

      describe('transaction-specific intrinsic attributes on a transaction', () => {
        var transaction
        var error

        beforeEach(function() {
          transaction = createTransaction(agent, 500)
          error = new Error('some error')
          aggregator.add(transaction, error)
        })

        it('includes transaction duration', function() {
          transaction.end()
          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes.duration)
            .to.equal(transaction.timer.getDurationInMillis() / 1000)
        })

        it('includes queueDuration if available', function() {
          transaction.measure(NAMES.QUEUETIME, null, 100)
          transaction.end()
          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes.queueDuration).equal(0.1)
        })

        it('includes externalDuration if available', function() {
          transaction.measure(NAMES.EXTERNAL.ALL, null, 100)
          transaction.end()
          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes.externalDuration).equal(0.1)
        })

        it('includes databaseDuration if available', function() {
          transaction.measure(NAMES.DB.ALL, null, 100)
          transaction.end()
          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes.databaseDuration).equal(0.1)
        })

        it('includes externalCallCount if available', function() {
          transaction.measure(NAMES.EXTERNAL.ALL, null, 100)
          transaction.measure(NAMES.EXTERNAL.ALL, null, 100)
          transaction.end()
          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes.externalCallCount).equal(2)
        })

        it('includes databaseCallCount if available', function() {
          transaction.measure(NAMES.DB.ALL, null, 100)
          transaction.measure(NAMES.DB.ALL, null, 100)
          transaction.end()
          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes.databaseCallCount).equal(2)
        })

        it('includes internal synthetics attributes', function() {
          transaction.syntheticsData = {
            version: 1,
            accountId: 123,
            resourceId: 'resId',
            jobId: 'jobId',
            monitorId: 'monId'
          }
          transaction.end()
          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes['nr.syntheticsResourceId']).equal('resId')
          expect(attributes['nr.syntheticsJobId']).equal('jobId')
          expect(attributes['nr.syntheticsMonitorId']).equal('monId')
        })

        it('includes internal transactionGuid attribute', function() {
          transaction.end()
          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes['nr.transactionGuid']).equal(transaction.id)
        })

        it('includes internal referringTransactionGuid attribute', function() {
          transaction.referringTransactionGuid = '1234'
          transaction.end()
          var attributes = getFirstEventIntrinsicAttributes(aggregator)
          expect(attributes['nr.referringTransactionGuid'])
            .to.equal(transaction.referringTransactionGuid)
        })

        it('includes http port if the transaction is a web transaction', function(done) {
          var http = require('http')

          helper.unloadAgent(agent)
          agent = helper.instrumentMockedAgent()

          var server = http.createServer(function cb_createServer(req, res) {
            expect(agent.getTransaction()).to.exist
            // Return HTTP error, so that when the transaction ends, an error
            // event is generated.
            res.statusCode = 500
            res.end()
          })

          server.listen(0, 'localhost', function() {
            var port = server.address().port
            http.get({ port: port, host: 'localhost' })
          })

          agent.on('transactionFinished', function(tx) {
            process.nextTick(function() {
              var attributes = getFirstEventIntrinsicAttributes(agent.errors)
              expect(attributes.port).equal(tx.port)

              server.close(done)
            })
          })
        })
      })

      it('should contain custom attributes, with filter rules', function() {
        agent.config.attributes.exclude.push('c')
        agent.config.emit('attributes.exclude')
        var transaction = createTransaction(agent, 500)
        var error = new Error('some error')
        var customAttributes = { a: 'b', c: 'ignored' }
        aggregator.add(transaction, error, customAttributes)

        transaction.end()
        var attributes = getFirstEventCustomAttributes(aggregator)
        expect(attributes.a).equal('b')
        expect(attributes.c).to.be.undefined
      })

      it('should merge new custom attrs with trace custom attrs', function() {
        var transaction = createTransaction(agent, 500)
        transaction.trace.addCustomAttribute('a', 'b')
        var error = new Error('some error')

        var customAttributes = { c: 'd' }
        aggregator.add(transaction, error, customAttributes)

        transaction.end()
        var attributes = getFirstEventCustomAttributes(aggregator)
        expect(Object.keys(attributes)).length(2)
        expect(attributes.a).equal('b')
        expect(attributes.c).equal('d')
      })

      it('should contain agent attributes', function() {
        agent.config.attributes.enabled = true
        var transaction = createTransaction(agent, 500)
        transaction.trace.attributes.addAttribute(
          DESTS.TRANS_SCOPE,
          'host.displayName',
          'myHost'
        )
        var error = new Error('some error')
        aggregator.add(transaction, error, { a: 'a' })

        transaction.end()
        var agentAttributes = getFirstEventAgentAttributes(aggregator)
        var customAttributes = getFirstEventCustomAttributes(aggregator)

        expect(Object.keys(customAttributes)).length(1)
        expect(customAttributes.a).equal('a')
        expect(Object.keys(agentAttributes)).length(1)
        expect(agentAttributes['host.displayName']).equal('myHost')
      })
    })
  })
})

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
  var errors = getErrorTraces(aggregator)
  expect(errors.length).equal(1)
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
  var events = getErrorEvents(aggregator)
  expect(events.length).equal(1)
  return events[0]
}

test('When using the async listener', (t) => {
  t.autoend()

  let agent = null
  let transaction = null
  let active = null
  let json = null

  t.beforeEach((done, t) => {
    agent = helper.instrumentMockedAgent()

    // Once on node 10+ only, may be able to replace with below.
    // t.expectUncaughtException(fn, [expectedError], message, extra)
    // https://node-tap.org/docs/api/asserts/#texpectuncaughtexceptionfn-expectederror-message-extra
    helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

    done()
  })

  t.afterEach(function(done) {
    transaction.end()

    helper.unloadAgent(agent)
    agent = null
    transaction = null
    active = null
    json = null

    done()
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

  t.test('should have 5 elements in the trace', (t) => {
    executeThrowingTransaction(() => {
      t.equal(json.length, 5)
      t.end()
    })
  })

  t.test('should have the default name', (t) => {
    executeThrowingTransaction(() => {
      const {1: name} = json
      t.equal(name, 'Unknown')
      t.end()
    })
  })

  t.test('should have the error\'s message', (t) => {
    executeThrowingTransaction(() => {
      const {2: message} = json
      t.equal(message, 'sample error')
      t.end()
    })
  })

  t.test('should have the error\'s constructor name (type)', (t) => {
    executeThrowingTransaction(() => {
      const {3: name} = json
      t.equal(name, 'Error')
      t.end()
    })
  })

  t.test('should default to passing the stack trace as a parameter', (t) => {
    executeThrowingTransaction(() => {
      const {4: params} = json
      t.ok(params)
      t.ok(params.stack_trace)
      t.equal(params.stack_trace[0], 'Error: sample error')

      t.end()
    })
  })

  function executeThrowingTransaction(handledErrorCallback) {
    process.nextTick(() => {
      process.once('uncaughtException', function() {
        const errorTraces = getErrorTraces(agent.errors)
        json = errorTraces[0]

        return handledErrorCallback()
      })

      const disruptor = agent.tracer.transactionProxy(function cb_transactionProxy() {
        transaction = agent.getTransaction()
        active = process.domain

        // trigger the error handler
        throw new Error('sample error')
      })

      disruptor()
    })
  }
})
