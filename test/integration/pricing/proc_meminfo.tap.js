'use strict'

var glob = require('glob')
var fs = require('fs')
var parseProcMemInfo = require('../../../lib/parse-proc-meminfo')
var assert = require('chai').assert


glob('../../lib/cross_agent_tests/proc_meminfo/*.txt', function listTestFiles(err, data) {
  if (err) throw err
  assert(data.length > 0, 'There were no tests found to run')
  for (var i = 0, len = data.length; i < len; ++i) {
    runFile(data[i])
  }
})

function runFile(name) {
  fs.readFile(name, function runTestFiles(err, data) {
    if (err) throw err
    testFile(name, data.toString())
  })
}

function parseName(name) {
  var pattern = /^meminfo_(\d+)MB.txt$/
  var arr = name.split('/')
  arr = arr[arr.length - 1].replace(pattern, '$1').split(' ')
  return parseInt(arr[0], 10)
}

function testFile(name, file) {
  var expected = parseName(name)
  var info = parseProcMemInfo(file)
  assert.deepEqual(info, expected, "Failed on: " + name)
}
