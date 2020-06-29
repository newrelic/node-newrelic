/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var shared = require('./shared')


var s = shared.makeSuite('Shim segments')
var suite = s.suite
var shim = s.shim

var test = null

suite.add({
  name: 'shim.wrap',
  before: function() {
    test = shared.getTest()
    shim.wrap(test, 'func', function(shim, fn) {
      return function() { return fn.apply(this, arguments) }
    })
    return test
  },
  fn: function() {
    return test.func()
  }
})

suite.add({
  name: 'shim.wrapReturn',
  before: function() {
    test = shared.getTest()
    shim.wrapReturn(test, 'func', function(shim, fn, fnName, ret) {
      return {ret: ret}
    })
    return test
  },
  fn: function() {
    return test.func()
  }
})

suite.add({
  name: 'shim.wrapClass',
  before: function() {
    test = shared.getTest()
    shim.wrapClass(test, 'func', function(shim, fn, fnName, args) {
      return {args: args}
    })
    return test
  },
  fn: function() {
    return test.func()
  }
})

suite.add({
  name: 'shim.wrapExport',
  before: function() {
    test = shared.getTest()
    shim.wrapExport(test, function(shim, nodule) {
      return {nodule: nodule}
    })
    return test
  },
  fn: function() {
    return test.func()
  }
})

suite.add({
  name: 'no wrapping',
  before: function() {
    test = shared.getTest()
    return test
  },
  fn: function() {
    return test.func()
  }
})

suite.run()
