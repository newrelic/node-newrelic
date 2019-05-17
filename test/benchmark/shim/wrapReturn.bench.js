'use strict'

var shared = require('./shared')


var s = shared.makeSuite('Shim segments')
var suite = s.suite
var shim = s.shim

var test = null

const testFunctions = {
  'defineProperty': function testDefProp() {
    Object.defineProperty(test.func, 'testProp', {
      value: 4
    })
  },
  'set': function testAssignment() {
    test.func.testProp = 4
  },
  'apply': function testApplication() {
    return test.func()
  },
  'construct': function testConstruction() {
    return new test.func() //eslint-disable-line
  },
  'get': function testGet() {
    return test.func.testProp
  },
  'get unwrap': function testGetUnwrap() {
    return test.func.__NR_unwrap
  }
}

Object.keys(testFunctions).forEach(testName => {
  suite.add({
    name: testName + ' (wrapped)',
    before: function() {
      test = shared.getTest()
      test.func.testProp = 1
      shim.wrapReturn(test, 'func', function(shim, fn, fnName, ret) {
        return {ret: ret}
      })
      return test
    },
    fn: testFunctions[testName]
  })
  suite.add({
    name: testName + ' (unwrapped)',
    before: function() {
      test = shared.getTest()
      test.func.testProp = 1
      return test
    },
    fn: testFunctions[testName]
  })
})

suite.run()
