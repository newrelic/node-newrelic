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

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = loggerMock()
  const wrapper = new MwWrapper({ agent, logger, system: 'UnitTest' })
  function handler (arg1, arg2, arg3) {
    return `${arg1}, ${arg2}, ${arg3}`
  }
  const txInfo = {}
  wrapper.extractTxInfo = function() {
    const request = {}
    return { txInfo, request, errorWare: false }
  }
  ctx.nr = {
    agent,
    handler,
    logger,
    txInfo,
    wrapper
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
  const result = wrapped('one', 'two', 'three')
  assert.equal(result, 'one, two, three')
})

test('should run wrapped handler in context if transaction present, and properly name segment', function (t, end) {
  const { agent, handler, wrapper } = t.nr
  const route = '/test/url'
  const wrapped = wrapper.wrap({ handler, route })
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    tx.url = route
    const result = wrapped('one', 'two', 'three')
    assert.equal(result, 'one, two, three')

    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    assert.equal(segment.name, 'Nodejs/Middleware/UnitTest/handler//test/url')
    tx.statusCode = 200
    tx.end()
    assert.equal(tx.name, 'WebTransaction/WebFrameworkUri/UnitTest/test/url')
    end()
  })
})

test('should handle error when passed in to done handler', function (t, end) {
  const { agent, txInfo, wrapper } = t.nr
  const error = new Error('test error')
  function handler (req, res, next) {
    next(error)
  }
  const route = '/test/url'
  const wrapped = wrapper.wrap({ handler, route })
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    tx.url = route
    wrapped('one', 'two', function() {})
    assert.deepEqual(txInfo.error, error)
    assert.equal(txInfo.errorHandled, false)

    tx.end()
    end()
  })
})

test('should not handle error when no error is passed to done handler', function (t, end) {
  const { agent, txInfo, wrapper } = t.nr
  function handler (req, res, next) {
    next()
  }
  const route = '/test/url'
  const wrapped = wrapper.wrap({ handler, route })
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    tx.url = route
    wrapped('one', 'two', function() {})
    assert.deepEqual(txInfo, {})

    tx.end()
    end()
  })
})

test('should not handle error when isError is not using default handler', function (t, end) {
  const { agent, txInfo, wrapper } = t.nr
  const error = new Error('test error')
  function handler (req, res, next) {
    next(error)
  }
  const route = '/test/url'
  const wrapped = wrapper.wrap({ handler, route })
  wrapper.isError = function(err) {
    return err.message !== 'test error'
  }
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    tx.url = route
    wrapped('one', 'two', function() {})
    assert.deepEqual(txInfo, {})
    tx.end()
    end()
  })
})
