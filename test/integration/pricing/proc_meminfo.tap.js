'use strict'

var a = require('async')
var test = require('tap').test
var glob = require('glob')
var fs = require('fs')
var parseProcMemInfo = require('../../../lib/parse-proc-meminfo')
var path = require('path')

test('pricing proc_meminfo', function(t) {
  var testDir = path.resolve(__dirname, '../../lib/cross_agent_tests/proc_meminfo')
  glob(path.join(testDir, '*.txt'), function(err, data) {
    if (err) throw err
    t.ok(data.length > 0, 'should have tests to run')
    a.each(data, runFile, function(err) {
      t.notOk(err, 'should not have an error')
      t.end()
    })
  })

  function runFile(name, cb) {
    fs.readFile(name, function runTestFiles(err, data) {
      if (err) throw err
      testFile(name, data.toString())
      cb()
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
    t.same(info, expected, "should have expected info with " + name)
  }
})
