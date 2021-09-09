/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const a = require('async')
const test = require('tap').test
const glob = require('glob')
const fs = require('fs')
const parseProcMemInfo = require('../../../lib/parse-proc-meminfo')
const path = require('path')

test('pricing proc_meminfo', function (t) {
  const testDir = path.resolve(__dirname, '../../lib/cross_agent_tests/proc_meminfo')
  glob(path.join(testDir, '*.txt'), function (err, data) {
    if (err) {
      throw err
    }
    t.ok(data.length > 0, 'should have tests to run')
    a.each(data, runFile, function (err) {
      t.notOk(err, 'should not have an error')
      t.end()
    })
  })

  function runFile(name, cb) {
    fs.readFile(name, function runTestFiles(err, data) {
      if (err) {
        throw err
      }
      testFile(name, data.toString())
      cb()
    })
  }

  function parseName(name) {
    const pattern = /^meminfo_(\d+)MB.txt$/
    let arr = name.split('/')
    arr = arr[arr.length - 1].replace(pattern, '$1').split(' ')
    return parseInt(arr[0], 10)
  }

  function testFile(name, file) {
    const expected = parseName(name)
    const info = parseProcMemInfo(file)
    t.same(info, expected, 'should have expected info with ' + name)
  }
})
