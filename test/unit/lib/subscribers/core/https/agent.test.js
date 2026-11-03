/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const https = require('node:https')

const helper = require('#testlib/agent_helper.js')
const HttpsAgentSubscriber = require('#agentlib/subscribers/core/https/agent.js')
const logger = require('#agentlib/logger.js')
const symbols = require('#agentlib/symbols.js')

// `HttpsAgentSubscriber` only changes the package name, so these cover what
// depends on it; the rest is covered by the `HttpAgentSubscriber` tests
test('HttpsAgentSubscriber', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    ctx.nr = { agent, subscriber: new HttpsAgentSubscriber({ agent, logger }) }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should have its own id and channel', (t) => {
    const { subscriber } = t.nr
    assert.equal(subscriber.packageName, 'https')
    assert.equal(subscriber.id, 'nr:agent:https')
    assert.deepEqual(subscriber.channels.map((channel) => channel.start.name), ['tracing:nr:agent:https:createConnection:start'])
  })

  await t.test('should be enabled when http instrumentation is disabled', (t) => {
    const { agent, subscriber } = t.nr
    agent.config.instrumentation.http.enabled = false
    assert.equal(subscriber.enabled, true)
  })

  await t.test('should be disabled when https instrumentation is disabled', (t) => {
    const { agent, subscriber } = t.nr
    agent.config.instrumentation.https.enabled = false
    assert.equal(subscriber.enabled, false)
  })

  await t.test('should wrap Agent#createConnection', (t) => {
    const { subscriber } = t.nr
    class Agent {
      createConnection() {}
    }
    subscriber.instrument({ Agent })
    assert.equal(typeof Agent.prototype.createConnection[symbols.unwrap], 'function')
  })

  await t.test('should resolve the https module', (t) => {
    const { subscriber } = t.nr
    assert.equal(subscriber.resolveModule(), https)
  })
})
