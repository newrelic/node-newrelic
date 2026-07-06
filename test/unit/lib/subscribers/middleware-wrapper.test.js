/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const semver = require('semver')
const loggerMock = require('../../mocks/logger')
const MwWrapper = require('#agentlib/subscribers/middleware-wrapper.js')
const helper = require('#testlib/agent_helper.js')
const { transactionInfo } = require('#agentlib/symbols.js')
const symbols = require('#agentlib/symbols.js')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = loggerMock()
  const wrapper = new MwWrapper({ agent, logger, system: 'UnitTest' })
  function handler (arg1, arg2, arg3) {
    return `${arg2}, ${arg3}`
  }

  function errorHandler(err) {
    if (err) {
      throw err
    }
  }
  const origExtractTxInfo = wrapper.extractTxInfo
  ctx.nr = {
    agent,
    errorHandler,
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
  assert.deepEqual(logger.trace.args[0], ['Handler is not a function, not wrapping.'])
})

test('should not double wrap handler if it is a function', function (t) {
  const { logger, handler, wrapper } = t.nr
  const wrapped = wrapper.wrap({ handler })
  const wrapped2 = wrapper.wrap({ handler: wrapped })
  assert.deepEqual(wrapped, wrapped2)
  assert.deepEqual(logger.trace.args[0], ['Handler is already wrapped, not wrapping.'])
})

test('should wrap handler if it is a function', function (t) {
  const { logger, handler, wrapper } = t.nr
  const wrapped = wrapper.wrap({ handler })
  assert.equal(wrapped.name, 'handler')
  assert.equal(wrapped.length, 3)
  assert.deepEqual(wrapped[symbols.original], handler)
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
  const { agent, wrapper, errorHandler } = t.nr
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
    try {
      wrapped(request, 'one', errorHandler)
    } catch {}

    assert.deepEqual(t.nr.txInfo.error, error)
    assert.equal(t.nr.txInfo.errorHandled, false)

    tx.end()
    end()
  })
})

test('should handle error when passed in to done handler `request.raw`', function (t, end) {
  const { agent, wrapper, errorHandler } = t.nr
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
    try {
      wrapped(request, 'one', errorHandler)
    } catch {}
    assert.deepEqual(t.nr.txInfo.error, error)
    assert.equal(t.nr.txInfo.errorHandled, false)
    assert.deepEqual(request.raw[transactionInfo], t.nr.txInfo)
    tx.end()
    end()
  })
})

test('should handle error when passed in to done handler `request`', function (t, end) {
  const { agent, wrapper, errorHandler } = t.nr
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
    try {
      wrapped(request, 'one', errorHandler)
    } catch {}
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

test('should handle error when passed in to done handler but subsequent middleware handles error', function (t, end) {
  t.plan(3)
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
    wrapped(request, 'one', function(err) {
      // this middleware essentially swallows error
      // thus handling it and marking error in txInfo
      // as handled so it will not report
      t.assert.equal(err.message, error.message)
    })
    t.assert.deepEqual(t.nr.txInfo.error, error)
    t.assert.equal(t.nr.txInfo.errorHandled, true)
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

test('should record error from a rejected promise handler', async function (t) {
  const { agent, wrapper } = t.nr
  const error = new Error('async failure')
  async function handler() {
    throw error
  }
  const wrapped = wrapper.wrap({ handler, route: '/promise' })
  await helper.runInTransaction(agent, async function (tx) {
    tx.type = 'web'
    await assert.rejects(wrapped({}, 'one', 'two'), error)
    assert.equal(t.nr.txInfo.error, error, 'error from settled promise should be recorded on txInfo')
    tx.end()
  })
})

test('should pass through resolved value from a promise handler', async function (t) {
  const { agent, wrapper } = t.nr
  async function handler() {
    return 'resolved'
  }
  const wrapped = wrapper.wrap({ handler, route: '/promise' })
  await helper.runInTransaction(agent, async function (tx) {
    tx.type = 'web'
    assert.equal(await wrapped({}, 'one', 'two'), 'resolved')
    tx.end()
  })
})

// see: https://github.com/newrelic/node-newrelic/issues/4092.
// A wrapped middleware handler that returns a promise gets a `.then`
// link so errors can be recorded when it settles. That propagation must not
// pin the transaction: an application-held promise that settles late or never
// would otherwise keep the segment (and its parent transaction) alive forever.
//
// This test is only valid where AsyncContextFrame is enabled(Node's default from v24),
// so they are skipped below v24 where a held pending promise pins the async
// context regardless of the agent. See the tracer suite for the same rationale.
test('should not retain the segment for a pending promise handler', { skip: semver.lt(process.version, '24.0.0') }, async function (t) {
  const { agent, wrapper } = t.nr
  const v8 = require('node:v8')
  const vm = require('node:vm')
  v8.setFlagsFromString('--expose-gc')
  const gc = vm.runInNewContext('gc')
  v8.setFlagsFromString('--no-expose-gc')

  async function collect() {
    for (let i = 0; i < 30; i++) {
      gc()
      await new Promise((resolve) => setImmediate(resolve))
    }
  }

  const held = []
  function handler() {
    const promise = new Promise(() => {})
    held.push(promise)
    return promise
  }
  const wrapped = wrapper.wrap({ handler, route: '/leak' })

  let ref
  helper.runInTransaction(agent, function (tx) {
    tx.type = 'web'
    held.push(wrapped({}, 'one', 'two'))
    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    ref = new WeakRef(segment)
    tx.end()
  })

  await collect()

  assert.equal(held.length, 2, 'application still holds the pending promises')
  assert.equal(ref.deref(), undefined, 'segment should be collected even though the middleware promise never settled')
})
