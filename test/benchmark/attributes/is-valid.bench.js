'use strict'

const isValidType = require('../../../lib/util/attribute-types')
const benchmark = require('../../lib/benchmark')

const types = {
  symbol: Symbol('test'),
  object: {},
  function: function() {},
  undef: undefined,
  string: 'test',
  number: 1234,
  boolean: true,
  array: []
}

const suite = benchmark.createBenchmark({
  name: 'isValidType'
})

Object.keys(types).forEach(function(type) {
  suite.add({
    name: type,
    fn: function() {
      return isValidType(types[type])
    }
  })
})

suite.run()
