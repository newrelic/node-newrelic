/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { getMapping } = require('#agentlib/otel/attr-mapping/exceptions.js')
const test = require('node:test')
const assert = require('node:assert')
const {
  EXCEPTION_TYPE
} = require('#agentlib/otel/constants.js')

test('msg', () => {
  const span = {
    attributes: {
      [EXCEPTION_TYPE]: 'Error'
    }
  }
  const { value } = getMapping({ key: 'msg', span })
  assert.deepEqual(value, 'Error')
})
