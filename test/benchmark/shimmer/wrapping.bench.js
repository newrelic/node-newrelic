/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const shimmer = require('../../../lib/shimmer')

const suite = benchmark.createBenchmark({ name: 'shimmer wrapping', delay: 0.01 })

function getTest() {
  return {
    func: function testFunc(a, b, c) {
      return a + b + c
    }
  }
}

suite.add({
  name: 'shimmer.isWrapped()',
  fn: function () {
    const test = getTest()
    return shimmer.isWrapped(test.func)
  }
})

suite.add({
  name: 'shimmer.wrapMethod()',
  fn: function () {
    const test = getTest()
    shimmer.wrapMethod(test, 'test', 'func', function () {
      return function () {}
    })
    return test
  }
})

suite.add({
  name: 'shimmer.wrapDeprecated()',
  fn: function () {
    const test = getTest()
    return shimmer.wrapDeprecated(test, 'test', 'func', {})
  }
})

suite.add({
  name: 'shimmer.unwrapMethod()',
  fn: function () {
    const test = getTest()
    shimmer.wrapMethod(test, 'test', 'func', function () {
      return function () {}
    })
    shimmer.unwrapMethod(test, 'test', 'func')
    return test
  }
})

suite.add({
  name: 'shimmer.unwrapAll()',
  fn: function () {
    return shimmer.unwrapAll()
  }
})

suite.run()
