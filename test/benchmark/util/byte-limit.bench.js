'use strict'

const benchmark = require('../../lib/benchmark')
const truncate = require('../../../lib/util/byte-limit').truncate

var suite = benchmark.createBenchmark({
  name: 'util.byte-limit'
})

var shortString = '123456'
var equalString = '1234567890'

// 2^20 characters
// using unicode characters to force it into the search case
var longString = '1324\uD87E\uDC04\uD87E\uDC04'
for (var i = 0; i < 20; ++i) {
  longString += longString
}

suite.add({
  name: 'truncate (smaller than limit)',
  fn: function() {
    truncate(shortString, 10)
  }
})

suite.add({
  name: 'truncate (equal to limit)',
  fn: function() {
    truncate(equalString, 10)
  }
})

suite.add({
  name: 'truncate (longer than limit)',
  fn: function() {
    truncate(longString, 1023)
  }
})

suite.run()
