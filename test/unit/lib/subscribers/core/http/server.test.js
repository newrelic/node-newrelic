/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const EventEmitter = require('node:events')
const sinon = require('sinon')
const HttpServerSubscriber = require('#agentlib/subscribers/core/http/server.js')
const symbols = require('#agentlib/symbols.js')
const helper = require('#testlib/agent_helper.js')
const loggerMock = require('../../../../mocks/logger')

function makeRequestResponse(overrides = {}) {
  const request = new EventEmitter()
  request.url = overrides.url ?? '/foo'
  request.method = overrides.method ?? 'GET'
  request.headers = overrides.headers ?? {}

  const response = new EventEmitter()
  response.statusCode = 200
  response.statusMessage = 'OK'
  response.getHeaders = () => { return {} }

  return { request, response }
}

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = loggerMock()
  const subscriber = new HttpServerSubscriber({ agent, logger })
  ctx.nr = { agent, subscriber, logger }
})

test.afterEach((ctx) => {
  const { agent, subscriber } = ctx.nr
  subscriber.disable()
  subscriber.unsubscribe()
  helper.unloadAgent(agent)
})

test('default props', (t) => {
  const { subscriber } = t.nr
  assert.equal(subscriber.packageName, 'http')
  assert.equal(subscriber.id, 'nr:server:http')
  assert.equal(subscriber.channels.length, 1)
  const [channel] = subscriber.channels
  assert.equal(channel.start.name, 'tracing:nr:server:http:Server.onrequest:start')
  assert.equal(subscriber.transport, 'HTTP')
})

test('enabled should respect the instrumentation.http config toggle', (t) => {
  const { subscriber } = t.nr
  subscriber.config.instrumentation.http.enabled = false
  assert.equal(subscriber.enabled, false)

  subscriber.config.instrumentation.http.enabled = true
  assert.equal(subscriber.enabled, true)
})

test('handler should do nothing when the agent cannot collect data', (t) => {
  const { agent, subscriber } = t.nr
  sinon.stub(agent, 'canCollectData').returns(false)

  const ctx = agent.tracer.getContext()
  const { request, response } = makeRequestResponse()
  const result = subscriber.handler({ request, response, port: 1234 }, ctx)

  assert.equal(result, ctx)
  assert.equal(agent.getTransaction(), null)
})

test('handler should process the request against the existing transaction when one is already active, rather than no-op', (t) => {
  const { agent, subscriber } = t.nr
  const supportabilitySpy = sinon.spy(agent, 'recordSupportability')

  helper.runInTransaction(agent, (tx) => {
    const ctx = agent.tracer.getContext()
    const ambientSegment = ctx.segment
    const startSpy = sinon.spy(ambientSegment, 'start')
    const touchSpy = sinon.spy(ambientSegment, 'touch')
    const { request, response } = makeRequestResponse()
    const newCtx = subscriber.handler({ request, response, port: 1234 }, ctx)

    // No second Transaction is created...
    assert.equal(newCtx.transaction, tx)
    assert.equal(agent.getTransaction().id, tx.id)
    assert.equal(supportabilitySpy.calledWith('Nodejs/Transactions/Nested'), true)

    // ...but the request is still fully processed against the existing one,
    // matching the former `tracer.transactionProxy` behavior: it only ever
    // skipped constructing a second `Transaction`, never the request handling.
    assert.ok(newCtx.segment)
    assert.equal(newCtx.segment.name, '/foo')
    assert.equal(tx.baseSegment, newCtx.segment)
    assert.equal(request[symbols.transactionInfo]?.transaction, tx)

    // And, matching transactionProxy's direct (non-runInContext) call for
    // this branch, the pre-existing ambient segment itself is never
    // start()/touch()ed -- only the new child segment is.
    assert.equal(startSpy.callCount, 0)
    assert.equal(touchSpy.callCount, 0)

    tx.end()
  })
})

test('handler should only finalize once when both finish and close fire', (t) => {
  const { agent, subscriber } = t.nr
  const ctx = agent.tracer.getContext()
  const { request, response } = makeRequestResponse()

  const newCtx = subscriber.handler({ request, response, port: 1234 }, ctx)
  const finalizeSpy = sinon.spy(newCtx.transaction, 'finalizeWeb')

  response.emit('finish')
  response.emit('close')

  assert.equal(finalizeSpy.callCount, 1)
  newCtx.transaction.end()
})

test('instrument should decline to wrap when in an azure functions environment', (t) => {
  const { subscriber, logger } = t.nr
  process.env.FUNCTIONS_WORKER_RUNTIME = 'node'
  t.after(() => {
    delete process.env.FUNCTIONS_WORKER_RUNTIME
  })

  const http = { createServer: () => {}, Server: { prototype: {} } }
  subscriber.instrument(http)

  assert.equal(logger.debug.callCount, 1)
  assert.equal(http.createServer[symbols.unwrap], undefined)
})
