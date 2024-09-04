/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../../lib/agent_helper')

test('unhandledRejection should not report it if there is another handler', () => {
  helper.execSync({ cwd: __dirname, script: './fixtures/unhandled-rejection.js' })
})

test('should catch early throws with long chains', (t, end) => {
  const agent = helper.instrumentMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })
  let segment

  helper.runInTransaction(agent, function (transaction) {
    new Promise(function (resolve) {
      segment = agent.tracer.getSegment()
      setTimeout(resolve, 0)
    })
      .then(function () {
        throw new Error('some error')
      })
      .then(function () {
        throw new Error("We shouldn't be here!")
      })
      .catch(function (err) {
        process.nextTick(function () {
          const currentSegment = agent.tracer.getSegment()
          const currentTransaction = agent.getTransaction()

          assert.equal(currentSegment, segment)
          assert.equal(err.message, 'some error')
          assert.equal(currentTransaction, transaction)

          end()
        })
      })
  })
})
