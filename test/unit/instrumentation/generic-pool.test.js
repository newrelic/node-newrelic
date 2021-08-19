/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim.js')

tap.test('agent instrumentation of generic-pool', function (t) {
  t.autoend()
  let agent
  let initialize
  let shim

  t.before(function () {
    agent = helper.loadMockedAgent()
    shim = new Shim(agent, 'generic-pool')
    initialize = require('../../../lib/instrumentation/generic-pool')
  })

  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  t.test("shouldn't cause bootstrapping to fail", function (t) {
    t.autoend()
    t.test('when passed no module', function (t) {
      t.doesNotThrow(function () {
        initialize(agent, null, 'generic-pool', shim)
      })
      t.end()
    })

    t.test('when passed an empty module', function (t) {
      t.doesNotThrow(function () {
        initialize(agent, {}, 'generic-pool', shim)
      })
      t.end()
    })
  })

  t.test('when wrapping callbacks passed into pool.acquire', function (t) {
    t.autoend()
    const mockPool = {
      Pool: function (arity) {
        return {
          acquire: function (callback) {
            t.equal(callback.length, arity)
            t.doesNotThrow(function () {
              callback()
            })
          }
        }
      }
    }

    t.before(function () {
      initialize(agent, mockPool, 'generic-pool', shim)
    })

    t.test("must preserve 'callback.length === 0' to keep generic-pool happy", (t) => {
      const nop = function () {
        t.end()
      }
      t.equal(nop.length, 0)

      /* eslint-disable new-cap */
      mockPool.Pool(0).acquire(nop)
      /* eslint-enable new-cap */
    })

    t.test("must preserve 'callback.length === 1' to keep generic-pool happy", (t) => {
      // eslint-disable-next-line no-unused-vars
      const nop = function (client) {
        t.end()
      }
      t.equal(nop.length, 1)

      /* eslint-disable new-cap */
      mockPool.Pool(1).acquire(nop)
      /* eslint-enable new-cap */
    })

    t.test("must preserve 'callback.length === 2' to keep generic-pool happy", (t) => {
      // eslint-disable-next-line no-unused-vars
      const nop = function (error, client) {
        t.end()
      }
      t.equal(nop.length, 2)

      /* eslint-disable new-cap */
      mockPool.Pool(2).acquire(nop)
      /* eslint-enable new-cap */
    })
  })
})
