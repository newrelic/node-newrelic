/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim.js')

test('agent instrumentation of generic-pool', async function (t) {
  const agent = helper.loadMockedAgent()
  const shim = new Shim(agent, 'generic-pool')
  const initialize = require('../../../lib/instrumentation/generic-pool')

  t.after(function () {
    helper.unloadAgent(agent)
  })

  await t.test("shouldn't cause bootstrapping to fail", async function (t) {
    await t.test('when passed no module', async function () {
      assert.doesNotThrow(function () {
        initialize(agent, null, 'generic-pool', shim)
      })
    })

    await t.test('when passed an empty module', async function () {
      assert.doesNotThrow(function () {
        initialize(agent, {}, 'generic-pool', shim)
      })
    })
  })

  await t.test('when wrapping callbacks passed into pool.acquire', async function (t) {
    const mockPool = {
      Pool: function (arity) {
        return {
          acquire: function (callback) {
            assert.equal(callback.length, arity)
            assert.doesNotThrow(function () {
              callback()
            })
          }
        }
      }
    }

    initialize(agent, mockPool, 'generic-pool', shim)

    await t.test("must preserve 'callback.length === 0' to keep generic-pool happy", (t, end) => {
      const nop = function () {
        end()
      }
      assert.equal(nop.length, 0)

      /* eslint-disable new-cap */
      mockPool.Pool(0).acquire(nop)
      /* eslint-enable new-cap */
    })

    await t.test("must preserve 'callback.length === 1' to keep generic-pool happy", (t, end) => {
      // eslint-disable-next-line no-unused-vars
      const nop = function (client) {
        end()
      }
      assert.equal(nop.length, 1)

      /* eslint-disable new-cap */
      mockPool.Pool(1).acquire(nop)
      /* eslint-enable new-cap */
    })

    await t.test("must preserve 'callback.length === 2' to keep generic-pool happy", (t, end) => {
      // eslint-disable-next-line no-unused-vars
      const nop = function (error, client) {
        end()
      }
      assert.equal(nop.length, 2)

      /* eslint-disable new-cap */
      mockPool.Pool(2).acquire(nop)
      /* eslint-enable new-cap */
    })
  })
})
