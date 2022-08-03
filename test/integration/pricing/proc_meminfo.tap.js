/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const glob = require('glob')
const fs = require('fs/promises')
const parseProcMemInfo = require('../../../lib/parse-proc-meminfo')
const path = require('path')

test('pricing proc_meminfo', async function (t) {
  const testDir = path.resolve(__dirname, '../../lib/cross_agent_tests/proc_meminfo')
  const data = await new Promise((resolve, reject) => {
    glob(path.join(testDir, '*.txt'), function (err, fileList) {
      if (err) {
        return reject(err)
      }
      return resolve(fileList)
    })
  })

  t.ok(data.length > 0, 'should have tests to run')
  for (const name of data) {
    const buffer = await fs.readFile(name)
    const file = buffer.toString()
    const expected = parseName(name)
    const info = parseProcMemInfo(file)
    t.same(info, expected, 'should have expected info for ' + name)
  }
  t.end()

  function parseName(name) {
    const pattern = /^meminfo_(\d+)MB.txt$/
    let arr = name.split('/')
    arr = arr[arr.length - 1].replace(pattern, '$1').split(' ')
    return parseInt(arr[0], 10)
  }
})
