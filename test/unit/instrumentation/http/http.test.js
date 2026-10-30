/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const EventEmitter = require('events').EventEmitter
const helper = require('../../../lib/agent_helper')
const Shim = require('../../../../lib/shim').Shim

test('built-in http module instrumentation', async (t) => {
  await t.test('should not cause bootstrapping to fail', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.loadMockedAgent()
      ctx.nr.initialize = require('../../../../lib/instrumentation/core/http')
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
      process.env.FUNCTIONS_WORKER_RUNTIME = ''
    })

    await t.test('when passed no module', (t) => {
      const { agent, initialize } = t.nr
      assert.doesNotThrow(() => initialize(agent))
    })

    await t.test('when passed an empty module', (t) => {
      const { agent, initialize } = t.nr
      assert.doesNotThrow(() => initialize(agent, {}, 'http', new Shim(agent, 'http')))
    })

    await t.test('should not instrument if azure functions environment detected', (t) => {
      const { agent, initialize } = t.nr
      process.env.FUNCTIONS_WORKER_RUNTIME = 'node'
      const http = {
        request: function request(options) {
          const requested = new EventEmitter()
          requested.path = '/TEST'
          if (options.path) {
            requested.path = options.path
          }

          return requested
        }
      }
      assert.equal(initialize(agent, http, 'http', new Shim(agent, 'http')), false)
    })
  })

  await t.test('with outbound request mocked', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      const agent = helper.loadMockedAgent()
      const initialize = require('../../../../lib/instrumentation/core/http')
      const http = {
        request: function request(options) {
          const requested = new EventEmitter()
          requested.path = '/TEST'
          if (options.path) {
            requested.path = options.path
          }

          return requested
        }
      }

      initialize(agent, http, 'http', new Shim(agent, 'http'))
      ctx.nr.agent = agent
      ctx.nr.http = http
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should not crash when called with undefined host', (t, end) => {
      const { agent, http } = t.nr
      helper.runInTransaction(agent, function () {
        assert.doesNotThrow(() => http.request({ port: 80 }))

        end()
      })
    })

    await t.test('should not crash when called with undefined port', (t, end) => {
      const { agent, http } = t.nr
      helper.runInTransaction(agent, function () {
        assert.doesNotThrow(() => http.request({ host: 'localhost' }))

        end()
      })
    })
  })
})
