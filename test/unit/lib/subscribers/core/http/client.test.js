/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const http = require('node:http')

const helper = require('#testlib/agent_helper.js')
const HttpClientSubscriber = require('#agentlib/subscribers/core/http/client.js')
const logger = require('#agentlib/logger.js')
const symbols = require('#agentlib/symbols.js')

test('HttpClientSubscriber id', (t) => {
  const agent = helper.loadMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  // the prefix keeps the id, and the channel, distinct from other `http` subscribers
  const subscriber = new HttpClientSubscriber({ agent, logger })
  assert.equal(subscriber.packageName, 'http')
  assert.equal(subscriber.id, 'nr:client:http')
  assert.deepEqual(subscriber.channels.map((channel) => channel.start.name), ['tracing:nr:client:http:request:start'])
})

test('HttpClientSubscriber enabled', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    ctx.nr = { agent, subscriber: new HttpClientSubscriber({ agent, logger }) }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should be enabled when https instrumentation is disabled', (t) => {
    const { agent, subscriber } = t.nr
    agent.config.instrumentation.https.enabled = false
    assert.equal(subscriber.enabled, true)
  })

  await t.test('should be disabled when http instrumentation is disabled', (t) => {
    const { agent, subscriber } = t.nr
    agent.config.instrumentation.http.enabled = false
    assert.equal(subscriber.enabled, false)
  })
})

test('HttpClientSubscriber instrument', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    const mod = { request() {}, get() {} }
    ctx.nr = { agent, mod, subscriber: new HttpClientSubscriber({ agent, logger }) }
  })

  t.afterEach((ctx) => {
    delete process.env.FUNCTIONS_WORKER_RUNTIME
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should wrap request and get', (t) => {
    const { mod, subscriber } = t.nr
    subscriber.instrument(mod)
    assert.equal(typeof mod.request[symbols.unwrap], 'function')
    assert.equal(typeof mod.get[symbols.unwrap], 'function')
  })

  await t.test('should not wrap anything in an azure functions environment', (t) => {
    const { mod, subscriber } = t.nr
    process.env.FUNCTIONS_WORKER_RUNTIME = 'node'
    subscriber.instrument(mod)
    assert.equal(mod.request[symbols.unwrap], undefined)
    assert.equal(mod.get[symbols.unwrap], undefined)
  })

  await t.test('should resolve the http module', (t) => {
    const { subscriber } = t.nr
    assert.equal(subscriber.resolveModule(), http)
  })
})
