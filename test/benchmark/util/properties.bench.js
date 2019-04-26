'use strict'

const benchmark = require('../../lib/benchmark')
const properties = require('../../../lib/util/properties')

var suite = benchmark.createBenchmark({
  runs: 100000,
  name: 'util.properties'
})

var testObj
suite.add({
  name: 'isEmpty (object instance)',
  before: function() {testObj = {}},
  fn: function testIsEmptyObjectPrototype() {
    properties.isEmpty(testObj)
  }
})

suite.add({
  name: 'isEmpty (null prototype)',
  before: function() {testObj = Object.create(null)},
  fn: function testIsEmptyNullPrototype() {
    properties.isEmpty(testObj)
  }
})

suite.run()
