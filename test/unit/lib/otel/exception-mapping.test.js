/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const exceptionAttr = require('#agentlib/otel/traces/exception-mapping.js')
const test = require('node:test')
const assert = require('node:assert')
const {
  EXCEPTION_TYPE
} = require('#agentlib/otel/traces/constants.js')

test('msg', () => {
  const span = {
    attributes: {
      [EXCEPTION_TYPE]: 'Error'
    }
  }
  const value = exceptionAttr({ key: 'msg', span })
  assert.deepEqual(value, 'Error')
})
