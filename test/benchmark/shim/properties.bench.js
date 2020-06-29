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
  name: 'shim.setInternalProperty',
  fn: function() {
    var test = shared.getTest()
    shim.setInternalProperty(test, '__NR_internal', function() {})
    return test
  }
})

suite.add({
  name: 'shim.defineProperty',
  fn: function() {
    var test = shared.getTest()
    shim.defineProperty(test, 'foobar', test.func)
    return test
  }
})

suite.add({
  name: 'shim.defineProperties',
  fn: function() {
    var test = shared.getTest()
    shim.defineProperties(test, {
      foobar: test.func,
      fizbang: 'asdf'
    })
    return test
  }
})

suite.add({
  name: 'shim.setDefaults',
  fn: function() {
    var test = shared.getTest()
    shim.setDefaults(test, {func: function() {}, foo: 'bar'})
    return test
  }
})

suite.add({
  name: 'shim.fixArity',
  fn: function() {
    var test = shared.getTest()
    shim.fixArity(test.func, function other() {})
    return test
  }
})

suite.run()
