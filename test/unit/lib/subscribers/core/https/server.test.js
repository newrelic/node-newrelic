/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const EventEmitter = require('node:events')
const HttpsServerSubscriber = require('#agentlib/subscribers/core/https/server.js')
const helper = require('#testlib/agent_helper.js')
const loggerMock = require('../../../../mocks/logger')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = loggerMock()
  const subscriber = new HttpsServerSubscriber({ agent, logger })
  ctx.nr = { agent, subscriber, logger }
})

test.afterEach((ctx) => {
  const { agent, subscriber } = ctx.nr
  subscriber.disable()
  subscriber.unsubscribe()
  helper.unloadAgent(agent)
})

test('instrument should not throw when ServerResponse is missing', (t) => {
  const { subscriber } = t.nr
  // `https` has no `ServerResponse`/`IncomingMessage` of its own.
  const https = { createServer: () => {}, Server: { prototype: new EventEmitter() } }

  assert.doesNotThrow(() => subscriber.instrument(https))
})

test('default props', (t) => {
  const { subscriber } = t.nr
  assert.equal(subscriber.packageName, 'https')
  assert.equal(subscriber.id, 'nr:server:https')
  assert.equal(subscriber.channels.length, 1)
  const [channel] = subscriber.channels
  assert.equal(channel.start.name, 'tracing:nr:server:https:Server.onrequest:start')
  assert.equal(subscriber.transport, 'HTTPS')
})

test('enabled should respect the instrumentation.https config toggle', (t) => {
  const { subscriber } = t.nr
  subscriber.config.instrumentation.https.enabled = false
  assert.equal(subscriber.enabled, false)

  subscriber.config.instrumentation.https.enabled = true
  assert.equal(subscriber.enabled, true)
})
