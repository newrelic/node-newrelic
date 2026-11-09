/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { describe, test } = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const { removeModules } = require('../../lib/cache-buster')

describe('bluebird instrumentation does not mutate per-promise shape (#4407)', () => {
  test.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
    ctx.nr.Promise = require('bluebird')
  })

  test.afterEach(afterEach)

  // Idempotent: the skip paths below invoke this directly before returning, and
  // the registered hook also runs, so guard against tearing down twice.
  function afterEach(ctx) {
    if (ctx.nr.tornDown === true) {
      return
    }
    ctx.nr.tornDown = true
    helper.unloadAgent(ctx.nr.agent)
    removeModules(['bluebird'])
  }

  test('promise `_then` comes from the prototype, not the instance', (t, end) => {
    const { agent, Promise } = t.nr
    if (helper.isSecurityAgentEnabled(agent) === true) {
      t.skip('security agent may install its own per-instance wrappers on promises')
      afterEach(t)
      end()
      return
    }

    helper.runInTransaction(agent, function (transaction) {
      const promise = Promise.resolve('ok')
      const proto = Object.getPrototypeOf(promise)

      assert.equal(
        Object.prototype.hasOwnProperty.call(promise, '_then'),
        false,
        'promise should inherit `_then` from its prototype, not carry a per-instance own property'
      )
      assert.equal(
        promise._then,
        proto._then,
        'promise `_then` should resolve to the prototype method'
      )

      transaction.end()
      promise.then(() => end())
    })
  })

  test('distinct promises share the same wrapped `_then` reference', (t, end) => {
    const { agent, Promise } = t.nr
    if (helper.isSecurityAgentEnabled(agent) === true) {
      t.skip('security agent may install its own per-instance wrappers on promises')
      afterEach(t)
      end()
      return
    }

    helper.runInTransaction(agent, function (transaction) {
      const promiseA = Promise.resolve('a')
      const promiseB = Promise.resolve('b')

      assert.equal(
        promiseA._then,
        promiseB._then,
        'two promises should share one `_then` function (wrapped once), not get a fresh closure each'
      )

      transaction.end()
      Promise.all([promiseA, promiseB]).then(() => end())
    })
  })

  test('instrumentation still propagates transaction context across `.then()` chains', (t, end) => {
    const { agent, Promise } = t.nr

    helper.runInTransaction(agent, function (transaction) {
      const promise = Promise.resolve('ok')

      promise
        .then(function (value) {
          assert.equal(value, 'ok', 'should resolve with the expected value')
          const tx = agent.tracer.getTransaction()
          assert.equal(tx.id, transaction.id, 'should be the transaction active at promise construction')

          transaction.end()
          end()
        })
        .catch(function (err) {
          assert.ok(!err, 'should not error')
          transaction.end()
          end()
        })
    })
  })

  test('promises from different transactions keep their own context through the shared `_then`', (t, end) => {
    const { agent, Promise } = t.nr

    // Both promises are constructed under different, still-active
    // transactions, then chained outside of either one, interleaved. Since
    // `_then` is now one function shared by every bluebird promise, this is
    // the scenario that would expose context bleeding between instances if
    // the per-promise context stash were broken (e.g. a module-level
    // variable instead of a property on `this`).
    const ctxA = helper.runInTransaction(agent, function (tx) {
      return { transaction: tx, promise: Promise.resolve('a') }
    })
    const ctxB = helper.runInTransaction(agent, function (tx) {
      return { transaction: tx, promise: Promise.resolve('b') }
    })

    assert.notEqual(ctxA.transaction.id, ctxB.transaction.id, 'should be two distinct transactions')

    let settled = 0
    function done() {
      settled++
      if (settled === 2) {
        ctxA.transaction.end()
        ctxB.transaction.end()
        end()
      }
    }

    // Resolve B's chain first to ensure ordering isn't what keeps A and B
    // from cross-contaminating.
    ctxB.promise.then(function (value) {
      assert.equal(value, 'b')
      const tx = agent.tracer.getTransaction()
      assert.equal(tx.id, ctxB.transaction.id, 'promise B should resolve back in transaction B, not A')
      done()
    })

    ctxA.promise.then(function (value) {
      assert.equal(value, 'a')
      const tx = agent.tracer.getTransaction()
      assert.equal(tx.id, ctxA.transaction.id, 'promise A should resolve back in transaction A, not B')
      done()
    })
  })
})
