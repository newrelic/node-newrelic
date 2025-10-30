/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')

function makeSuite(name) {
  return benchmark.createBenchmark({ name })
}

const NUM_PROMISES = 300

const tests = [
  function forkedTest(Promise) {
    return function runTest() {
      // number of internal nodes on the binary tree of promises
      // this will produce a binary tree with NUM_PROMISES / 2 internal
      // nodes, and NUM_PROMISES / 2 + 1 leaves
      const internalPromises = NUM_PROMISES / 2
      const promises = [Promise.resolve()]

      for (let i = 0; i < internalPromises; ++i) {
        const prom = promises[i]
        promises.push(prom.then(function first() {}))
        promises.push(prom.then(function second() {}))
      }
      return Promise.all(promises)
    }
  },

  function longTest(Promise) {
    return function runTest() {
      let prom = Promise.resolve()
      for (let i = 0; i < NUM_PROMISES; ++i) {
        prom = prom.then(function () {})
      }
      return prom
    }
  },

  function longTestWithCatches(Promise) {
    return function runTest() {
      let prom = Promise.resolve()
      for (let i = 0; i < NUM_PROMISES / 2; ++i) {
        prom = prom.then(function () {}).catch(function () {})
      }
      return prom
    }
  },

  function longThrowToEnd(Promise) {
    return function runTest() {
      let prom = Promise.reject(Error('boom'))
      for (let i = 0; i < NUM_PROMISES - 1; ++i) {
        prom = prom.then(function () {})
      }
      return prom.catch(function () {})
    }
  },

  function promiseConstructor(Promise) {
    return function runTest() {
      const promises = []
      for (let i = 0; i < NUM_PROMISES; ++i) {
        promises.push(
          new Promise(function (resolve) {
            resolve()
          })
        )
      }
      return Promise.all(promises)
    }
  },

  function promiseReturningPromise(Promise) {
    return function runTest() {
      const promises = []
      for (let i = 0; i < NUM_PROMISES / 2; ++i) {
        promises.push(
          Promise.resolve(
            new Promise(function (resolve) {
              setImmediate(resolve)
            })
          )
        )
      }
      return Promise.all(promises)
    }
  },

  function thenReturningPromise(Promise) {
    return function runTest() {
      let prom = Promise.resolve()
      for (let i = 0; i < NUM_PROMISES / 2; ++i) {
        prom = prom.then(function () {
          return new Promise(function (resolve) {
            setImmediate(resolve)
          })
        })
      }
      return prom
    }
  },

  function promiseConstructorThrow(Promise) {
    return function runTest() {
      return new Promise(function () {
        throw new Error('Whoops!')
      }).catch(() => {})
    }
  }
]

exports.makeSuite = makeSuite
exports.tests = tests
