/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const http = require('node:http')

const helper = require('#testlib/agent_helper.js')
const HttpAgentSubscriber = require('#agentlib/subscribers/core/http/agent.js')
const logger = require('#agentlib/logger.js')
const symbols = require('#agentlib/symbols.js')

test('HttpAgentSubscriber id', (t) => {
  const agent = helper.loadMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  // the prefix keeps the id, and the channel, distinct from other `http` subscribers
  const subscriber = new HttpAgentSubscriber({ agent, logger })
  assert.equal(subscriber.packageName, 'http')
  assert.equal(subscriber.id, 'nr:agent:http')
  assert.deepEqual(subscriber.channels.map((channel) => channel.start.name), ['tracing:nr:agent:http:createConnection:start'])
})

test('HttpAgentSubscriber enabled', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    ctx.nr = { agent, subscriber: new HttpAgentSubscriber({ agent, logger }) }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should be enabled when only https instrumentation is enabled', (t) => {
    const { agent, subscriber } = t.nr
    agent.config.instrumentation.http.enabled = false
    assert.equal(subscriber.enabled, true)
  })

  await t.test('should be enabled when only http instrumentation is enabled', (t) => {
    const { agent, subscriber } = t.nr
    agent.config.instrumentation.https.enabled = false
    assert.equal(subscriber.enabled, true)
  })

  await t.test('should be disabled when http and https instrumentation are disabled', (t) => {
    const { agent, subscriber } = t.nr
    agent.config.instrumentation.http.enabled = false
    agent.config.instrumentation.https.enabled = false
    assert.equal(subscriber.enabled, false)
  })
})

test('HttpAgentSubscriber instrument', async (t) => {
  /**
   * Builds a stand-in for the `http` or `https` module.
   *
   * @returns {object} An object with an `Agent` that has a `createConnection` method.
   */
  function fakeModule() {
    class Agent {
      createConnection() {}
    }
    return { Agent }
  }

  /**
   * Checks whether the module's `Agent#createConnection` was wrapped.
   *
   * @param {object} mod The module to inspect.
   * @returns {boolean} `true` when `Agent#createConnection` is wrapped.
   */
  function isWrapped(mod) {
    return typeof mod.Agent.prototype.createConnection[symbols.unwrap] === 'function'
  }

  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    const modules = { http: fakeModule(), https: fakeModule() }
    ctx.nr = { agent, modules, subscriber: new HttpAgentSubscriber({ agent, logger }) }
  })

  t.afterEach((ctx) => {
    delete process.env.FUNCTIONS_WORKER_RUNTIME
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should wrap Agent#createConnection on http and https', (t) => {
    const { modules, subscriber } = t.nr
    subscriber.instrument(modules)
    assert.equal(isWrapped(modules.http), true)
    assert.equal(isWrapped(modules.https), true)
  })

  await t.test('should only wrap https when http instrumentation is disabled', (t) => {
    const { agent, modules, subscriber } = t.nr
    agent.config.instrumentation.http.enabled = false
    subscriber.instrument(modules)
    assert.equal(isWrapped(modules.http), false)
    assert.equal(isWrapped(modules.https), true)
  })

  await t.test('should only wrap http when https instrumentation is disabled', (t) => {
    const { agent, modules, subscriber } = t.nr
    agent.config.instrumentation.https.enabled = false
    subscriber.instrument(modules)
    assert.equal(isWrapped(modules.http), true)
    assert.equal(isWrapped(modules.https), false)
  })

  await t.test('should not wrap anything in an azure functions environment', (t) => {
    const { modules, subscriber } = t.nr
    process.env.FUNCTIONS_WORKER_RUNTIME = 'node'
    subscriber.instrument(modules)
    assert.equal(isWrapped(modules.http), false)
    assert.equal(isWrapped(modules.https), false)
  })

  await t.test('should not throw on a module without an Agent', (t) => {
    const { subscriber } = t.nr
    assert.doesNotThrow(() => subscriber.instrument({ http: {} }))
  })

  await t.test('should resolve the http and https modules', (t) => {
    const { subscriber } = t.nr
    assert.deepEqual(subscriber.resolveModule(), { http, https: require('node:https') })
  })
})
