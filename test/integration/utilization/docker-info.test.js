/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
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
    t.after(function () {
      os.platform.restore()
    })

    sinon.stub(os, 'platform')
    os.platform.returns('linux')
    const data = await fs.readFile(`${testsDir}/cases.json`)
    const cases = JSON.parse(data)

    t.beforeEach((ctx) => {
      const agent = helper.loadMockedAgent()
      sinon.stub(common, 'readProc')
      ctx.nr = { agent }
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
      dockerInfo.clearVendorCache()
      common.readProc.restore()
    })

    for (const testCase of cases) {
      const testFile = path.join(testsDir, testCase.filename)
      await t.test(testCase.filename, makeTest(testCase, testFile, name === 'v2'))
    }
  })
})

function makeTest(testCase, testFile, v2) {
  return async function (t) {
    const { agent } = t.nr
    const file = await fs.readFile(testFile, { encoding: 'utf8' })
    mockProcRead(file, v2)

    await new Promise((resolve) => {
      dockerInfo.getVendorInfo(agent, function (err, info) {
        if (testCase.containerId) {
          assert.ok(!err, 'should not have failed')
          assert.deepEqual(info, { id: testCase.containerId }, 'should have expected container id')
        } else {
          assert.ok(!info, 'should not have found container id')
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
    // The empty.txt test fails if we don't have the next line present. This
    // is due to solving NR-332492 (falling back to v1 if a v2 file is present
    // but does not contain a parseable docker container id).
    common.readProc.onCall(1).yields(null, data)
  }
}
