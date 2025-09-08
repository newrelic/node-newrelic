/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const shared = require('./shared')

const s = shared.makeSuite('Shim segments')
const suite = s.suite
const shim = s.shim

let test = null

suite.add({
  name: 'shim.wrap',
  before: function () {
    test = shared.getTest()
    shim.wrap(test, 'func', function (shim, fn) {
      return function () {
        return fn.apply(this, arguments)
      }
    })
    return test
  },
  fn: function () {
    return test.func()
  }
})

suite.add({
  name: 'shim.wrapReturn',
  before: function () {
    test = shared.getTest()
    shim.wrapReturn(test, 'func', function (shim, fn, fnName, ret) {
      return { ret }
    })
    return test
  },
  fn: function () {
    return test.func()
  }
})

suite.add({
  name: 'shim.wrapClass',
  before: function () {
    test = shared.getTest()
    shim.wrapClass(test, 'func', function (shim, fn, fnName, args) {
      return { args }
    })
    return test
  },
  fn: function () {
    return test.func()
  }
})

suite.add({
  name: 'shim.wrapExport',
  before: function () {
    test = shared.getTest()
    shim.wrapExport(test, function (shim, nodule) {
      return { nodule }
    })
    return test
  },
  fn: function () {
    return test.func()
  }
})

suite.add({
  name: 'no wrapping',
  before: function () {
    test = shared.getTest()
    return test
  },
  fn: function () {
    return test.func()
  }
})

suite.run()
