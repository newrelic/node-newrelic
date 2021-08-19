/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const tap = require('tap')

tap.test('agent instrumentation of memcached', function (t) {
  t.autoend()
  t.test("shouldn't cause bootstrapping to fail", function (t) {
    t.autoend()
    let agent
    let initialize

    t.before(function () {
      agent = helper.loadMockedAgent()
      initialize = require('../../../lib/instrumentation/memcached')
    })

    t.teardown(function () {
      helper.unloadAgent(agent)
    })

    t.test('when passed no module', function (t) {
      t.doesNotThrow(() => {
        initialize(agent)
      })
      t.end()
    })

    t.test('when passed an empty module', function (t) {
      t.doesNotThrow(() => {
        initialize(agent, {})
      })
      t.end()
    })
  })
})
