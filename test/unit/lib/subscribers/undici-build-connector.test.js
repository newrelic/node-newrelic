/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const helper = require('#testlib/agent_helper.js')

const BuildConnectorSubscriber = require('#agentlib/subscribers/undici/build-connector.js')
const undiciConnection = Symbol.for('newrelic.undici.connection')

test('undici build-connector instrumentation', async function (t) {
  t.beforeEach(function (ctx) {
    const sandbox = sinon.createSandbox()
    const loggerMock = require('../../mocks/logger')(sandbox)
    const agent = helper.loadMockedAgent()
    const subscriber = new BuildConnectorSubscriber({ agent, logger: loggerMock })
    ctx.nr = { agent, sandbox, subscriber }
  })

  t.afterEach(function (ctx) {
    ctx.nr.sandbox.restore()
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should stamp the socket returned by the connector', function (t) {
    const { subscriber } = t.nr
    const socket = {}
    const connector = () => socket
    const data = { result: connector }

    const ctx = subscriber.end(data, 'ctx')

    // the connector is replaced with a wrapper
    assert.notEqual(data.result, connector)
    assert.equal(typeof data.result, 'function')

    // calling the wrapper returns the same socket, now stamped
    const returned = data.result()
    assert.equal(returned, socket)
    assert.equal(socket[undiciConnection], true)

    // context is passed through unchanged
    assert.equal(ctx, 'ctx')
  })

  await t.test('should forward connector arguments and `this`', function (t) {
    const { subscriber } = t.nr
    const socket = {}
    const thisArg = {}
    const connector = sinon.stub().returns(socket)
    const data = { result: connector }

    subscriber.end(data, 'ctx')
    data.result.call(thisArg, 'a', 'b')

    assert.equal(connector.thisValues[0], thisArg)
    assert.deepEqual(connector.args[0], ['a', 'b'])
  })

  await t.test('should not stamp when the connector returns no socket', function (t) {
    const { subscriber } = t.nr
    const connector = () => undefined
    const data = { result: connector }

    subscriber.end(data, 'ctx')
    assert.doesNotThrow(() => data.result())
  })

  await t.test('should leave a non-function result untouched', function (t) {
    const { subscriber } = t.nr
    const data = { result: 'not-a-function' }

    const ctx = subscriber.end(data, 'ctx')
    assert.equal(data.result, 'not-a-function')
    assert.equal(ctx, 'ctx')
  })
})
