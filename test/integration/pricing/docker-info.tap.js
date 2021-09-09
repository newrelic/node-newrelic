/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const fs = require('fs')
const common = require('../../../lib/utilization/common')
const dockerInfo = require('../../../lib/utilization/docker-info')
const helper = require('../../lib/agent_helper')
const path = require('path')

const TEST_DIRECTORY = path.resolve(__dirname, '../../lib/cross_agent_tests/docker_container_id/')

test('pricing docker info', function (t) {
  const os = require('os')
  const originalPlatform = os.platform
  os.platform = function () {
    return 'linux'
  }
  t.teardown(function () {
    os.platform = originalPlatform
  })

  fs.readFile(TEST_DIRECTORY + '/cases.json', function readCasefile(err, data) {
    if (!t.error(err, 'should not error loading tests')) {
      t.fail('Could not load tests!')
      t.end()
      return
    }

    const cases = JSON.parse(data)

    t.autoend()
    t.ok(cases.length > 0, 'should have tests to run')
    for (let i = 0; i < cases.length; ++i) {
      t.test(cases[i].filename, makeTest(cases[i]))
    }
  })
})

function makeTest(testCase) {
  return function (t) {
    const agent = helper.loadMockedAgent()
    t.teardown(function () {
      helper.unloadAgent(agent)
      dockerInfo.clearVendorCache()
    })

    mockProcRead(t, path.join(TEST_DIRECTORY, testCase.filename))
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

      t.end()
    })
  }
}

function mockProcRead(t, testFile) {
  const original = common.readProc
  t.teardown(function () {
    common.readProc = original
  })

  common.readProc = function (file, cb) {
    fs.readFile(testFile, { encoding: 'utf8' }, function (err, data) {
      t.error(err, 'should not fail to load test file')
      cb(err, data)
    })
  }
}
