/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')

function makeSuite(name) {
  return benchmark.createBenchmark({ async: true, name: name, delay: 0.01 })
}

const NUM_PROMISES = 300

const tests = [
  function forkedTest(Promise) {
    return function runTest(agent, cb) {
      // number of internal nodes on the binary tree of promises
      // this will produce a binary tree with NUM_PROMISES / 2 internal
      // nodes, and NUM_PROMIES / 2 + 1 leaves
      const internalPromises = NUM_PROMISES / 2
      const promises = [Promise.resolve()]

      for (let i = 0; i < internalPromises; ++i) {
        const prom = promises[i]
        promises.push(prom.then(function first() {}))
        promises.push(prom.then(function second() {}))
      }
      Promise.all(promises).then(cb)
    }
  },

  function longTest(Promise) {
    return function runTest(agent, cb) {
      let prom = Promise.resolve()
      for (let i = 0; i < NUM_PROMISES; ++i) {
        prom = prom.then(function () {})
      }
      prom.then(cb)
    }
  },

  function longTestWithCatches(Promise) {
    return function runTest(agent, cb) {
      let prom = Promise.resolve()
      for (let i = 0; i < NUM_PROMISES / 2; ++i) {
        prom = prom.then(function () {}).catch(function () {})
      }
      prom.then(cb)
    }
  },

  function longThrowToEnd(Promise) {
    return function runTest(agent, cb) {
      let prom = Promise.reject()
      for (let i = 0; i < NUM_PROMISES - 1; ++i) {
        prom = prom.then(function () {})
      }
      prom.catch(function () {}).then(cb)
    }
  },

  function promiseConstructor(Promise) {
    return function runTest(agent, cb) {
      for (let i = 0; i < NUM_PROMISES; ++i) {
        /* eslint-disable no-new */
        new Promise(function (res) {
          res()
        })
      }
      cb()
    }
  },

  function promiseReturningPromise(Promise) {
    return function runTest(agent, cb) {
      const promises = []
      for (let i = 0; i < NUM_PROMISES / 2; ++i) {
        promises.push(
          new Promise(function (resolve) {
            resolve(
              new Promise(function (res) {
                setImmediate(res)
              })
            )
          })
        )
      }
      Promise.all(promises).then(cb)
    }
  },

  function thenReturningPromise(Promise) {
    return function runTest(agent, cb) {
      let prom = Promise.resolve()
      for (let i = 0; i < NUM_PROMISES / 2; ++i) {
        prom = prom.then(function () {
          return new Promise(function (res) {
            setImmediate(res)
          })
        })
      }
      prom.then(cb)
    }
  },

  function promiseConstructorThrow(Promise) {
    return function runTest(agent, cb) {
      new Promise(function () {
        throw new Error('Whoops!')
      }).catch(() => {})
      cb()
    }
  }
]

exports.makeSuite = makeSuite
exports.tests = tests
