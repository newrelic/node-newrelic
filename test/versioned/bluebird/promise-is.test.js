/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Some tests in this file need to assert that we handle non-error rejections:
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')

test('Promise.is', function (t) {
  helper.loadTestAgent(t)
  const Promise = require('bluebird')

  let p = new Promise(function (resolve) {
    setImmediate(resolve)
  })
  assert.ok(Promise.is(p), 'should not break promise identification (new)')

  p = p.then(function () {})
  assert.ok(Promise.is(p), 'should not break promise identification (then)')
})
