/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const isString = require('#agentlib/util/is-string.js')

test('isString', function () {
  assert.ok(isString('foobar'))
  // eslint-disable-next-line sonarjs/no-primitive-wrappers, no-new-wrappers
  assert.ok(isString(new String('foobar')))
  assert.ok(!isString({}))
  assert.ok(!isString([]))
  assert.ok(!isString(arguments))
  assert.ok(!isString(function () {}))
  assert.ok(!isString(true))
  assert.ok(!isString(false))
  assert.ok(!isString(1234))
  assert.ok(!isString(null))
  assert.ok(!isString(undefined))
})
