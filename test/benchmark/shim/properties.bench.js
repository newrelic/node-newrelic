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
  name: 'shim.setInternalProperty',
  fn: function () {
    const test = shared.getTest()
    shim.setInternalProperty(test, '__NR_internal', function () {})
    return test
  }
})

suite.add({
  name: 'shim.defineProperty',
  fn: function () {
    const test = shared.getTest()
    shim.defineProperty(test, 'foobar', test.func)
    return test
  }
})

suite.add({
  name: 'shim.defineProperties',
  fn: function () {
    const test = shared.getTest()
    shim.defineProperties(test, {
      foobar: test.func,
      fizbang: 'asdf'
    })
    return test
  }
})

suite.add({
  name: 'shim.setDefaults',
  fn: function () {
    const test = shared.getTest()
    shim.setDefaults(test, { func: function () {}, foo: 'bar' })
    return test
  }
})

suite.add({
  name: 'shim.fixArity',
  fn: function () {
    const test = shared.getTest()
    shim.fixArity(test.func, function other() {})
    return test
  }
})

suite.run()
