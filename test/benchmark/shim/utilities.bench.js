/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const shared = require('./shared')

const s = shared.makeSuite('Shim segments')
const suite = s.suite
const shim = s.shim

suite.add({
  name: 'shim.logger.trace',
  fn: function () {
    const test = shared.getTest()
    shim.logger.trace(test, 'Testing log performance.')
    return test
  }
})

suite.add({
  name: 'shim.toArray',
  fn: function () {
    return shim.toArray('foooo')
  }
})

suite.add({
  name: 'shim.argsToArray',
  fn: function () {
    return shim.argsToArray({}, 'func', 1, 2, 3)
  }
})

suite.add({
  name: 'shim.normalizeIndex',
  fn: function () {
    return shim.normalizeIndex(4, -1)
  }
})

suite.add({
  name: 'shim.listenerCount',
  fn: function () {
    return shim.listenerCount(process, 'uncaughtException')
  }
})

suite.add({
  name: 'shim.once',
  fn: function () {
    const test = shared.getTest()
    return shim.once(test.func)
  }
})

suite.add({
  name: 'shim.proxy',
  fn: function () {
    const test = shared.getTest()
    shim.proxy(test, 'func', {})
    return test
  }
})

suite.add({
  name: 'shim.require',
  fn: function () {
    shim.require('../../lib/benchmark')
  }
})

suite.add({
  name: 'shim.interceptPromise',
  fn: function () {
    const p = new Promise(function (res) {
      res()
    })
    return shim.interceptPromise(p, function () {})
  }
})

suite.run()
