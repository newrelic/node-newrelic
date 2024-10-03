/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../agent_helper')
const { tspl } = require('@matteo.collina/tspl')
const { checkTransaction } = require('./helpers')
const initFixtures = require('./fixtures')

module.exports = async function runTests({ t, agent, Promise, library }) {
  const performTests = initFixtures({ t, agent, Promise })
  /* eslint-disable no-shadow, brace-style */
  if (library) {
    await performTests(
      'Library Fullfillment Factories',
      function (Promise, val) {
        return library.resolve(val)
      },
      function (Promise, err) {
        return library.reject(err)
      }
    )
  }

  await performTests(
    'Promise Fullfillment Factories',
    function (Promise, val) {
      return Promise.resolve(val)
    },
    function (Promise, err) {
      return Promise.reject(err)
    }
  )

  await performTests(
    'New Synchronous',
    function (Promise, val) {
      return new Promise(function (res) {
        res(val)
      })
    },
    function (Promise, err) {
      return new Promise(function (res, rej) {
        rej(err)
      })
    }
  )

  await performTests(
    'New Asynchronous',
    function (Promise, val) {
      return new Promise(function (res) {
        setTimeout(function () {
          res(val)
        }, 10)
      })
    },
    function (Promise, err) {
      return new Promise(function (res, rej) {
        setTimeout(function () {
          rej(err)
        }, 10)
      })
    }
  )

  if (Promise.method) {
    await performTests(
      'Promise.method',
      function (Promise, val) {
        return Promise.method(function () {
          return val
        })()
      },
      function (Promise, err) {
        return Promise.method(function () {
          throw err
        })()
      }
    )
  }

  if (Promise.try) {
    await performTests(
      'Promise.try',
      function (Promise, val) {
        return Promise.try(function () {
          return val
        })
      },
      function (Promise, err) {
        return Promise.try(function () {
          throw err
        })
      }
    )
  }

  await t.test('preserves transaction with resolved chained promises', async function (t) {
    const plan = tspl(t, { plan: 4 })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.resolve(0)
        .then(function step1() {
          return 1
        })
        .then(function step2() {
          return 2
        })
        .then(function finalHandler(res) {
          plan.equal(res, 2, 'should be the correct result')
          checkTransaction(plan, agent, transaction)
          transaction.end()
        })
        .then(
          function () {
            plan.ok(1, 'should resolve cleanly')
          },
          function () {
            plan.ok(0)
          }
        )
    })
    await plan.completed
  })

  await t.test('preserves transaction with rejected chained promises', async function (t) {
    const plan = tspl(t, { plan: 4 })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      const err = new Error('some error')
      Promise.resolve(0)
        .then(function step1() {
          return 1
        })
        .then(function rejector() {
          throw err
        })
        .then(function unusedStep() {
          plan.ok(0, 'should not change execution profile')
        })
        .catch(function catchHandler(reason) {
          plan.equal(reason, err, 'should be the same error')
          checkTransaction(plan, agent, transaction)
          transaction.end()
        })
        .then(
          function finallyHandler() {
            plan.ok(1, 'should resolve cleanly')
          },
          function (err) {
            plan.ok(!err)
          }
        )
    })
    await plan.completed
  })
}
