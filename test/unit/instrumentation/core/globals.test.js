/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const helper = require('../../../lib/agent_helper')

test('Unhandled rejection', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach((t) => {
    helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

    agent = helper.instrumentMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should not report it if there is another handler', (t) => {
    process.once('unhandledRejection', function () {})

    helper.runInTransaction(agent, function (transaction) {
      Promise.reject('test rejection')

      setTimeout(function () {
        t.equal(transaction.exceptions.length, 0)
        t.end()
      }, 15)
    })
  })

  t.test('should catch early throws with long chains', (t) => {
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

            t.equal(currentSegment, segment)
            t.equal(err.message, 'some error')
            t.equal(currentTransaction, transaction)

            t.end()
          })
        })
    })
  })
})
