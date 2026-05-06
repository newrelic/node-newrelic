/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const path = require('path')

const Suite = require('../../versioned-runner/suite')

const MOCK_TEST_DIR = path.resolve(__dirname, 'mock-tests')

test('Suite construction', function (t) {
  let suite = null
  assert.doesNotThrow(function () {
    suite = new Suite([MOCK_TEST_DIR])
  }, 'should not throw when constructed')

  assert.ok(suite instanceof Suite, 'should construct a Suite instance')
})

test('Suite#start', async function (t) {
  const suite = new Suite([MOCK_TEST_DIR])
  const updates = [
    { test: 'redis.mock.fake-test.js', status: 'installing' },
    { test: 'redis.mock.fake-test.js', status: 'running' },
    { test: 'redis.mock.fake-test.js', status: 'success' },
    { test: 'other.mock.fake-test.js', status: 'running' },
    { test: 'other.mock.fake-test.js', status: 'failure' }
    // No "done" event because last test failed.
  ]
  let updateIdx = 0
  const UPDATE_TEST_COUNT = 2

  t.plan(UPDATE_TEST_COUNT * updates.length + 1)

  suite.on('update', function (test, status) {
    const expected = updates[updateIdx++]
    const testName = path.basename(test.currentRun.test)
    const id = expected.test + ':' + expected.status
    t.assert.equal(testName, expected.test, 'should update expected test for ' + id)
    t.assert.equal(status, expected.status, 'should have expected status for ' + id)
  })

  suite.on('end', function () {
    t.assert.ok(1, 'should emit end event')
  })

  await suite.start()
})
