/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const shims = require('../../../lib/shim')

tap.test('an instrumented Hapi application', function (t) {
  t.autoend()

  t.test("shouldn't cause bootstrapping to fail", function (t) {
    t.autoend()

    let agent
    let initialize

    t.before(function () {
      agent = helper.loadMockedAgent()
      initialize = require('../../../lib/instrumentation/hapi')
    })

    t.teardown(function () {
      helper.unloadAgent(agent)
    })

    t.test('when passed nothing', function (t) {
      t.doesNotThrow(function () {
        initialize()
      })
      t.end()
    })

    t.test('when passed no module', function (t) {
      t.doesNotThrow(function () {
        initialize(agent)
      })
      t.end()
    })

    t.test('when passed an empty module', function (t) {
      initialize(agent, {})
      t.doesNotThrow(function () {
        initialize(agent, {})
      })
      t.end()
    })
  })

  t.test('when stubbed', function (t) {
    t.autoend()

    let agent
    let stub

    t.beforeEach(function () {
      agent = helper.instrumentMockedAgent()
      agent.environment.clearFramework()

      function Server() {}
      Server.prototype.route = () => {}
      Server.prototype.start = () => {}

      stub = { Server: Server }

      const shim = new shims.WebFrameworkShim(agent, 'hapi')

      require('../../../lib/instrumentation/hapi')(agent, stub, 'hapi', shim)
    })

    t.afterEach(function () {
      helper.unloadAgent(agent)
    })

    t.test('should set framework to Hapi when a new app is created', function (t) {
      const server = new stub.Server()
      server.start()

      const frameworks = agent.environment.get('Framework')
      t.equal(frameworks.length, 1)
      t.equal(frameworks[0], 'Hapi')
      t.end()
    })
  })
})
