/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const fs = require('fs/promises')
const parseProcMemInfo = require('../../../lib/parse-proc-meminfo')
const { getProcTests } = require('./common')

test('pricing proc_meminfo', async function (t) {
  const data = await getProcTests('proc_meminfo')
  const plan = tspl(t, { plan: data.length + 1 })
  plan.ok(data.length > 0, 'should have tests to run')
  for (const name of data) {
    const buffer = await fs.readFile(name)
    const file = buffer.toString()
    const expected = parseName(name)
    const info = parseProcMemInfo(file)
    plan.deepEqual(info, expected, 'should have expected info for ' + name)
  }

  await plan.completed

  function parseName(name) {
    const pattern = /^meminfo_(\d+)MB.txt$/
    let arr = name.split('/')
    arr = arr[arr.length - 1].replace(pattern, '$1').split(' ')
    return parseInt(arr[0], 10)
  }
})
