'use strict'

var glob = require('glob')
var fs = require('fs')
var parseProcCpuInfo = require('../../../lib/parse-proc-cpuinfo')
var assert = require('chai').assert

glob('../../lib/cross_agent_tests/proc_cpuinfo/*.txt', function globCallback(err, data) {
  if (err) throw err
  assert(data.length > 0, 'There were no tests found to run')
  for (var i = 0, len = data.length; i < len; ++i) {
    runFile(data[i], data.length)
  }
})

function runFile(name) {
  fs.readFile(name, function getFile(err, data) {
    if (err) throw err
    testFile(name, data.toString())
  })
}

function parseName(name) {
  var pattern = /^((\d+|X)pack_(\d+|X)core_(\d+|X)logical).txt$/
  var arr = name.split('/')
  arr = arr[arr.length - 1].replace(pattern, '$1 $2 $3 $4').split(' ')
  var res = {
    logical: parseInt(arr[3], 10),
    cores: parseInt(arr[2], 10),
    packages: parseInt(arr[1], 10)
  }

  res.logical = res.logical ? res.logical : null
  res.cores = res.cores ? res.cores : null
  res.packages = res.packages ? res.packages : null

  return res
}

function testFile(name, file) {
  var expected = parseName(name)
  var info = parseProcCpuInfo(file)
  assert.deepEqual(info, expected, 'Failed on ' + name)
}
