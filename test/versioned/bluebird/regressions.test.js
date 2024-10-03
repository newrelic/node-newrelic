/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const helper = require('../../lib/agent_helper')

test('bluebird', async function (t) {
  await t.test('NODE-1649 Stack overflow on recursive promise', async function (t) {
    // This was resolved in 2.6.0 as a side-effect of completely refactoring the
    // promise instrumentation.

    const agent = helper.loadMockedAgent()
    t.after(function () {
      helper.unloadAgent(agent)
    })
    const Promise = require('bluebird')

    function Provider(count) {
      this._count = count
    }

    Provider.prototype.getNext = function () {
      return Promise.resolve(--this._count > 0 ? this._count : null)
    }

    function getData(dataProvider) {
      const results = []

      return dataProvider.getNext().then(collectResults)

      function collectResults(result) {
        if (!result) {
          return results
        }
        results.push(result)
        return dataProvider.getNext().then(collectResults)
      }
    }

    await helper.runInTransaction(agent, function () {
      return getData(new Provider(10000))
    })
  })
})
