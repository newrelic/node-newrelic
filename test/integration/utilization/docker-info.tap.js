/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const fs = require('fs/promises')
const common = require('../../../lib/utilization/common')
const dockerInfo = require('../../../lib/utilization/docker-info')
const helper = require('../../lib/agent_helper')
const path = require('path')
const sinon = require('sinon')

const TEST_DIRECTORY = path.resolve(__dirname, '../../lib/cross_agent_tests/docker_container_id/')
const TEST_DIRECTORY_V2 = path.resolve(
  __dirname,
  '../../lib/cross_agent_tests/docker_container_id_v2/'
)

const tests = [
  { name: 'v1', testsDir: TEST_DIRECTORY },
  { name: 'v2', testsDir: TEST_DIRECTORY_V2 }
]

tests.forEach(({ name, testsDir }) => {
  test(`pricing docker info ${name}`, async function (t) {
    const os = require('os')
    t.teardown(function () {
      os.platform.restore()
    })

    sinon.stub(os, 'platform')
    os.platform.returns('linux')
    const data = await fs.readFile(`${testsDir}/cases.json`)
    const cases = JSON.parse(data)

    cases.forEach((testCase) => {
      const testFile = path.join(testsDir, testCase.filename)
      t.test(testCase.filename, makeTest(testCase, testFile, name === 'v2'))
    })
    t.end()
  })
})

function makeTest(testCase, testFile, v2) {
  return async function (t) {
    const agent = helper.loadMockedAgent()
    sinon.stub(common, 'readProc')
    const file = await fs.readFile(testFile, { encoding: 'utf8' })
    mockProcRead(file, v2)

    t.teardown(function () {
      helper.unloadAgent(agent)
      dockerInfo.clearVendorCache()
      common.readProc.restore()
    })

    await new Promise((resolve) => {
      dockerInfo.getVendorInfo(agent, function (err, info) {
        if (testCase.containerId) {
          t.error(err, 'should not have failed')
          t.same(info, { id: testCase.containerId }, 'should have expected container id')
        } else {
          t.notOk(info, 'should not have found container id')
        }

        if (testCase.expectedMetrics) {
          // TODO: No tests currently expect metrics, when one does we'll have to
          // update this test depending on the format of that.
          t.bailout('Docker expected metrics found but can not be handled.')
        } else {
          t.equal(agent.metrics._metrics.toJSON().length, 0, 'should have no metrics')
        }
        resolve()
      })
    })
  }
}

function mockProcRead(data, v2) {
  if (!v2) {
    common.readProc.onCall(0).yields(null, null)
    common.readProc.onCall(1).yields(null, data)
  } else {
    common.readProc.onCall(0).yields(null, data)
  }
}
