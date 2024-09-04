/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const shims = require('../../../lib/shim')

test('an instrumented Hapi application', async function (t) {
  await t.test("shouldn't cause bootstrapping to fail", async function (t) {
    const agent = helper.loadMockedAgent()
    const initialize = require('../../../lib/instrumentation/@hapi/hapi')

    t.after(function () {
      helper.unloadAgent(agent)
    })

    await t.test('when passed nothing', async function () {
      assert.doesNotThrow(function () {
        initialize()
      })
    })

    await t.test('when passed no module', async function () {
      assert.doesNotThrow(function () {
        initialize(agent)
      })
    })

    await t.test('when passed an empty module', async function () {
      initialize(agent, {})
      assert.doesNotThrow(function () {
        initialize(agent, {})
      })
    })
  })

  await t.test(
    'when stubbed should set framework to Hapi when a new app is created',
    async function (t) {
      const agent = helper.instrumentMockedAgent()
      agent.environment.clearFramework()

      function Server() {}
      Server.prototype.route = () => {}
      Server.prototype.start = () => {}

      const stub = { Server }

      const shim = new shims.WebFrameworkShim(agent, 'hapi')

      require('../../../lib/instrumentation/@hapi/hapi')(agent, stub, 'hapi', shim)

      t.after(function () {
        helper.unloadAgent(agent)
      })

      const server = new stub.Server()
      server.start()

      const frameworks = agent.environment.get('Framework')
      assert.equal(frameworks.length, 1)
      assert.equal(frameworks[0], 'Hapi')
    }
  )
})
