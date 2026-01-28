/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const loggerMock = require('../../mocks/logger')
const MwWrapper = require('#agentlib/subscribers/middleware-wrapper.js')
const helper = require('#testlib/agent_helper.js')
const { transactionInfo } = require('#agentlib/symbols.js')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = loggerMock()
  const wrapper = new MwWrapper({ agent, logger, system: 'UnitTest' })
  function handler (arg1, arg2, arg3) {
    return `${arg2}, ${arg3}`
  }
  const origExtractTxInfo = wrapper.extractTxInfo
  ctx.nr = {
    agent,
    handler,
    logger,
    wrapper
  }

  wrapper.extractTxInfo = function() {
    const data = origExtractTxInfo.apply(this, arguments)
    ctx.nr.txInfo = data.txInfo
    return data
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})
test('should not wrap handler if it is not a function', function (t) {
  const { logger, wrapper } = t.nr
  const handler = 'test'
  const wrapped = wrapper.wrap({ handler })
  assert.equal(wrapped, handler)
  assert.deepEqual(logger.trace.args[0], ['Handler: %s is not a function, not wrapping.', 'test'])
})

test('should wrap handler if it is a function', function (t) {
  const { logger, handler, wrapper } = t.nr
  const wrapped = wrapper.wrap({ handler })
  assert.equal(wrapped.name, 'handler')
  assert.equal(wrapped.length, 3)
  assert.equal(logger.trace.callCount, 0)
})

test('should not run wrapped handler in context if transaction not present', function (t) {
  const { handler, wrapper } = t.nr
  const wrapped = wrapper.wrap({ handler })
  const result = wrapped({}, 'one', 'two')
  assert.equal(result, 'one, two')
})

test('should run wrapped handler in context if transaction present, and properly name segment', function (t, end) {
  const { agent, handler, wrapper } = t.nr
  const route = '/test/url'
  const wrapped = wrapper.wrap({ handler, route })
  const request = {}
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    tx.url = route
    const result = wrapped(request, 'one', 'two')
    assert.equal(result, 'one, two')

    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    assert.equal(segment.name, 'Nodejs/Middleware/UnitTest/handler//test/url')
    tx.statusCode = 200
    tx.end()
    assert.equal(tx.name, 'WebTransaction/WebFrameworkUri/UnitTest/test/url')
    end()
  })
})

test('should handle error when passed in to done handler', function (t, end) {
  const { agent, wrapper } = t.nr
  const error = new Error('test error')
  function handler (req, res, next) {
    next(error)
  }
  const route = '/test/url'
  const wrapped = wrapper.wrap({ handler, route })
  const request = {}
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    tx.url = route
    wrapped(request, 'one', function() {})
    assert.deepEqual(t.nr.txInfo.error, error)
    assert.equal(t.nr.txInfo.errorHandled, false)

    tx.end()
    end()
  })
})

test('should handle error when passed in to done handler `request.raw`', function (t, end) {
  const { agent, wrapper } = t.nr
  const error = new Error('test error')
  function handler (req, res, next) {
    next(error)
  }
  const route = '/test/url'
  const wrapped = wrapper.wrap({ handler, route })
  const request = { raw: { [transactionInfo]: {} } }
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    tx.url = route
    wrapped(request, 'one', function() {})
    assert.deepEqual(t.nr.txInfo.error, error)
    assert.equal(t.nr.txInfo.errorHandled, false)
    assert.deepEqual(request.raw[transactionInfo], t.nr.txInfo)
    tx.end()
    end()
  })
})

test('should handle error when passed in to done handler `request`', function (t, end) {
  const { agent, wrapper } = t.nr
  const error = new Error('test error')
  function handler (req, res, next) {
    next(error)
  }
  const route = '/test/url'
  const wrapped = wrapper.wrap({ handler, route })
  const request = { [transactionInfo]: {} }
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    tx.url = route
    wrapped(request, 'one', function() {})
    assert.deepEqual(t.nr.txInfo.error, error)
    assert.equal(t.nr.txInfo.errorHandled, false)
    assert.deepEqual(request[transactionInfo], t.nr.txInfo)
    tx.end()
    end()
  })
})

test('should handle error when passed in to done handler but mark error handled when error ware', function (t, end) {
  const { agent, wrapper } = t.nr
  const error = new Error('test error')
  function handler (err, req, res, next) {
    next(err)
  }
  const route = '/test/url'
  const wrapped = wrapper.wrap({ handler, route })
  const request = {}
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    tx.url = route
    wrapped(error, request, 'one', function() {})
    assert.deepEqual(t.nr.txInfo.error, error)
    assert.equal(t.nr.txInfo.errorHandled, true)
    tx.end()
    end()
  })
})

test('should not handle error when no error is passed to done handler', function (t, end) {
  const { agent, wrapper } = t.nr
  function handler (req, res, next) {
    next()
  }
  const route = '/test/url'
  const request = {}
  const wrapped = wrapper.wrap({ handler, route })
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    tx.url = route
    wrapped(request, 'one', function() {})
    assert.deepEqual(t.nr.txInfo, {})

    tx.end()
    end()
  })
})

test('should not handle error when isError is not using default handler', function (t, end) {
  const { agent, wrapper } = t.nr
  const error = new Error('test error')
  function handler (req, res, next) {
    next(error)
  }
  const route = '/test/url'
  const request = {}
  const wrapped = wrapper.wrap({ handler, route })
  wrapper.isError = function(err) {
    return err.message !== 'test error'
  }
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    tx.url = route
    wrapped(request, 'one', function() {})
    assert.deepEqual(t.nr.txInfo, {})
    tx.end()
    end()
  })
})
