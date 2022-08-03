/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const glob = require('glob')
const fs = require('fs/promises')
const parseProcCpuInfo = require('../../../lib/parse-proc-cpuinfo')
const path = require('path')

test('pricing proc_cpuinfo', async function (t) {
  const testDir = path.resolve(__dirname, '../../lib/cross_agent_tests/proc_cpuinfo')
  const data = await new Promise((resolve, reject) => {
    glob(path.join(testDir, '*.txt'), function globCallback(err, fileList) {
      if (err) {
        return reject(err)
      }
      resolve(fileList)
    })
  })
  t.ok(data.length > 0, 'should have tests to run')
  for (const name of data) {
    const buffer = await fs.readFile(name)
    const file = buffer.toString()
    const expected = parseName(name)
    const info = parseProcCpuInfo(file)
    t.same(info, expected, 'should have expected info for ' + name)
  }
  t.end()

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
})
