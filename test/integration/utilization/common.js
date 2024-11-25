/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const fs = require('fs/promises')
const glob = require('glob')
const JSONbig = require('json-bigint')({ useNativeBigInt: true })
const path = require('path')

function checkMetrics(agent, expectedMetrics) {
  if (!expectedMetrics) {
    assert.equal(agent.metrics._metrics.toJSON().length, 0, 'should not have any metrics')
    return
  }

  Object.keys(expectedMetrics).forEach(function (expectedMetric) {
    const metric = agent.metrics.getOrCreateMetric(expectedMetric)
    assert.equal(
      metric.callCount,
      expectedMetrics[expectedMetric].call_count,
      'should have correct metric call count (' + expectedMetric + ')'
    )
  })
}

async function getTestCases(vendor) {
  const testFile = path.resolve(
    __dirname,
    '../../lib/cross_agent_tests/utilization_vendor_specific',
    vendor + '.json'
  )
  const data = await fs.readFile(testFile)
  return JSONbig.parse(data)
}

async function getProcTests(type) {
  const testDir = path.resolve(__dirname, '../../lib/cross_agent_tests', type)
  return new Promise((resolve, reject) => {
    glob(path.join(testDir, '*.txt'), function (err, fileList) {
      if (err) {
        return reject(err)
      }
      return resolve(fileList)
    })
  })
}

module.exports = {
  checkMetrics,
  getTestCases,
  getProcTests
}
