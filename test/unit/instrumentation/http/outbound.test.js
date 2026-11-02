/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const http = require('node:http')

const helper = require('../../../lib/agent_helper')
const HttpOutboundSubscriber = require('#agentlib/subscribers/core/http-outbound.js')
const logger = require('#agentlib/logger.js')
const symbols = require('../../../../lib/symbols')

test('HttpOutboundSubscriber enabled', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    ctx.nr = { agent, subscriber: new HttpOutboundSubscriber({ agent, logger }) }
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

test('HttpOutboundSubscriber instrument', async (t) => {
  /**
   * Builds a stand-in for the `http` or `https` module.
   *
   * @returns {object} An object with `request` and `get` methods.
   */
  function fakeModule() {
    return { request() {}, get() {} }
  }

  /**
   * Checks whether the module's request methods were wrapped.
   *
   * @param {object} mod The module to inspect.
   * @returns {boolean} `true` when both `request` and `get` are wrapped.
   */
  function isWrapped(mod) {
    return typeof mod.request[symbols.unwrap] === 'function' && typeof mod.get[symbols.unwrap] === 'function'
  }

  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    const modules = { http: fakeModule(), https: fakeModule() }
    ctx.nr = { agent, modules, subscriber: new HttpOutboundSubscriber({ agent, logger }) }
  })

  t.afterEach((ctx) => {
    delete process.env.FUNCTIONS_WORKER_RUNTIME
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should wrap request and get on http and https', (t) => {
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

  await t.test('should resolve the http and https modules', (t) => {
    const { subscriber } = t.nr
    assert.deepEqual(subscriber.resolveModule(), { http, https: require('node:https') })
  })
})
