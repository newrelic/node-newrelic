/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var shared = require('./shared')


var s = shared.makeSuite('Shim segments')
var suite = s.suite
var shim = s.shim


suite.add({
  name: 'shim.logger.trace',
  fn: function() {
    var test = shared.getTest()
    shim.logger.trace(test, 'Testing log performance.')
    return test
  }
})

suite.add({
  name: 'shim.toArray',
  fn: function() {
    return shim.toArray('foooo')
  }
})

suite.add({
  name: 'shim.argsToArray',
  fn: function() {
    return shim.argsToArray({}, 'func', 1, 2, 3)
  }
})

suite.add({
  name: 'shim.normalizeIndex',
  fn: function() {
    return shim.normalizeIndex(4, -1)
  }
})

suite.add({
  name: 'shim.listenerCount',
  fn: function() {
    return shim.listenerCount(process, 'uncaughtException')
  }
})

suite.add({
  name: 'shim.once',
  fn: function() {
    var test = shared.getTest()
    return shim.once(test.func)
  }
})

suite.add({
  name: 'shim.proxy',
  fn: function() {
    var test = shared.getTest()
    shim.proxy(test, 'func', {})
    return test
  }
})

suite.add({
  name: 'shim.require',
  fn: function() {
    shim.require('../../lib/benchmark')
  }
})

suite.add({
  name: 'shim.interceptPromise',
  fn: function() {
    var p = new Promise(function(res) { res() })
    return shim.interceptPromise(p, function() {})
  }
})

suite.run()
