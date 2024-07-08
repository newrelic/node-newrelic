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
      Promise.all(promises).then(() => {
        if (typeof cb === 'function') {
          return cb()
        }
        return cb || true
      })
    }
  },

  function longTest(Promise) {
    return function runTest(agent, cb) {
      let prom = Promise.resolve()
      for (let i = 0; i < NUM_PROMISES; ++i) {
        prom = prom.then(function () {})
      }
      prom.then(() => {
        if (typeof cb === 'function') {
          return cb()
        }
        return cb || true
      })
    }
  },

  function longTestWithCatches(Promise) {
    return function runTest(agent, cb) {
      let prom = Promise.resolve()
      for (let i = 0; i < NUM_PROMISES / 2; ++i) {
        prom = prom.then(function () {}).catch(function () {})
      }
      prom.then(() => {
        if (typeof cb === 'function') {
          return cb()
        }
        return cb || true
      })
    }
  },

  function longThrowToEnd(Promise) {
    return function runTest(agent, cb) {
      let prom = Promise.reject()
      for (let i = 0; i < NUM_PROMISES - 1; ++i) {
        prom = prom.then(function () {})
      }
      prom
        .catch(function () {})
        .then(() => {
          if (typeof cb === 'function') {
            return cb()
          }
          return cb || true
        })
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
      if (typeof cb === 'function') {
        return cb()
      }
      return cb || true
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
      Promise.all(promises).then(() => {
        if (typeof cb === 'function') {
          return cb()
        }
        return cb || true
      })
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
      prom.then(() => {
        if (typeof cb === 'function') {
          return cb()
        }
        return cb || true
      })
    }
  },

  function promiseConstructorThrow(Promise) {
    return function runTest(agent, cb) {
      new Promise(function () {
        throw new Error('Whoops!')
      }).catch(() => {})
      if (typeof cb === 'function') {
        return cb()
      }
      return cb || true
    }
  }
]

exports.makeSuite = makeSuite
exports.tests = tests
