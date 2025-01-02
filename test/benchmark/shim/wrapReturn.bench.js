/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const shared = require('./shared')
const symbols = require('../../../lib/symbols')

const s = shared.makeSuite('Shim segments')
const suite = s.suite
const shim = s.shim

let test = null

const testFunctions = {
  defineProperty: function testDefProp() {
    Object.defineProperty(test.func, 'testProp', {
      value: 4
    })
  },
  set: function testAssignment() {
    test.func.testProp = 4
  },
  apply: function testApplication() {
    return test.func()
  },
  construct: function testConstruction() {
    return new test.func() //eslint-disable-line
  },
  get: function testGet() {
    return test.func.testProp
  },
  'get unwrap': function testGetUnwrap() {
    return test.func[symbols.unwrap]
  }
}

Object.keys(testFunctions).forEach((testName) => {
  suite.add({
    name: testName + ' (wrapped)',
    before: function () {
      test = shared.getTest()
      test.func.testProp = 1
      shim.wrapReturn(test, 'func', function (shim, fn, fnName, ret) {
        return { ret }
      })
      return test
    },
    fn: testFunctions[testName]
  })
  suite.add({
    name: testName + ' (unwrapped)',
    before: function () {
      test = shared.getTest()
      test.func.testProp = 1
      return test
    },
    fn: testFunctions[testName]
  })
})

suite.run()
