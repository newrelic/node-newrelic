/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../../lib/benchmark')

function makeSuite(name) {
  return benchmark.createBenchmark({async: true, name: name, delay: 0.01})
}

var NUM_PROMISES = 300

var tests = [
  function forkedTest(Promise) {
    return function runTest(agent, cb) {
      var prom = Promise.resolve()

      // number of internal nodes on the binary tree of promises
      // this will produce a binary tree with NUM_PROMISES / 2 internal
      // nodes, and NUM_PROMIES / 2 + 1 leaves
      var internalPromises = NUM_PROMISES / 2
      var promises = [prom]

      for (var i = 0; i < internalPromises; ++i) {
        var prom = promises[i]
        promises.push(prom.then(function first() {}))
        promises.push(prom.then(function second() {}))
      }
      Promise.all(promises).then(cb)
    }
  },

  function longTest(Promise) {
    return function runTest(agent, cb) {
      var prom = Promise.resolve()
      for (var i = 0; i < NUM_PROMISES; ++i) {
        prom = prom.then(function() {})
      }
      prom.then(cb)
    }
  },

  function longTestWithCatches(Promise) {
    return function runTest(agent, cb) {
      var prom = Promise.resolve()
      for (var i = 0; i < NUM_PROMISES / 2; ++i) {
        prom = prom.then(function() {}).catch(function() {})
      }
      prom.then(cb)
    }
  },

  function longThrowToEnd(Promise) {
    return function runTest(agent, cb) {
      var prom = Promise.reject()
      for (var i = 0; i < NUM_PROMISES - 1; ++i) {
        prom = prom.then(function() {})
      }
      prom.catch(function() {}).then(cb)
    }
  },

  function promiseConstructor(Promise) {
    return function runTest(agent, cb) {
      for (var i = 0; i < NUM_PROMISES; ++i) {
        /* eslint-disable no-new */
        new Promise(function(res) {res()})
      }
      cb()
    }
  },

  function promiseReturningPromise(Promise) {
    return function runTest(agent, cb) {
      var promises = []
      for (var i = 0; i < NUM_PROMISES / 2; ++i) {
        promises.push(
          new Promise(function(resolve) {
            resolve(new Promise(function(res) {
              setImmediate(res)
            }))
          })
        )
      }
      Promise.all(promises).then(cb)
    }
  },

  function thenReturningPromise(Promise) {
    return function runTest(agent, cb) {
      var prom = Promise.resolve()
      for (var i = 0; i < NUM_PROMISES / 2; ++i) {
        var prom = prom.then(function() {
          return new Promise(function(res) {
            setImmediate(res)
          })
        })
      }
      prom.then(cb)
    }
  },

  function promiseConstructorThrow(Promise) {
    return function runTest(agent, cb) {
      (new Promise(function() {throw new Error('Whoops!')})).catch(() => {})
      cb()
    }
  }
]

exports.makeSuite = makeSuite
exports.tests = tests
