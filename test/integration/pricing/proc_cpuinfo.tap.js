/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const a = require('async')
const test = require('tap').test
const glob = require('glob')
const fs = require('fs')
const parseProcCpuInfo = require('../../../lib/parse-proc-cpuinfo')
const path = require('path')

test('pricing proc_cpuinfo', function (t) {
  const testDir = path.resolve(__dirname, '../../lib/cross_agent_tests/proc_cpuinfo')
  glob(path.join(testDir, '*.txt'), function globCallback(err, data) {
    if (err) {
      throw err
    }
    t.ok(data.length > 0, 'should have tests to run')
    a.each(
      data,
      function (name, cb) {
        runFile(name, cb)
      },
      function (err) {
        t.notOk(err, 'should not have an error')
        t.end()
      }
    )
  })

  function runFile(name, cb) {
    fs.readFile(name, function getFile(err, data) {
      if (err) {
        throw err
      }
      testFile(name, data.toString())
      cb()
    })
  }

  function parseName(name) {
    const pattern = /^((\d+|X)pack_(\d+|X)core_(\d+|X)logical).txt$/
    let arr = name.split('/')
    arr = arr[arr.length - 1].replace(pattern, '$1 $2 $3 $4').split(' ')
    const res = {
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
    const expected = parseName(name)
    const info = parseProcCpuInfo(file)
    t.same(info, expected, 'should have expected info for ' + name)
  }
})
