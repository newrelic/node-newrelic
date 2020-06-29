/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const helper = require('../../../lib/agent_helper')
const semver = require('semver')

const isNode12Plus = semver.satisfies(process.version, '>=12')

test('Unhandled rejection', (t) => {
  t.autoend()

  // Once on node 10+ only, may be able to replace with below.
  // t.expectUncaughtException(fn, [expectedError], message, extra)
  // https://node-tap.org/docs/api/asserts/#texpectuncaughtexceptionfn-expectederror-message-extra
  helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

  let agent = null

  t.beforeEach((done, t) => {
    // Once on node 10+ only, may be able to replace with below.
    // t.expectUncaughtException(fn, [expectedError], message, extra)
    // https://node-tap.org/docs/api/asserts/#texpectuncaughtexceptionfn-expectederror-message-extra
    helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

    agent = helper.instrumentMockedAgent()

    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    done()
  })

  // As of node 12, the promise which triggered the init async hook will no longer
  // be propagated to the hook, so this linkage is no longer possible.
  t.test('should be associated with the transction if there is one', {skip: isNode12Plus}, (t) => {
    helper.runInTransaction(agent, function(transaction) {
      Promise.reject('test rejection')

      setTimeout(function() {
        t.equal(transaction.exceptions.length, 1)
        t.equal(transaction.exceptions[0].error, 'test rejection')

        t.end()
      }, 15)
    })
  })

  t.test('should not report it if there is another handler', (t) => {
    process.once('unhandledRejection', function() {})

    helper.runInTransaction(agent, function(transaction) {
      Promise.reject('test rejection')

      setTimeout(function() {
        t.equal(transaction.exceptions.length, 0)
        t.end()
      }, 15)
    })
  })

  t.test('should catch early throws with long chains', (t) => {
    let segment

    helper.runInTransaction(agent, function(transaction) {
      new Promise(function(resolve) {
        segment = agent.tracer.getSegment()
        setTimeout(resolve, 0)
      })
        .then(function() {
          throw new Error('some error')
        })
        .then(function() {
          throw new Error('We shouldn\'t be here!')
        })
        .catch(function(err) {
          process.nextTick(function() {
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
