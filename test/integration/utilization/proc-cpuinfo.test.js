/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const fs = require('fs/promises')
const parseProcCpuInfo = require('../../../lib/parse-proc-cpuinfo')
const { getProcTests } = require('./common')

test('pricing proc_cpuinfo', async function (t) {
  const data = await getProcTests('proc_cpuinfo')
  const plan = tspl(t, { plan: data.length + 1 })

  plan.ok(data.length > 0, 'should have tests to run')
  for (const name of data) {
    const buffer = await fs.readFile(name)
    const file = buffer.toString()
    const expected = parseName(name)
    const info = parseProcCpuInfo(file)
    plan.deepEqual(info, expected, 'should have expected info for ' + name)
  }

  await plan.completed

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
