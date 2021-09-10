/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const shared = require('./shared')

const s = shared.makeSuite('Shim introspection')
const suite = s.suite
const shim = s.shim

suite.add({
  name: 'shim.getName',
  fn: function () {
    const test = shared.getTest()
    return shim.getName(test.func)
  }
})

suite.add({
  name: 'shim.isWrapped',
  fn: function () {
    const test = shared.getTest()
    shim.isWrapped(test, 'func')
    return test
  }
})

suite.add({
  name: 'shim.isObject',
  fn: function () {
    return shim.isObject({})
  }
})

suite.add({
  name: 'shim.isFunction',
  fn: function () {
    return shim.isFunction(function () {})
  }
})

suite.add({
  name: 'shim.isPromise',
  fn: function () {
    return shim.isPromise(
      new Promise(function (res) {
        res()
      })
    )
  }
})

suite.add({
  name: 'shim.isString',
  fn: function () {
    return shim.isString('func')
  }
})

suite.add({
  name: 'shim.isNumber',
  fn: function () {
    return shim.isNumber(1234)
  }
})

suite.add({
  name: 'shim.isBoolean',
  fn: function () {
    return shim.isBoolean(true)
  }
})

suite.add({
  name: 'shim.isArray',
  fn: function () {
    return shim.isArray([])
  }
})

suite.run()
