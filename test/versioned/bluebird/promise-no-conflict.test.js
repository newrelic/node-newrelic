/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Some tests in this file need to assert that we handle non-error rejections:
const assert = require('node:assert')
const test = require('node:test')

const symbols = require('../../../lib/symbols')
const helper = require('../../lib/agent_helper')

test('Promise.noConflict', function (t) {
  helper.loadTestAgent(t)
  const Promise = require('bluebird')
  const Promise2 = Promise.noConflict()

  assert.ok(Promise2.resolve[symbols.original], 'should have wrapped class methods')
  assert.ok(Promise2.prototype.then[symbols.original], 'should have wrapped instance methods')
})
