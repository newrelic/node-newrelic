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
  name: 'shim.wrap',
  fn: function() {
    var test = shared.getTest()
    shim.wrap(test, 'func', function(shim, fn) {
      return function() { return fn.apply(this, arguments) }
    })
    return test
  }
})

suite.add({
  name: 'shim.wrapReturn',
  fn: function() {
    var test = shared.getTest()
    shim.wrapReturn(test, 'func', function(shim, fn, fnName, ret) {
      return {ret: ret}
    })
    return test
  }
})

suite.add({
  name: 'shim.wrapClass',
  fn: function() {
    var test = shared.getTest()
    shim.wrapClass(test, 'func', function(shim, fn, fnName, args) {
      return {args: args}
    })
    return test
  }
})

suite.add({
  name: 'shim.wrapExport',
  fn: function() {
    var test = shared.getTest()
    shim.wrapExport(test, function(shim, nodule) {
      return {nodule: nodule}
    })
    return test
  }
})

suite.add({
  name: 'shim.unwrap',
  fn: function() {
    var test = shared.getTest()
    shim.unwrap(test, 'func')
    return test
  }
})

suite.run()
