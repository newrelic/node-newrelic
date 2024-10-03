/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { tspl } = require('@matteo.collina/tspl')
const helper = require('../agent_helper')
const COUNT = 2
const { checkTransaction, end, runMultiple } = require('./helpers')

module.exports = function init({ t, agent, Promise }) {
  return async function performTests(name, resolve, reject) {
    const inTx = doPerformTests({ t, agent, Promise, name, resolve, reject, inTx: true })
    const notInTx = doPerformTests({ t, agent, Promise, name, resolve, reject, inTx: false })
    return Promise.all([inTx, notInTx])
  }
}

async function doPerformTests({ t, agent, Promise, name, resolve, reject, inTx }) {
  name += ' ' + (inTx ? 'with' : 'without') + ' transaction'

  await t.test(name + ': does not cause JSON to crash', async function (t) {
    const plan = tspl(t, { plan: 1 * COUNT + 1 })

    runMultiple(
      COUNT,
      function (i, cb) {
        if (inTx) {
          helper.runInTransaction(agent, test)
        } else {
          test(null)
        }

        function test(transaction) {
          const p = resolve(Promise).then(end(transaction, cb), end(transaction, cb))
          const d = p.domain
          delete p.domain
          plan.doesNotThrow(function () {
            JSON.stringify(p)
          }, 'should not cause stringification to crash')
          p.domain = d
        }
      },
      function (err) {
        plan.ok(!err, 'should not error')
      }
    )
    await plan.completed
  })

  await t.test(name + ': preserves transaction in resolve callback', async function (t) {
    const plan = tspl(t, { plan: 4 * COUNT + 1 })

    runMultiple(
      COUNT,
      function (i, cb) {
        if (inTx) {
          helper.runInTransaction(agent, test)
        } else {
          test(null)
        }

        function test(transaction) {
          resolve(Promise)
            .then(function step() {
              plan.ok(1, 'should not change execution profile')
              return i
            })
            .then(function finalHandler(res) {
              plan.equal(res, i, 'should be the correct value')
              checkTransaction(plan, agent, transaction)
            })
            .then(end(transaction, cb), end(transaction, cb))
        }
      },
      function (err) {
        plan.ok(!err, 'should not error')
      }
    )
    await plan.completed
  })

  await t.test(name + ': preserves transaction in reject callback', async function (t) {
    const plan = tspl(t, { plan: 3 * COUNT + 1 })

    runMultiple(
      COUNT,
      function (i, cb) {
        if (inTx) {
          helper.runInTransaction(agent, test)
        } else {
          test(null)
        }

        function test(transaction) {
          const err = new Error('some error ' + i)
          reject(Promise, err)
            .then(function unusedStep() {
              plan.ok(0, 'should not change execution profile')
            })
            .catch(function catchHandler(reason) {
              plan.equal(reason, err, 'should be the same error')
              checkTransaction(plan, agent, transaction)
            })
            .then(end(transaction, cb), end(transaction, cb))
        }
      },
      function (err) {
        plan.ok(!err, 'should not error')
      }
    )
    await plan.completed
  })
}
